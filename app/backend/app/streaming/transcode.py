"""On-the-fly conversion (subject III.3: convert non-browser-native video on the
fly, mkv minimum; playback must start before the download completes).

Strategy tuned for minimal wait:
  - browser-native (mp4/webm + H.264/AAC/VP*/Opus)  → serve raw (no ffmpeg).
  - non-native container but H.264/AAC codecs        → REMUX (-c copy), instant.
  - anything else                                    → transcode libx264/aac.
Output is always fragmented MP4 (moov-front) so a plain <video> plays it
progressively — no hls.js, fewer moving parts, zero extra console surface.

A single ffmpeg per source file writes an ``<file>.fmp4`` cache; concurrent
viewers tail it. During download the input is fed through a private FIFO bounded
to the contiguous byte prefix so ffmpeg never reads a sparse hole.
"""
from __future__ import annotations

import json
import logging
import os
import re
import signal
import subprocess
import tempfile
import threading
import time
from typing import Callable, Optional

logger = logging.getLogger(__name__)

BROWSER_VCODECS = {"h264", "avc1", "vp8", "vp9", "av1"}
BROWSER_ACODECS = {"aac", "opus", "vorbis"}
DIRECT_EXTS = {".mp4", ".webm"}

# Speed knobs (env-tunable without touching code). Defaults favour "playable
# NOW" over picture quality: the subject requires download+streaming at the same
# time, so time-to-first-frame matters more than fidelity.
PRESET      = os.getenv("TRANSCODE_PRESET", "ultrafast")   # ultrafast ≈ 2-3× veryfast
CRF         = os.getenv("TRANSCODE_CRF", "28")             # higher = faster + smaller
MAX_HEIGHT  = os.getenv("TRANSCODE_MAX_HEIGHT", "480")     # 480p ≈ 2.25× fewer pixels than 720p
AUDIO_KBPS  = os.getenv("TRANSCODE_AUDIO_KBPS", "128")

_MUX_ARGS = [
    "-f", "mp4",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    # Flush a fragment every 0.5s instead of only on keyframes — the player gets
    # playable bytes almost immediately rather than waiting a whole GOP.
    "-frag_duration", "500000",
    "-flush_packets", "1",
]
# Take only the first video + (optional) audio stream and drop subtitles: muxing
# extra/odd streams into mp4 costs time and is a classic ffmpeg failure source.
_MAP_ARGS = ["-map", "0:v:0", "-map", "0:a:0?", "-sn"]
_INPUT_ROBUST = [
    "-fflags", "+genpts+discardcorrupt+igndts",
    "-err_detect", "ignore_err",
    # Cap the initial stream analysis — ffmpeg otherwise reads/buffers several
    # seconds of input before emitting anything, which shows up as dead time.
    "-analyzeduration", "2000000",
    "-probesize", "2000000",
]

# One writer per source path; viewers share its output cache.
_writer_locks: dict[str, threading.Lock] = {}
_writers_started: set[str] = set()
_fail_cooldown: dict[str, float] = {}
_COOLDOWN_S = 30.0
_global_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Probing
# ---------------------------------------------------------------------------

_codec_cache: dict[str, tuple[Optional[str], Optional[str]]] = {}


def probe_codecs(path: str) -> tuple[Optional[str], Optional[str]]:
    """Codecs of the first video/audio stream. Memoised once a definitive answer
    is known: the SSE progress loop asks every second, and spawning an ffprobe
    per tick steals CPU from the ffmpeg that is actually encoding."""
    cached = _codec_cache.get(path)
    if cached is not None:
        return cached
    result = _probe_codecs_uncached(path)
    if result[0] is not None:      # only cache a successful detection
        _codec_cache[path] = result
    return result


def _probe_codecs_uncached(path: str) -> tuple[Optional[str], Optional[str]]:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name",
             "-of", "json", path],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20,
        )
        data = json.loads(out.stdout or b"{}")
    except Exception as e:
        logger.warning("[transcode] probe_codecs failed for %s: %r", path, e)
        return None, None
    vcodec = acodec = None
    for s in data.get("streams", []):
        if s.get("codec_type") == "video" and vcodec is None:
            vcodec = s.get("codec_name")
        elif s.get("codec_type") == "audio" and acodec is None:
            acodec = s.get("codec_name")
    return vcodec, acodec


def probe_duration(path: str) -> Optional[float]:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20,
        )
        dur = float((out.stdout or b"").strip())
        return dur if dur > 0 else None
    except Exception:
        return None


