"""Server-side BitTorrent download engine (subject III.3: download via BitTorrent
on the server, stream while downloading, non-blocking background).

Uses libtorrent (a raw BitTorrent library — the streaming logic below is written
by hand, so the forbidden stream-from-torrent libs webtorrent/peerflix/pulsar are
not involved). Streaming-aware scheduling: sequential download + piece deadlines
on the target file's head (fast start) and tail (moov/cues → seeking), with the
contiguous byte prefix computed from the piece bitfield so the transcode feeder
never reads a sparse hole.

Multi-file aware: an academic "course" torrent bundles many videos; ``file_index``
selects exactly one so we never download 8 GB to watch one lecture.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import httpx
import libtorrent as lt

logger = logging.getLogger(__name__)

DOWNLOAD_DIR = os.getenv("DOWNLOAD_DIR", "/data/movies")
POLL_INTERVAL = 0.5

# Start buffer: how much CONTIGUOUS data must land before we let ffmpeg/the
# player start. Small = the user watches sooner (subject: download and stream
# simultaneously); the sequential piece deadlines keep filling ahead of playback.
BUFFER_MIN_BYTES = int(os.getenv("STREAM_BUFFER_MIN_MB", "2")) * 1024 * 1024
BUFFER_MAX_BYTES = int(os.getenv("STREAM_BUFFER_MAX_MB", "4")) * 1024 * 1024

# How much of the file's END to fetch up-front. A non-faststart MP4 stores its
# moov index there; without it ffmpeg cannot decode anything at all.
TAIL_BYTES = int(os.getenv("STREAM_TAIL_MB", "8")) * 1024 * 1024

VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".webm", ".mov", ".wmv", ".flv", ".ogv", ".mpeg", ".mpg", ".m4v", ".ts"}
DIRECT_EXTS = {".mp4", ".webm"}
# Containers ffmpeg can decode from a non-seekable pipe, i.e. while the file is
# still downloading. MP4/MOV are excluded: their index (moov) is often written
# at the END of the file, unreachable from a pipe until the download completes.
PIPE_STREAMABLE_EXTS = {".mkv", ".webm", ".avi", ".ogv", ".ts", ".mpeg", ".mpg", ".flv", ".wmv"}

# Speed over fidelity: among usable video files, take the smallest one that is
# still a full copy of the movie, so playback starts sooner and we download far
# less. The floor rejects samples/trailers.
#
# It is deliberately ABSOLUTE, not a fraction of the largest file: archive.org
# items often ship a multi-gigabyte raw original (e.g. a 3.3 GB .mpeg next to a
# 390 MB .ogv). A relative floor computed against that outlier would disqualify
# the perfectly good small derivative and make us download ten times too much.
VIDEO_MIN_BYTES = int(os.getenv("VIDEO_MIN_MB", "50")) * 1024 * 1024
PREFER_SMALLEST = os.getenv("PREFER_SMALLEST_VIDEO", "1") not in ("0", "false", "False")


def _rank(ext: str, size: int, largest: int) -> tuple:
    """Ranking key for the file we will stream, highest wins.

    Ordered by: (1) can it be transcoded while downloading, (2) is it a full
    copy rather than a sample, (3) smallest such file (faster to start and to
    download). ``largest`` is only used as a fallback when every candidate is
    below the absolute floor, so a tiny-but-only file still gets picked.
    """
    streamable = 1 if ext in PIPE_STREAMABLE_EXTS else 0
    floor = VIDEO_MIN_BYTES if largest >= VIDEO_MIN_BYTES else 0
    full_copy = 1 if size >= floor else 0
    if PREFER_SMALLEST:
        # Negative size → smaller sorts higher inside the same class.
        return (streamable, full_copy, -size)
    return (streamable, full_copy, size)


@dataclass
class DownloadHandle:
    handle: "lt.torrent_handle"
    movie_id: int
    key: str                       # filesystem folder key (== movie.archive_id)
    file_index: Optional[int]      # chosen file for multi-file torrents, else auto
    buffer_event: asyncio.Event
    file_path: Optional[str] = None
    target_index: int = -1
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    stall_since: Optional[datetime] = None
    last_active: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class TorrentEngine:
    _instance: Optional["TorrentEngine"] = None

    def __new__(cls) -> "TorrentEngine":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._ready = False
        return cls._instance

    def __init__(self) -> None:
        if self._ready:
            return
        self._session = self._make_session()
        self._handles: dict[int, DownloadHandle] = {}
        self._lock = asyncio.Lock()
        self._file_list_cache: dict[str, list[dict]] = {}
        self._ready = True
        logger.info("[engine] libtorrent session up")

    def _make_session(self) -> "lt.session":
        return lt.session({
            "listen_interfaces": "0.0.0.0:6881",
            "enable_dht": True, "enable_lsd": True,
            "enable_upnp": True, "enable_natpmp": True,
            "alert_mask": lt.alert.category_t.error_notification | lt.alert.category_t.status_notification,
            # archive.org + academic torrents embed HTTP web seeds (BEP-19).
            "max_web_seed_connections": 4,
        })

    # -- introspection -----------------------------------------------------

    def has_handle(self, movie_id: int) -> bool:
        return movie_id in self._handles

    @staticmethod
    async def _fetch_torrent(url: str, attempts: int = 4) -> bytes:
        last: Optional[Exception] = None
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            for i in range(attempts):
                try:
                    r = await client.get(url)
                    r.raise_for_status()
                    return r.content
                except httpx.HTTPStatusError as e:
                    last = e
                    if e.response.status_code < 500:
                        raise
                except httpx.HTTPError as e:
                    last = e
                if i < attempts - 1:
                    await asyncio.sleep(0.5 * (2 ** i))
        assert last is not None
        raise last

    async def list_video_files(self, torrent_url: str) -> list[dict]:
        """List the video files inside a torrent WITHOUT downloading content
        (fetches the small .torrent + parses metadata). Used by the detail page
        so the user can pick a file in a multi-video (academic) bundle."""
        if torrent_url in self._file_list_cache:
            return self._file_list_cache[torrent_url]
        try:
            data = await self._fetch_torrent(torrent_url)
            ti = lt.torrent_info(lt.bdecode(data))
        except Exception as e:
            logger.warning("[engine] list_video_files failed for %s: %r", torrent_url, e)
            return []
        files = ti.files()
        out: list[dict] = []
        for i in range(files.num_files()):
            path = files.file_path(i)
            _, ext = os.path.splitext(path.lower())
            if ext in VIDEO_EXTS:
                out.append({"index": i, "name": os.path.basename(path), "size": files.file_size(i)})
        out.sort(key=lambda f: f["name"].lower())
        self._file_list_cache[torrent_url] = out
        return out

    # -- lifecycle ---------------------------------------------------------

    async def ensure_download(
        self, torrent_url: str, movie_id: int, key: str, file_index: Optional[int] = None,
    ) -> DownloadHandle:
        async with self._lock:
            dh = self._handles.get(movie_id)
            if dh is not None:
                return dh
            data = await self._fetch_torrent(torrent_url)
            ti = lt.torrent_info(lt.bdecode(data))
            save_path = os.path.join(DOWNLOAD_DIR, key)
            os.makedirs(save_path, exist_ok=True)
            atp = lt.add_torrent_params()
            atp.ti = ti
            atp.save_path = save_path
            atp.storage_mode = lt.storage_mode_t.storage_mode_sparse
            handle = self._session.add_torrent(atp)
            dh = DownloadHandle(
                handle=handle, movie_id=movie_id, key=key,
                file_index=file_index, buffer_event=asyncio.Event(),
            )
            self._handles[movie_id] = dh
            logger.info("[engine] added movie_id=%s key=%s files=%s", movie_id, key, ti.num_files())
        asyncio.create_task(self._poll(dh))
        return dh

    async def wait_for_buffer(self, movie_id: int, timeout: float = 300.0) -> Optional[str]:
        dh = self._handles.get(movie_id)
        if dh is None:
            raise KeyError(movie_id)
        await asyncio.wait_for(dh.buffer_event.wait(), timeout=timeout)
        return dh.file_path

    def is_buffer_ready(self, movie_id: int) -> bool:
        dh = self._handles.get(movie_id)
        return dh is not None and dh.buffer_event.is_set()

    def target_file_path(self, movie_id: int) -> Optional[str]:
        dh = self._handles.get(movie_id)
        return dh.file_path if dh else None

    def _select_target(self, dh: DownloadHandle, files, num_files: int) -> int:
        if dh.file_index is not None and 0 <= dh.file_index < num_files:
            return dh.file_index
        largest = 0
        for i in range(num_files):
            _, ext = os.path.splitext(files.file_path(i).lower())
            if ext in VIDEO_EXTS:
                largest = max(largest, files.file_size(i))
        best_idx, best_key = -1, None
        for i in range(num_files):
            _, ext = os.path.splitext(files.file_path(i).lower())
            if ext in VIDEO_EXTS:
                k = _rank(ext, files.file_size(i), largest)
                if best_key is None or k > best_key:
                    best_key, best_idx = k, i
        return best_idx

    def resolve_video_file(self, movie_id: int) -> Optional[str]:
        """Walk the save dir for the best on-disk video (post-download recovery)."""
        dh = self._handles.get(movie_id)
        base = os.path.join(DOWNLOAD_DIR, dh.key) if dh else None
        if not base or not os.path.isdir(base):
            return None
        # Collect first so the ranking sees the largest file (sample detection).
        found: list[tuple[str, str, int]] = []
        for root, _d, files in os.walk(base):
            for f in files:
                _, ext = os.path.splitext(f.lower())
                if ext not in VIDEO_EXTS:
                    continue
                full = os.path.join(root, f)
                try:
                    found.append((full, ext, os.path.getsize(full)))
                except OSError:
                    continue
        if not found:
            return None
        largest = max(sz for _p, _e, sz in found)
        best, best_key = None, None
        for full, ext, size in found:
            k = _rank(ext, size, largest)
            if best_key is None or k > best_key:
                best_key, best = k, full
        return best

    def get_progress(self, movie_id: int) -> Optional[dict]:
        dh = self._handles.get(movie_id)
        if dh is None:
            return None
        dh.last_active = datetime.now(timezone.utc)
        try:
            s = dh.handle.status()
        except Exception:
            return None
        states = ["queued", "checking", "downloading_metadata", "downloading",
                  "finished", "seeding", "allocating", "checking_fastresume"]
        return {
            "progress": round(s.progress * 100, 1),
            "speed_kbs": round(s.download_rate / 1024, 1),
            "peers": s.num_peers,
            "status": states[s.state] if s.state < len(states) else "unknown",
            "downloaded_mb": round(s.total_done / (1024 * 1024), 1),
        }

    def is_complete(self, movie_id: int) -> bool:
        p = self.get_progress(movie_id)
        return p is not None and p.get("progress", 0) >= 100.0

    def contiguous_bytes(self, movie_id: int) -> int:
        """Bytes available as a CONTIGUOUS prefix of the target file. The
        transcode feeder can only read a contiguous run from byte 0, so gate the
        buffer on this (not total_done, which counts bytes completed anywhere)."""
        dh = self._handles.get(movie_id)
        if dh is None or dh.target_index < 0:
            return 0
        try:
            tf = dh.handle.torrent_file()
            if tf is None:
                return 0
            files = tf.files()
            piece_len = tf.piece_length()
            num_pieces = tf.num_pieces()
            idx = dh.target_index
            file_size = files.file_size(idx)
            first_piece = files.file_offset(idx) // piece_len
            last_complete = first_piece - 1
            i = first_piece
            while i < num_pieces:
                try:
                    have = dh.handle.have_piece(i)
                except Exception:
                    have = False
                if not have:
                    break
                last_complete = i
                i += 1
            if last_complete < first_piece:
                return 0
            bytes_in_file = (last_complete + 1) * piece_len - files.file_offset(idx)
            return max(0, min(bytes_in_file, file_size))
        except Exception as e:
            logger.error("[engine] contiguous_bytes error movie_id=%s: %r", movie_id, e)
            return 0

    # -- arbitrary byte-range access (drives seeking) ----------------------

    def _target_geometry(self, movie_id: int):
        """(handle, piece_len, num_pieces, file_offset, file_size) or None."""
        dh = self._handles.get(movie_id)
        if dh is None or dh.target_index < 0:
            return None
        try:
            tf = dh.handle.torrent_file()
            if tf is None:
                return None
            files = tf.files()
            return (dh.handle, tf.piece_length(), tf.num_pieces(),
                    files.file_offset(dh.target_index), files.file_size(dh.target_index))
        except Exception:
            return None

    def file_size(self, movie_id: int) -> int:
        geo = self._target_geometry(movie_id)
        return geo[4] if geo else 0

    def _piece_span(self, geo, start: int, end: int) -> tuple[int, int]:
        _h, piece_len, num_pieces, offset, size = geo
        start = max(0, min(start, max(0, size - 1)))
        end = max(start, min(end, max(0, size - 1)))
        first = (offset + start) // piece_len
        last = min((offset + end) // piece_len, num_pieces - 1)
        return first, last

    def byte_range_available(self, movie_id: int, start: int, end: int) -> bool:
        """True when every piece backing bytes [start, end] of the target file is
        on disk. This is what lets us serve an arbitrary Range from a file that
        is still downloading, instead of handing the client sparse zeros."""
        geo = self._target_geometry(movie_id)
        if geo is None:
            return False
        handle = geo[0]
        first, last = self._piece_span(geo, start, end)
        for p in range(first, last + 1):
            try:
                if not handle.have_piece(p):
                    return False
            except Exception:
                return False
        return True

    def prioritize_byte_range(self, movie_id: int, start: int, end: int) -> None:
        """Pull bytes [start, end] to the front of the download queue — this is
        how a seek to an un-downloaded position gets served quickly."""
        geo = self._target_geometry(movie_id)
        if geo is None:
            return
        handle = geo[0]
        first, last = self._piece_span(geo, start, end)
        for n, p in enumerate(range(first, last + 1)):
            try:
                handle.piece_priority(p, 7)
                handle.set_piece_deadline(p, 100 * (n + 1))
            except Exception:
                pass

    async def wait_for_range(self, movie_id: int, start: int, end: int,
                             timeout: float = 120.0) -> bool:
        """Prioritise then await a byte range. Returns False on timeout."""
        if self.byte_range_available(movie_id, start, end):
            return True
        self.prioritize_byte_range(movie_id, start, end)
        loop = asyncio.get_event_loop()
        deadline = loop.time() + timeout
        while loop.time() < deadline:
            await asyncio.sleep(0.25)
            if self.byte_range_available(movie_id, start, end):
                return True
            if not self.has_handle(movie_id):
                return False
        return False

    def wait_for_range_sync(self, movie_id: int, start: int, end: int,
                            timeout: float = 120.0) -> bool:
        """Blocking variant for use inside a threadpool-run response iterator."""
        if self.byte_range_available(movie_id, start, end):
            return True
        self.prioritize_byte_range(movie_id, start, end)
        waited = 0.0
        while waited < timeout:
            time.sleep(0.25)
            waited += 0.25
            if self.byte_range_available(movie_id, start, end):
                return True
            if not self.has_handle(movie_id):
                return False
        return False

    def has_tail(self, movie_id: int, nbytes: int = TAIL_BYTES) -> bool:
        """True when every piece covering the LAST ``nbytes`` of the target file
        is on disk — i.e. a moov-at-end MP4 is now parseable by ffmpeg reading
        the real (seekable) file."""
        dh = self._handles.get(movie_id)
        if dh is None or dh.target_index < 0:
            return False
        try:
            tf = dh.handle.torrent_file()
            if tf is None:
                return False
            files = tf.files()
            piece_len = tf.piece_length()
            num_pieces = tf.num_pieces()
            idx = dh.target_index
            start = files.file_offset(idx)
            size = files.file_size(idx)
            if size <= 0:
                return False
            tail_start_byte = start + max(0, size - nbytes)
            first = tail_start_byte // piece_len
            # size - 1 = last byte OF THIS FILE. Using +size would point at the
            # piece belonging to the NEXT file (priority 0), which may never
            # download — has_tail would then stay False forever.
            last = min((start + size - 1) // piece_len, num_pieces - 1)
            for p in range(first, last + 1):
                try:
                    if not dh.handle.have_piece(p):
                        return False
                except Exception:
                    return False
            return True
        except Exception as e:
            logger.error("[engine] has_tail error movie_id=%s: %r", movie_id, e)
            return False

    def abort(self, movie_id: int) -> None:
        dh = self._handles.pop(movie_id, None)
        if dh:
            try:
                self._session.remove_torrent(dh.handle)
            except Exception:
                pass

    async def _poll(self, dh: DownloadHandle) -> None:
        meta_done = False
        done_states = {"finished", "seeding"}
        states = ["queued", "checking", "downloading_metadata", "downloading",
                  "finished", "seeding", "allocating", "checking_fastresume"]
        tick = 0
        logger.info("[engine] poll start movie_id=%s", dh.movie_id)
        while True:
            await asyncio.sleep(POLL_INTERVAL)
            tick += 1
            try:
                s = dh.handle.status()
            except Exception as e:
                logger.error("[engine] poll status error movie_id=%s: %r", dh.movie_id, e)
                break
            state = states[s.state] if s.state < len(states) else "unknown"

            if not meta_done and s.has_metadata:
                self._on_metadata(dh)
                meta_done = True

            if dh.file_path is None and meta_done:
                dh.file_path = self.resolve_video_file(dh.movie_id)

            # Stall tracking after metadata.
            if meta_done:
                if s.num_peers == 0 and s.download_rate == 0:
                    if dh.stall_since is None:
                        dh.stall_since = datetime.now(timezone.utc)
                elif dh.stall_since is not None:
                    dh.stall_since = None

            # Abort idle stalled downloads nobody is watching.
            if (dh.stall_since is not None and not dh.buffer_event.is_set()
                    and (datetime.now(timezone.utc) - dh.last_active).total_seconds() > 120):
                logger.warning("[engine] aborting idle stalled movie_id=%s", dh.movie_id)
                self.abort(dh.movie_id)
                self._reset_db_status(dh.movie_id)
                break

            # Fire the buffer once a short contiguous prefix is present. Kept
            # small on purpose: piece deadlines keep the prefix filling ahead of
            # the playhead, so a big head start only delays playback. Enough for
            # ffmpeg to probe the container and emit the first fragments.
            if not dh.buffer_event.is_set():
                target = BUFFER_MIN_BYTES
                if s.total_wanted > 0:
                    target = min(BUFFER_MAX_BYTES, max(BUFFER_MIN_BYTES, int(s.total_wanted * 0.005)))
                if self.contiguous_bytes(dh.movie_id) >= target and dh.file_path:
                    dh.buffer_event.set()
                    logger.info("[engine] ✓ buffer ready movie_id=%s", dh.movie_id)

            if tick % 20 == 0:
                logger.info("[engine] movie_id=%s state=%s %.1f%% contig=%.1fMB %.0fKB/s peers=%d",
                            dh.movie_id, state, s.progress * 100,
                            self.contiguous_bytes(dh.movie_id) / 1e6 if meta_done else 0,
                            s.download_rate / 1024, s.num_peers)

            if state in done_states:
                if dh.file_path is None:
                    dh.file_path = self.resolve_video_file(dh.movie_id)
                if not dh.buffer_event.is_set() and dh.file_path:
                    dh.buffer_event.set()
                logger.info("[engine] complete movie_id=%s", dh.movie_id)
                break
        logger.info("[engine] poll end movie_id=%s", dh.movie_id)

    def _on_metadata(self, dh: DownloadHandle) -> None:
        try:
            dh.handle.set_sequential_download(True)
            tf = dh.handle.torrent_file()
            if not tf:
                return
            files = tf.files()
            num_files = files.num_files()
            num_pieces = tf.num_pieces()
            idx = self._select_target(dh, files, num_files)
            if idx < 0:
                logger.warning("[engine] no video file in torrent movie_id=%s", dh.movie_id)
                return
            dh.target_index = idx
            # Download only the target file (crucial for multi-file bundles).
            for i in range(num_files):
                dh.handle.file_priority(i, 7 if i == idx else 0)
            dh.file_path = os.path.join(DOWNLOAD_DIR, dh.key, files.file_path(idx))
            # Deadlines: whole target file in order (head first) + tail boosted
            # (moov/cues live at the end → needed before anything can play/seek).
            piece_len = tf.piece_length()
            size = files.file_size(idx)
            fp = files.file_offset(idx) // piece_len
            # size - 1 → last piece OF THIS FILE (must match has_tail's maths).
            lp = (files.file_offset(idx) + max(0, size - 1)) // piece_len
            for n, p in enumerate(range(fp, min(lp + 1, num_pieces))):
                try:
                    dh.handle.set_piece_deadline(p, 1000 * (n + 1))
                except Exception:
                    pass
            # Fetch the TAIL immediately and generously: a non-faststart MP4 keeps
            # its whole index (moov, easily several MB) at the very end, and
            # nothing can be decoded or probed until those bytes are on disk.
            tail_pieces = max(4, -(-TAIL_BYTES // piece_len))  # ceil division
            tail_start = max(fp, min(lp, num_pieces - 1) - tail_pieces + 1)
            for n, p in enumerate(range(tail_start, min(lp + 1, num_pieces))):
                try:
                    dh.handle.piece_priority(p, 7)
                    dh.handle.set_piece_deadline(p, 500 * (n + 1))
                except Exception:
                    pass
            logger.info("[engine] target file %d for movie_id=%s (%d MB), deadlines %d-%d",
                        idx, dh.movie_id, size // (1024 * 1024), fp, lp)
        except Exception as e:
            logger.error("[engine] metadata setup error movie_id=%s: %r", dh.movie_id, e)

    def _reset_db_status(self, movie_id: int) -> None:
        try:
            from models_db import SessionLocal
            from database import update_movie_status, MovieStatus
            db = SessionLocal()
            try:
                update_movie_status(db, movie_id, MovieStatus.pending)
            finally:
                db.close()
        except Exception as e:
            logger.error("[engine] db reset failed movie_id=%s: %r", movie_id, e)


_engine: Optional[TorrentEngine] = None


def get_engine() -> TorrentEngine:
    global _engine
    if _engine is None:
        _engine = TorrentEngine()
    return _engine