def is_browser_native(path: str) -> bool:
    """True if the COMPLETE file can be served raw: native container + native
    video codec. (Extension alone is insufficient — plenty of .mp4 files carry
    Xvid/DivX the browser can't decode.)"""
    ext = os.path.splitext(path.lower())[1]
    if ext not in DIRECT_EXTS:
        return False
    vcodec, _ = probe_codecs(path)
    return vcodec is None or vcodec in BROWSER_VCODECS


def is_faststart_mp4(path: str) -> bool:
    """True when an MP4's moov atom precedes mdat. Only a faststart file can be
    remuxed from a non-seekable pipe; a moov-at-end file must wait for completion."""
    try:
        with open(path, "rb") as f:
            pos = 0
            for _ in range(16):
                f.seek(pos)
                hdr = f.read(8)
                if len(hdr) < 8:
                    return False
                size = int.from_bytes(hdr[:4], "big")
                atom = hdr[4:8]
                if atom == b"moov":
                    return True
                if atom == b"mdat":
                    return False
                if size == 1:
                    ext = f.read(8)
                    if len(ext) < 8:
                        return False
                    size = int.from_bytes(ext, "big")
                if size <= 0:
                    return False
                pos += size
    except OSError:
        return False
    return False


def _codec_args(path: str) -> list[str]:
    vcodec, acodec = probe_codecs(path)
    if vcodec in BROWSER_VCODECS:
        # Already browser-playable → pure remux, no re-encode, ~zero CPU.
        vargs = ["-c:v", "copy"]
    else:
        vargs = [
            "-c:v", "libx264",
            "-preset", PRESET,
            "-crf", CRF,
            # zerolatency kills lookahead/B-frame buffering: frames come out as
            # soon as they're encoded instead of after a multi-frame delay.
            "-tune", "zerolatency",
            # Short, regular GOP → frequent keyframes → fragments flush sooner
            # and seeking inside the growing stream is finer-grained.
            "-g", "30", "-sc_threshold", "0",
            # Browsers cannot decode 10-bit/4:2:2; force the universal format.
            "-pix_fmt", "yuv420p",
            "-threads", "0",
            "-vf", f"scale=-2:'min({MAX_HEIGHT},ih)'",
        ]
    if acodec is None:
        aargs: list[str] = ["-an"]
    elif acodec in BROWSER_ACODECS:
        aargs = ["-c:a", "copy"]
    else:
        aargs = ["-c:a", "aac", "-b:a", f"{AUDIO_KBPS}k", "-ac", "2", "-ar", "48000"]
    logger.info("[transcode] plan %s: v=%s→%s a=%s→%s", os.path.basename(path),
                vcodec, vargs[1], acodec, aargs[1] if len(aargs) > 1 else "none")
    return _MAP_ARGS + vargs + aargs


# ---------------------------------------------------------------------------
# HLS (segmented) output
# ---------------------------------------------------------------------------
# Segments arrive one by one, so the player can start after the FIRST segment
# (~2 s of video) instead of waiting on a byte threshold, and can seek anywhere
# inside what has already been produced. mpegts segments only carry H.264/AAC,
# so the "copy" fast path is narrower here than for fMP4.

HLS_SEGMENT_SECONDS = os.getenv("HLS_SEGMENT_SECONDS", "2")
HLS_COPY_VCODECS = {"h264", "avc1"}
HLS_COPY_ACODECS = {"aac"}
SEGMENT_RE = re.compile(r"^seg\d{5}\.ts$")


def hls_dir(path: str) -> str:
    return path + ".hls"


def hls_playlist(path: str) -> str:
    return os.path.join(hls_dir(path), "index.m3u8")


def hls_ready(path: str, min_segments: int = 1) -> bool:
    """True once at least ``min_segments`` segments exist AND the playlist lists
    them — enough for the player to start."""
    pl = hls_playlist(path)
    if not os.path.isfile(pl):
        return False
    try:
        with open(pl, "r", encoding="utf-8", errors="replace") as f:
            return f.read().count("#EXTINF") >= min_segments
    except OSError:
        return False


# ---------------------------------------------------------------------------
# On-demand VOD segments — full seek bar while still downloading
# ---------------------------------------------------------------------------
# Instead of appending segments as they are produced (growing seek bar), we
# publish the COMPLETE playlist up front, computed from the media duration, and
# transcode each segment only when the player actually asks for it. The player
# therefore knows the real duration immediately and can seek anywhere; a seek
# just triggers "fetch those pieces, transcode that slice".

VOD_SEGMENT_RE = re.compile(r"^vod(\d+)\.ts$")
_duration_cache: dict[str, Optional[float]] = {}


def cached_duration(path: str) -> Optional[float]:
    """Media duration, memoised. Needs the container index (moov) to be present,
    which for a moov-at-end MP4 means the tail must be downloaded first."""
    if path in _duration_cache and _duration_cache[path]:
        return _duration_cache[path]
    dur = probe_duration(path)
    if dur:
        _duration_cache[path] = dur
    return dur


def vod_segment_seconds() -> float:
    """Segment length for on-demand mode.

    Longer than the progressive mode's 2s on purpose: each segment costs one
    ffmpeg spawn (~0.5-1s of fixed overhead), so 2s segments would barely keep
    up with real-time playback. ~6s amortises the spawn and keeps the playlist
    to a sane size (900 entries for a 90-minute film).
    """
    try:
        return max(1.0, float(os.getenv("VOD_SEGMENT_SECONDS", "6")))
    except ValueError:
        return 6.0


def build_vod_playlist(duration: float) -> str:
    """A complete VOD playlist: every segment listed, ENDLIST present. This is
    what makes the player show the full duration and allow seeking anywhere."""
    d = vod_segment_seconds()
    count = max(1, int(duration // d) + (1 if duration % d else 0))
    lines = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        f"#EXT-X-TARGETDURATION:{int(d) + 1}",
        "#EXT-X-MEDIA-SEQUENCE:0",
        "#EXT-X-PLAYLIST-TYPE:VOD",
    ]
    for i in range(count):
        seg = min(d, duration - i * d)
        if seg <= 0:
            break
        lines.append(f"#EXTINF:{seg:.3f},")
        lines.append(f"vod{i}.ts")
    lines.append("#EXT-X-ENDLIST")
    return "\n".join(lines) + "\n"


def vod_segment_path(path: str, index: int) -> str:
    return os.path.join(hls_dir(path), f"vod{index}.ts")


def ensure_segment_cache_valid(path: str) -> None:
    """Drop cached segments that were produced with a different segment length.

    Segment files are named by index only, so if VOD_SEGMENT_SECONDS changes the
    old files silently describe different time spans than the playlist claims —
    the player then collapses the timeline to one segment. Cheap marker file
    keeps the cache and the playlist in sync.
    """
    d = vod_segment_seconds()
    hdir = hls_dir(path)
    marker = os.path.join(hdir, ".segdur")
    try:
        if not os.path.isdir(hdir):
            return
        current = None
        try:
            with open(marker, "r", encoding="utf-8") as f:
                current = f.read().strip()
        except OSError:
            current = None
        if current == f"{d}":
            return
        removed = 0
        for name in os.listdir(hdir):
            if VOD_SEGMENT_RE.match(name):
                try:
                    os.unlink(os.path.join(hdir, name))
                    removed += 1
                except OSError:
                    pass
        with open(marker, "w", encoding="utf-8") as f:
            f.write(f"{d}")
        if removed:
            logger.info("[vod] segment length changed → dropped %d stale segment(s) for %s",
                        removed, os.path.basename(path))
    except OSError:
        pass


def vod_byte_window(path: str, index: int, duration: float, file_size: int) -> tuple[int, int]:
    """Approximate byte range backing segment ``index``.

    VBR makes this inexact, so we derive it from the average bitrate and pad
    generously — the caller only uses it to decide which pieces to fetch first.
    """
    d = vod_segment_seconds()
    if duration <= 0 or file_size <= 0:
        return 0, file_size
    per_second = file_size / duration
    start = int(max(0, (index * d - d) * per_second))          # one segment of lead-in
    end = int(min(file_size - 1, ((index + 1) * d + d) * per_second))
    return start, max(start, end)


def ensure_vod_segment(path: str, index: int, timeout: float = 180.0) -> Optional[str]:
    """Transcode exactly one segment (cached). Returns its path, or None."""
    os.makedirs(hls_dir(path), exist_ok=True)
    ensure_segment_cache_valid(path)
    out = vod_segment_path(path, index)
    if os.path.isfile(out) and os.path.getsize(out) > 0:
        return out
    lock = _lock_for(out)
    with lock:
        if os.path.isfile(out) and os.path.getsize(out) > 0:
            return out
        d = vod_segment_seconds()
        start = index * d
        tmp = out + ".tmp"
        cmd = [
            "ffmpeg", "-y",
            # Input seek (before -i) is the fast one: it jumps via the index
            # instead of decoding from the beginning.
            "-ss", f"{start:.3f}",
            *_INPUT_ROBUST,
            "-i", path,
            "-t", f"{d:.3f}",
            *_MAP_ARGS,
            "-c:v", "libx264", "-preset", PRESET, "-crf", CRF,
            "-pix_fmt", "yuv420p", "-threads", "0",
            "-vf", f"scale=-2:'min({MAX_HEIGHT},ih)'",
            # Keyframe at the segment start so each segment decodes standalone.
            "-force_key_frames", "expr:gte(t,0)",
            "-c:a", "aac", "-b:a", f"{AUDIO_KBPS}k", "-ac", "2", "-ar", "48000",
            # Place the segment at its real position in the movie. Input seek
            # rebases timestamps to ~0, and this offset puts them back at
            # `start`, so the player stitches segments at the right times and
            # keeps the full-length timeline.
            #
            # Do NOT add "-avoid_negative_ts make_zero" here: it re-zeroes the
            # first timestamp and therefore cancels this offset. Every segment
            # would then start at PTS 0 and the player would collapse the
            # duration to a single segment (the seek bar jumping to 0:02).
            "-output_ts_offset", f"{start:.3f}",
            "-muxdelay", "0", "-muxpreload", "0",
            "-f", "mpegts", tmp,
        ]
        rc = _run_ffmpeg(cmd, f"vod-seg{index}")
        if rc != 0 or not os.path.isfile(tmp) or os.path.getsize(tmp) == 0:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            return None
        os.replace(tmp, out)
        return out


def hls_segment_count(path: str) -> int:
    """Segments produced so far — drives the overlay's progress readout."""
    try:
        with open(hls_playlist(path), "r", encoding="utf-8", errors="replace") as f:
            return f.read().count("#EXTINF")
    except OSError:
        return 0


def hls_finished(path: str) -> bool:
    pl = hls_playlist(path)
    try:
        with open(pl, "r", encoding="utf-8", errors="replace") as f:
            return "#EXT-X-ENDLIST" in f.read()
    except OSError:
        return False


def _hls_codec_args(path: str) -> list[str]:
    vcodec, acodec = probe_codecs(path)
    if vcodec in HLS_COPY_VCODECS:
        vargs = ["-c:v", "copy"]
    else:
        vargs = [
            "-c:v", "libx264",
            "-preset", PRESET,
            "-crf", CRF,
            "-tune", "zerolatency",
            "-pix_fmt", "yuv420p",
            "-threads", "0",
            "-vf", f"scale=-2:'min({MAX_HEIGHT},ih)'",
            # Guarantee a keyframe exactly on each segment boundary, otherwise
            # ffmpeg can only cut at the source's own (possibly rare) keyframes
            # and segments drift far longer than requested.
            "-force_key_frames", f"expr:gte(t,n_forced*{HLS_SEGMENT_SECONDS})",
        ]
    if acodec is None:
        aargs: list[str] = ["-an"]
    elif acodec in HLS_COPY_ACODECS:
        aargs = ["-c:a", "copy"]
    else:
        aargs = ["-c:a", "aac", "-b:a", f"{AUDIO_KBPS}k", "-ac", "2", "-ar", "48000"]
    logger.info("[hls] plan %s: v=%s→%s a=%s→%s", os.path.basename(path),
                vcodec, vargs[1], acodec, aargs[1] if len(aargs) > 1 else "none")
    return _MAP_ARGS + vargs + aargs


def _hls_mux_args(out_dir: str, live: bool) -> list[str]:
    return [
        "-f", "hls",
        "-hls_time", HLS_SEGMENT_SECONDS,
        # event = playlist only ever appends (seekable in the produced range);
        # vod = complete, fully seekable. ffmpeg appends #EXT-X-ENDLIST at exit.
        "-hls_playlist_type", "event" if live else "vod",
        "-hls_list_size", "0",
        # temp_file: write seg.tmp then rename, so a client never fetches a
        # half-written segment. independent_segments: each starts on a keyframe.
        "-hls_flags", "independent_segments+temp_file",
        "-hls_segment_filename", os.path.join(out_dir, "seg%05d.ts"),
        os.path.join(out_dir, "index.m3u8"),
    ]


def ensure_hls(path: str, contiguous_fn: Optional[Callable[[], int]] = None,
               seekable: bool = False) -> Optional[str]:
    """Start (once) the HLS writer for ``path``.

    Three input modes:
      - contiguous_fn=None            → complete file, read directly;
      - contiguous_fn + pipe-able     → bounded FIFO (still downloading);
      - contiguous_fn + seekable=True → the real sparse file, guarded by the
        read gate. Needed for a moov-at-end MP4, which a pipe can never decode.
    Returns the playlist path, or None when nothing can run yet.
    """
    key = path + "#hls"
    if hls_finished(path):
        return hls_playlist(path)
    # Still downloading, not seekable-mode, and the container can't be piped →
    # ffmpeg would produce nothing for the whole download. Don't start.
    if contiguous_fn is not None and not seekable and not can_stream_from_pipe(path):
        return None
    with _global_lock:
        if key in _writers_started:
            return hls_playlist(path)
        cd = _fail_cooldown.get(key, 0)
        if cd and time.time() < cd:
            return None
        _writers_started.add(key)
    threading.Thread(target=_run_hls, args=(path, contiguous_fn, seekable), daemon=True).start()
    return hls_playlist(path)


def _run_hls(path: str, contiguous_fn: Optional[Callable[[], int]], seekable: bool = False) -> None:
    key = path + "#hls"
    out_dir = hls_dir(path)
    os.makedirs(out_dir, exist_ok=True)
    live = contiguous_fn is not None
    stop = threading.Event()
    fifo_dir: Optional[str] = None
    gate_path = gate_fn = None
    try:
        if live and seekable:
            # Read the real file so ffmpeg can seek to the moov at EOF; the gate
            # keeps it from overtaking the downloaded prefix.
            source = path
            gate_path, gate_fn = path, contiguous_fn
            mode = "live-seekable"
        elif live:
            fifo_dir = tempfile.mkdtemp(prefix="ht_hls_")
            source = os.path.join(fifo_dir, "in.fifo")
            os.mkfifo(source, mode=0o600)
            threading.Thread(
                target=_feed_fifo, args=(path, source, contiguous_fn, stop), daemon=True
            ).start()
            mode = "live-pipe"
        else:
            source = path
            mode = "complete"
        cmd = ["ffmpeg", "-y", *_INPUT_ROBUST, "-i", source,
               *_hls_codec_args(path), *_hls_mux_args(out_dir, live)]
        logger.info("[hls] start (%s) %s", mode, os.path.basename(path))
        rc = _run_ffmpeg(cmd, "hls", gate_path=gate_path, gate_fn=gate_fn)
        if rc == 0:
            logger.info("[hls] done for %s", os.path.basename(path))
        else:
            with _global_lock:
                _fail_cooldown[key] = time.time() + _COOLDOWN_S
    except Exception as e:
        logger.error("[hls] failed for %s: %r", path, e)
        with _global_lock:
            _fail_cooldown[key] = time.time() + _COOLDOWN_S
    finally:
        stop.set()
        if fifo_dir:
            _rmtree(fifo_dir)
        with _global_lock:
            _writers_started.discard(key)


# ---------------------------------------------------------------------------
# fMP4 cache paths + process helpers
# ---------------------------------------------------------------------------

def cache_paths(path: str) -> tuple[str, str, str]:
    """(tmp, final, done-marker) for the fMP4 cache of ``path``."""
    return path + ".fmp4.tmp", path + ".fmp4", path + ".fmp4.done"


def _lock_for(path: str) -> threading.Lock:
    with _global_lock:
        lk = _writer_locks.get(path)
        if lk is None:
            lk = threading.Lock()
            _writer_locks[path] = lk
        return lk


def _run_ffmpeg(cmd: list[str], tag: str, *, gate_path: Optional[str] = None,
                gate_fn: Optional[Callable[[], int]] = None) -> int:
    """Run ffmpeg with stderr captured to a temp file and echoed on failure.
    Sending stderr to DEVNULL makes every ffmpeg problem invisible; a PIPE can
    fill up and block the process, so a file is the safe middle ground.

    ``gate_path``/``gate_fn`` enable the sparse-file read gate (see _read_gate).
    """
    with tempfile.NamedTemporaryFile(prefix="ffmpeg_", suffix=".log", delete=False) as errf:
        err_path = errf.name
    proc: Optional[subprocess.Popen] = None
    gate_stop = threading.Event()
    try:
        with open(err_path, "wb") as err:
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=err)
            if gate_path and gate_fn:
                threading.Thread(
                    target=_read_gate, args=(proc, gate_path, gate_fn, gate_stop), daemon=True
                ).start()
            rc = proc.wait()
        if rc != 0:
            try:
                with open(err_path, "r", encoding="utf-8", errors="replace") as f:
                    tail = "".join(f.readlines()[-15:]).strip()
            except OSError:
                tail = "<no stderr captured>"
            logger.error("[%s] ffmpeg rc=%s\n%s", tag, rc, tail)
        return rc
    finally:
        gate_stop.set()
        if proc is not None:
            _terminate(proc)
        try:
            os.unlink(err_path)
        except OSError:
            pass


def _input_read_offset(pid: int, path: str) -> Optional[int]:
    """Current read offset of ``pid``'s descriptor on ``path`` (Linux /proc).

    Lets us see how far ffmpeg has actually read into the sparse file, which is
    the only way to stop it running past the downloaded region. Returns None if
    /proc is unavailable or the fd is gone."""
    try:
        target = os.path.realpath(path)
        fd_dir = f"/proc/{pid}/fd"
        for fd in os.listdir(fd_dir):
            try:
                if os.path.realpath(os.path.join(fd_dir, fd)) != target:
                    continue
                with open(f"/proc/{pid}/fdinfo/{fd}", "r") as f:
                    for line in f:
                        if line.startswith("pos:"):
                            return int(line.split()[1])
            except (OSError, ValueError):
                continue
    except OSError:
        return None
    return None


def _read_gate(proc: subprocess.Popen, path: str, available_fn: Callable[[], int],
               stop: threading.Event, margin: int = 4 * 1024 * 1024) -> None:
    """Keep ffmpeg from reading past the downloaded prefix of a sparse file.

    ffmpeg needs a *seekable* input to reach a moov stored at the end of an MP4,
    so we hand it the real file instead of a FIFO. The file is sparse though:
    anything not yet downloaded reads as zeros and would silently corrupt the
    output. So watch its read position and SIGSTOP/SIGCONT it to stay behind the
    contiguous prefix. Degrades safely: if /proc is unreadable we simply never
    pause (the caller only starts this path once a healthy prefix exists).
    """
    paused = False
    try:
        while not stop.is_set() and proc.poll() is None:
            pos = _input_read_offset(proc.pid, path)
            if pos is None:
                time.sleep(0.5)
                continue
            available = available_fn()
            # Reading near the end (the moov) is expected and always allowed.
            if pos + margin >= available and available > 0:
                if not paused:
                    try:
                        proc.send_signal(signal.SIGSTOP)
                        paused = True
                    except Exception:
                        break
            elif paused:
                try:
                    proc.send_signal(signal.SIGCONT)
                    paused = False
                except Exception:
                    break
            time.sleep(0.25)
    finally:
        # Never leave a stopped process behind — it would hang forever.
        if paused and proc.poll() is None:
            try:
                proc.send_signal(signal.SIGCONT)
            except Exception:
                pass


def can_stream_from_pipe(path: str) -> bool:
    """Can ffmpeg transcode this container while reading it from a non-seekable
    pipe (i.e. while it is still downloading)?

    MP4/MOV keep an index (``moov``) that is often written at the END of the
    file. From a pipe ffmpeg cannot seek to it, so it reads and emits nothing
    until EOF — the stream appears frozen at 0 segments for the whole download.
    Matroska/WebM/AVI/TS are designed to be streamed and are always fine.
    """
    ext = os.path.splitext(path.lower())[1]
    if ext in {".mp4", ".m4v", ".mov"}:
        return is_faststart_mp4(path)
    return True


def _terminate(proc: subprocess.Popen, timeout: float = 2.0) -> None:
    if proc.poll() is not None:
        return
    # A process paused by the read gate ignores SIGTERM until it is resumed —
    # continue it first or we would leave a stopped orphan behind.
    try:
        proc.send_signal(signal.SIGCONT)
    except Exception:
        pass
    for step in ("terminate", "kill"):
        try:
            getattr(proc, step)()
            proc.wait(timeout=timeout)
            return
        except Exception:
            continue


def is_cache_ready(path: str, min_bytes: int = 512 * 1024) -> bool:
    """True when the fMP4 cache has enough bytes for the player to start, or is
    finished. Kept deliberately small (512 KB ≈ a couple of fragments): the
    stream keeps growing behind the playhead, so waiting for more just delays
    the first frame."""
    tmp, final, done = cache_paths(path)
    if os.path.exists(done) and os.path.exists(final):
        return True
    try:
        return os.path.getsize(tmp) >= min_bytes
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Writers
# ---------------------------------------------------------------------------

def ensure_static_fmp4(path: str) -> Optional[str]:
    """Start (once) a background ffmpeg that remuxes/transcodes the COMPLETE file
    to an fMP4 cache. Returns the tmp path to tail, or None if on cooldown."""
    tmp, final, done = cache_paths(path)
    if os.path.exists(done) and os.path.exists(final):
        return final
    with _global_lock:
        if path in _writers_started:
            return tmp
        cd = _fail_cooldown.get(path, 0)
        if cd and time.time() < cd:
            return None
        _writers_started.add(path)
    threading.Thread(target=_run_static, args=(path,), daemon=True).start()
    return tmp


def _run_static(path: str) -> None:
    tmp, final, done = cache_paths(path)
    lock = _lock_for(path)
    with lock:
        try:
            cmd = ["ffmpeg", "-y", *_INPUT_ROBUST, "-i", path, *_codec_args(path), *_MUX_ARGS, tmp]
            rc = _run_ffmpeg(cmd, "fmp4-static")
            if rc == 0 and os.path.exists(tmp):
                os.replace(tmp, final)
                open(done, "w").close()
                logger.info("[transcode] static fMP4 done for %s", os.path.basename(path))
            else:
                raise RuntimeError(f"ffmpeg rc={rc}")
        except Exception as e:
            logger.error("[transcode] static fMP4 failed for %s: %r", path, e)
            with _global_lock:
                _fail_cooldown[path] = time.time() + _COOLDOWN_S
            for p in (tmp,):
                try:
                    os.unlink(p)
                except OSError:
                    pass
        finally:
            with _global_lock:
                _writers_started.discard(path)


def ensure_growing_fmp4(path: str, contiguous_fn: Callable[[], int]) -> Optional[str]:
    """Start (once) a background ffmpeg fed by a FIFO bounded to the contiguous
    prefix of a still-downloading file. Returns the tmp path to tail."""
    tmp, final, done = cache_paths(path)
    if os.path.exists(done) and os.path.exists(final):
        return final
    # Same moov-at-end limitation as HLS: a non-faststart MP4 read from the FIFO
    # yields nothing until EOF, so don't even start.
    if not can_stream_from_pipe(path):
        return None
    with _global_lock:
        if path in _writers_started:
            return tmp
        cd = _fail_cooldown.get(path, 0)
        if cd and time.time() < cd:
            return None
        _writers_started.add(path)
    threading.Thread(target=_run_growing, args=(path, contiguous_fn), daemon=True).start()
    return tmp


def _run_growing(path: str, contiguous_fn: Callable[[], int]) -> None:
    tmp, final, done = cache_paths(path)
    lock = _lock_for(path)
    fifo_dir = tempfile.mkdtemp(prefix="ht_")
    fifo = os.path.join(fifo_dir, "in.fifo")
    stop = threading.Event()
    with lock:
        try:
            os.mkfifo(fifo, mode=0o600)
        except OSError as e:
            logger.error("[transcode] mkfifo failed: %r", e)
            with _global_lock:
                _writers_started.discard(path)
            _rmtree(fifo_dir)
            return

        feeder = threading.Thread(target=_feed_fifo, args=(path, fifo, contiguous_fn, stop), daemon=True)
        feeder.start()
        try:
            cmd = ["ffmpeg", "-y", *_INPUT_ROBUST, "-i", fifo, *_codec_args(path), *_MUX_ARGS, tmp]
            rc = _run_ffmpeg(cmd, "fmp4-growing")
            if rc == 0 and os.path.exists(tmp):
                os.replace(tmp, final)
                open(done, "w").close()
                logger.info("[transcode] growing fMP4 done for %s", os.path.basename(path))
            else:
                with _global_lock:
                    _fail_cooldown[path] = time.time() + _COOLDOWN_S
        except Exception as e:
            logger.error("[transcode] growing fMP4 failed for %s: %r", path, e)
            with _global_lock:
                _fail_cooldown[path] = time.time() + _COOLDOWN_S
        finally:
            stop.set()
            _rmtree(fifo_dir)
            with _global_lock:
                _writers_started.discard(path)


def _feed_fifo(path: str, fifo: str, contiguous_fn: Callable[[], int], stop: threading.Event) -> None:
    """Copy the file into the FIFO, never reading past the contiguous prefix."""
    try:
        f = open(path, "rb")
    except OSError:
        return
    try:
        with open(fifo, "wb") as out:
            offset = 0
            idle = 0
            while not stop.is_set():
                safe = contiguous_fn()
                if safe <= offset:
                    # Wait for more contiguous data; bail if the file is done.
                    if _looks_complete(path, offset):
                        break
                    idle += 1
                    if idle > 600:  # ~60s with no progress → give up
                        break
                    time.sleep(0.1)
                    continue
                idle = 0
                f.seek(offset)
                chunk = f.read(min(1024 * 1024, safe - offset))
                if not chunk:
                    time.sleep(0.1)
                    continue
                out.write(chunk)
                offset += len(chunk)
    except BrokenPipeError:
        pass
    except Exception as e:
        logger.warning("[transcode] feeder error for %s: %r", os.path.basename(path), e)
    finally:
        try:
            f.close()
        except Exception:
            pass


def _looks_complete(path: str, offset: int) -> bool:
    try:
        st = os.stat(path)
    except OSError:
        return False
    # File fully materialised (block count caught up) and we've read it all.
    return st.st_size > 0 and (st.st_blocks * 512) >= st.st_size * 0.99 and offset >= st.st_size


def _rmtree(d: str) -> None:
    try:
        for f in os.listdir(d):
            try:
                os.unlink(os.path.join(d, f))
            except OSError:
                pass
        os.rmdir(d)
    except OSError:
        pass


def tail_fmp4(path: str, chunk_size: int = 64 * 1024):
    """Yield the fMP4 cache bytes as it grows, until the writer marks it done."""
    tmp, final, done = cache_paths(path)
    read_path = final if os.path.exists(final) else tmp
    # Wait briefly for the writer to create the file.
    waited = 0.0
    while not os.path.exists(read_path) and waited < 15.0:
        time.sleep(0.2)
        waited += 0.2
        read_path = final if os.path.exists(final) else tmp
    if not os.path.exists(read_path):
        return
    try:
        with open(read_path, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if chunk:
                    yield chunk
                    continue
                if os.path.exists(done):
                    tail = f.read()
                    if tail:
                        yield tail
                    break
                time.sleep(0.2)
    except (OSError, BrokenPipeError):
        return


def reap_orphans(download_dir: str) -> None:
    """Remove leftovers from crashed runs: *.fmp4.tmp with no .done marker, and
    unfinished *.hls directories (playlist without #EXT-X-ENDLIST). Keeping them
    would make a future request believe output is ready when nothing is writing."""
    if not os.path.isdir(download_dir):
        return
    removed = 0
    for root, dirs, files in os.walk(download_dir):
        for f in files:
            if not f.endswith(".fmp4.tmp"):
                continue
            tmp = os.path.join(root, f)
            if os.path.exists(tmp[:-len(".tmp")] + ".done"):
                continue
            try:
                os.unlink(tmp)
                removed += 1
            except OSError:
                pass
        for d in list(dirs):
            if not d.endswith(".hls"):
                continue
            hdir = os.path.join(root, d)
            try:
                entries = os.listdir(hdir)
            except OSError:
                continue
            # On-demand VOD segments are a valid cache even though no playlist is
            # written to disk (it is generated per request) — never reap those.
            if any(VOD_SEGMENT_RE.match(e) for e in entries):
                continue
            pl = os.path.join(hdir, "index.m3u8")
            try:
                with open(pl, "r", encoding="utf-8", errors="replace") as fh:
                    if "#EXT-X-ENDLIST" in fh.read():
                        continue          # finished output, keep as cache
            except OSError:
                pass
            try:
                for name in os.listdir(hdir):
                    os.unlink(os.path.join(hdir, name))
                os.rmdir(hdir)
                dirs.remove(d)
                removed += 1
            except OSError:
                pass
    if removed:
        logger.info("[transcode] reaped %d orphan transcode artefact(s)", removed)


# ---------------------------------------------------------------------------
# Embedded subtitle extraction (mkv/container-bundled tracks → WebVTT)
# ---------------------------------------------------------------------------

def extract_embedded_subtitles(path: str, out_dir: str) -> list[tuple[str, str]]:
    """Extract each subtitle stream of ``path`` to ``out_dir/<lang>.vtt``.
    Returns [(lang, vtt_path)]. Best-effort; failures are logged, not raised."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "s",
             "-show_entries", "stream=index:stream_tags=language",
             "-of", "json", path],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20,
        )
        streams = json.loads(out.stdout or b"{}").get("streams", [])
    except Exception:
        return []
    results: list[tuple[str, str]] = []
    os.makedirs(out_dir, exist_ok=True)
    for n, s in enumerate(streams):
        lang = (s.get("tags", {}) or {}).get("language") or f"und{n}"
        lang = "".join(c for c in lang.lower() if c.isalnum())[:8] or f"und{n}"
        vtt = os.path.join(out_dir, f"{lang}.vtt")
        if os.path.isfile(vtt):
            results.append((lang, vtt))
            continue
        try:
            rc = subprocess.run(
                ["ffmpeg", "-y", "-i", path, "-map", f"0:s:{n}", "-c:s", "webvtt", vtt],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120,
            ).returncode
            if rc == 0 and os.path.isfile(vtt):
                results.append((lang, vtt))
        except Exception as e:
            logger.warning("[transcode] embedded sub extract failed (%s): %r", lang, e)
    return results
