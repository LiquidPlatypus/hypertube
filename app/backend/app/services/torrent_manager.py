import asyncio
import logging
import os
import httpx
import libtorrent as lt
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional

logger = logging.getLogger(__name__)

DOWNLOAD_DIR = os.getenv("DOWNLOAD_DIR", "/data/movies")
MIN_BUFFER_BYTES = 30 * 1024 * 1024   # 30 MB
POLL_INTERVAL = 0.5                    # seconds

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".webm", ".mov", ".wmv", ".flv", ".ogv", ".mpeg", ".mpg", ".m4v", ".ts"}
# Browser-native containers — preferred when an item bundles several encodings
# (Archive.org commonly ships an original .avi/.mkv AND a derived .mp4). Picking
# the .mp4 lets the stream endpoint use the zero-CPU direct path instead of FFmpeg.
DIRECT_EXTENSIONS = {".mp4", ".webm"}


def _target_key(ext: str, size: int) -> tuple:
    """Ranking key for choosing the file to stream: prefer a browser-native
    container first, then larger size. Compared with tuple ordering, so a direct
    file always outranks a non-direct one regardless of size."""
    return (1 if ext in DIRECT_EXTENSIONS else 0, size)


@dataclass
class DownloadHandle:
    handle: lt.torrent_handle
    movie_id: int
    archive_id: str
    buffer_event: asyncio.Event
    file_path: Optional[str] = None
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    stall_since: Optional[datetime] = None   # set when peers==0 and speed==0 after metadata
    last_active: datetime = field(default_factory=lambda: datetime.now(timezone.utc))  # updated on every get_progress() call


class TorrentManager:
    _instance: Optional["TorrentManager"] = None

    def __new__(cls) -> "TorrentManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._session: lt.session = self._create_session()
        self._handles: Dict[int, DownloadHandle] = {}
        self._lock = asyncio.Lock()
        self._initialized = True
        logger.info("[TorrentManager] libtorrent session started")

    def _create_session(self) -> lt.session:
        settings = {
            "listen_interfaces": "0.0.0.0:6881",
            "enable_dht": True,
            "enable_lsd": True,
            "enable_upnp": True,
            "enable_natpmp": True,
            "alert_mask": (
                lt.alert.category_t.error_notification
                | lt.alert.category_t.status_notification
                | lt.alert.category_t.storage_notification  # save_resume_data_alert
            ),
            # Archive.org .torrent files embed url-list HTTP seeds; allow up to 4 connections
            "max_web_seed_connections": 4,
        }
        return lt.session(settings)

    async def start_download(
        self,
        torrent_url: str,
        movie_id: int,
        archive_id: str,
    ) -> DownloadHandle:
        async with self._lock:
            if movie_id in self._handles:
                logger.info(f"[TorrentManager] movie_id={movie_id} already in handles, reusing")
                return self._handles[movie_id]

            logger.info(f"[TorrentManager] fetching .torrent from {torrent_url}")
            torrent_data = await self._fetch_torrent(torrent_url)
            logger.info(f"[TorrentManager] .torrent fetched ({len(torrent_data)} bytes)")

            ti = lt.torrent_info(lt.bdecode(torrent_data))
            logger.info(f"[TorrentManager] torrent_info ok — name={ti.name()!r} files={ti.num_files()} pieces={ti.num_pieces()}")

            save_path = os.path.join(DOWNLOAD_DIR, archive_id)
            os.makedirs(save_path, exist_ok=True)

            atp = lt.add_torrent_params()
            atp.ti = ti
            atp.save_path = save_path
            atp.storage_mode = lt.storage_mode_t.storage_mode_sparse

            # Resume fast-path: if we persisted resume data on a previous run,
            # load it so libtorrent skips the full piece recheck of files still
            # on disk. Any failure (corrupt file, version mismatch) falls back to
            # a plain add — at worst a recheck, never a crash.
            resume_file = os.path.join(save_path, ".resume")
            if os.path.isfile(resume_file):
                try:
                    with open(resume_file, "rb") as f:
                        buf = f.read()
                    ratp = lt.read_resume_data(buf)
                    ratp.ti = ti
                    ratp.save_path = save_path
                    ratp.storage_mode = lt.storage_mode_t.storage_mode_sparse
                    atp = ratp
                    logger.info(f"[TorrentManager] loaded resume data for movie_id={movie_id}")
                except Exception as e:
                    logger.warning(f"[TorrentManager] resume load failed movie_id={movie_id}: {e}")

            handle = self._session.add_torrent(atp)
            logger.info(f"[TorrentManager] torrent added to session — save_path={save_path}")

            dh = DownloadHandle(
                handle=handle,
                movie_id=movie_id,
                archive_id=archive_id,
                buffer_event=asyncio.Event(),
            )
            self._handles[movie_id] = dh

        asyncio.create_task(self._poll_loop(dh))
        return dh

    async def wait_for_buffer(self, movie_id: int, timeout: float = 300.0) -> str:
        dh = self._handles.get(movie_id)
        if dh is None:
            raise KeyError(f"No active download for movie_id={movie_id}")
        await asyncio.wait_for(dh.buffer_event.wait(), timeout=timeout)
        return dh.file_path

    def is_buffer_ready(self, movie_id: int) -> bool:
        dh = self._handles.get(movie_id)
        return dh is not None and dh.buffer_event.is_set()

    def is_stalled(self, movie_id: int, threshold_seconds: float = 60.0) -> bool:
        dh = self._handles.get(movie_id)
        if dh is None or dh.stall_since is None:
            return False
        return (datetime.now(timezone.utc) - dh.stall_since).total_seconds() >= threshold_seconds

    def get_progress(self, movie_id: int) -> Optional[dict]:
        dh = self._handles.get(movie_id)
        if dh is None:
            return None
        dh.last_active = datetime.now(timezone.utc)
        try:
            s = dh.handle.status()
            states = [
                "queued", "checking", "downloading_metadata", "downloading",
                "finished", "seeding", "allocating", "checking_fastresume",
            ]
            state_str = states[s.state] if s.state < len(states) else "unknown"
            return {
                "progress": round(s.progress * 100, 1),
                "speed_kbs": round(s.download_rate / 1024, 1),
                "peers": s.num_peers,
                "status": state_str,
                "downloaded_mb": round(s.total_done / (1024 * 1024), 1),
            }
        except Exception:
            return None

    def resolve_video_file(self, movie_id: int) -> Optional[str]:
        dh = self._handles.get(movie_id)
        if dh is None:
            return None
        base = os.path.join(DOWNLOAD_DIR, dh.archive_id)
        best: Optional[str] = None
        best_key = (-1, -1)
        for root, _dirs, files in os.walk(base):
            for fname in files:
                _, ext = os.path.splitext(fname.lower())
                if ext not in VIDEO_EXTENSIONS:
                    continue
                full = os.path.join(root, fname)
                try:
                    size = os.path.getsize(full)
                except OSError:
                    continue
                key = _target_key(ext, size)
                if key > best_key:
                    best_key = key
                    best = full
        return best

    def contiguous_bytes(self, movie_id: int) -> int:
        """Return the number of bytes available as a contiguous prefix of the
        TARGET video file (largest selected file).

        libtorrent's ``total_done`` counts completed bytes anywhere in the
        torrent. With sparse storage + brief out-of-order writes the FIFO
        feeder could otherwise read zero-padded holes. This walks the piece
        bitfield from the file's first piece and returns the byte count
        within the file that is safely contiguous.
        """
        dh = self._handles.get(movie_id)
        if dh is None:
            return 0
        try:
            tf = dh.handle.torrent_file()
            if tf is None:
                return 0
            files = tf.files()
            piece_length = tf.piece_length()
            num_pieces = tf.num_pieces()

            # Pick the target file: prefer a browser-native container, then size.
            # Must match the file chosen in _poll_loop / resolve_video_file.
            target_idx, target_size = -1, 0
            target_key = (-1, -1)
            for i in range(files.num_files()):
                _, ext = os.path.splitext(files.file_path(i).lower())
                if ext in VIDEO_EXTENSIONS:
                    sz = files.file_size(i)
                    key = _target_key(ext, sz)
                    if key > target_key:
                        target_key, target_size, target_idx = key, sz, i
            if target_idx < 0:
                return 0

            # Piece range covered by the target file. map_file(file, offset, size)
            # returns a peer_request with .piece (start piece) and length.
            try:
                pr = files.map_file(target_idx, 0, target_size)
                first_piece = int(pr.piece)
            except Exception:
                first_piece = 0
            # Offset of the file within its first piece (file may not start at piece boundary).
            file_offset_in_first_piece = files.file_offset(target_idx) % piece_length

            # Walk pieces starting at first_piece; stop at first missing.
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

            # Bytes from the start of the file through the end of last_complete.
            # End-of-piece byte (in torrent stream) = (last_complete + 1) * piece_length
            # Start of file (in torrent stream)     = files.file_offset(target_idx)
            stream_end = (last_complete + 1) * piece_length
            file_stream_start = files.file_offset(target_idx)
            bytes_in_file = stream_end - file_stream_start
            if bytes_in_file < 0:
                return 0
            # Adjust if file starts mid-piece: first piece's leading bytes belong
            # to the previous file, so subtract that slack.
            # (file_stream_start = first_piece*piece_length + file_offset_in_first_piece,
            #  so stream_end - file_stream_start already accounts for the slack.)
            _ = file_offset_in_first_piece  # kept for clarity / future debug
            return min(bytes_in_file, target_size)
        except Exception as e:
            logger.error(f"[TorrentManager] contiguous_bytes error movie_id={movie_id}: {e}")
            return 0

    async def _poll_loop(self, dh: DownloadHandle) -> None:
        metadata_set = False
        last_log_tick = 0
        states = [
            "queued", "checking", "downloading_metadata", "downloading",
            "finished", "seeding", "allocating", "checking_fastresume",
        ]
        states_done = {"finished", "seeding"}
        tick = 0

        logger.info(f"[TorrentManager] poll_loop started for movie_id={dh.movie_id}")

        while True:
            await asyncio.sleep(POLL_INTERVAL)
            tick += 1
            try:
                s = dh.handle.status()
            except Exception as e:
                logger.error(f"[TorrentManager] poll_loop status error movie_id={dh.movie_id}: {e}")
                break

            state_str = states[s.state] if s.state < len(states) else "unknown"

            if not metadata_set and s.has_metadata:
                logger.info(f"[TorrentManager] metadata ready movie_id={dh.movie_id} — enabling sequential download")
                try:
                    dh.handle.set_sequential_download(True)
                    tf = dh.handle.torrent_file()
                    if tf:
                        files = tf.files()
                        num_pieces = tf.num_pieces()

                        # For multi-file torrents: download ONLY the target video file.
                        # Prefer a browser-native container (.mp4/.webm) so the stream
                        # endpoint can serve it directly without transcoding; fall back
                        # to the largest video file otherwise.
                        best_idx, best_size = -1, 0
                        best_key = (-1, -1)
                        for i in range(files.num_files()):
                            _, ext = os.path.splitext(files.file_path(i).lower())
                            if ext in VIDEO_EXTENSIONS:
                                sz = files.file_size(i)
                                key = _target_key(ext, sz)
                                if key > best_key:
                                    best_key, best_size, best_idx = key, sz, i
                        if best_idx >= 0:
                            for i in range(files.num_files()):
                                dh.handle.file_priority(i, 7 if i == best_idx else 0)
                            # Pin the stream target from torrent metadata — deterministic
                            # and available immediately. Resolving from the disk walk
                            # instead races libtorrent's file allocation order and can
                            # latch onto a non-preferred sibling (e.g. a sparse .avi)
                            # before the .mp4 is created, forcing a needless transcode.
                            dh.file_path = os.path.join(
                                DOWNLOAD_DIR, dh.archive_id, files.file_path(best_idx)
                            )
                            logger.info(
                                f"[TorrentManager] targeting file {best_idx}: "
                                f"{files.file_path(best_idx)} ({best_size // (1024*1024)} MB)"
                            )
                        else:
                            logger.warning(f"[TorrentManager] no video file found in torrent metadata for movie_id={dh.movie_id}")

                        # Boost first 20 pieces for fast stream start
                        for i in range(min(20, num_pieces)):
                            dh.handle.piece_priority(i, 7)
                        logger.info(f"[TorrentManager] prioritized first 20/{num_pieces} pieces")
                except Exception as e:
                    logger.error(f"[TorrentManager] sequential setup error: {e}")
                metadata_set = True

            if dh.file_path is None and metadata_set:
                dh.file_path = self.resolve_video_file(dh.movie_id)
                if dh.file_path:
                    logger.info(f"[TorrentManager] video file resolved: {dh.file_path}")

            # Log progress every 10 seconds
            if tick - last_log_tick >= int(10 / POLL_INTERVAL):
                mb_done = s.total_done / (1024 * 1024)
                mb_total = s.total_wanted / (1024 * 1024)
                speed_kb = s.download_rate / 1024
                logger.info(
                    f"[TorrentManager] movie_id={dh.movie_id} state={state_str} "
                    f"{mb_done:.1f}/{mb_total:.1f} MB  {speed_kb:.0f} KB/s  "
                    f"peers={s.num_peers}  file={dh.file_path}"
                )
                last_log_tick = tick

            # Track stall: no peers and no speed after metadata is known
            if metadata_set:
                if s.num_peers == 0 and s.download_rate == 0:
                    if dh.stall_since is None:
                        dh.stall_since = datetime.now(timezone.utc)
                        logger.warning(f"[TorrentManager] stall detected movie_id={dh.movie_id} (0 peers, 0 KB/s)")
                elif dh.stall_since is not None:
                    dh.stall_since = None  # traffic resumed

            # Abort stalled downloads that nobody is watching.
            # last_active is updated by get_progress() which is called by SSE every second.
            # If no SSE has touched it for 2 minutes AND the torrent is stalled → cleanup.
            if (
                dh.stall_since is not None
                and not dh.buffer_event.is_set()
                and (datetime.now(timezone.utc) - dh.last_active).total_seconds() > 120
            ):
                stall_s = (datetime.now(timezone.utc) - dh.stall_since).total_seconds()
                logger.warning(
                    f"[TorrentManager] aborting idle stalled download movie_id={dh.movie_id} "
                    f"(stalled {stall_s:.0f}s, no watcher for 2+ min)"
                )
                self.abort_download(dh.movie_id)
                # Reset DB status so next visit retries from scratch
                try:
                    from models_db import SessionLocal
                    from database import update_movie_status, MovieStatus
                    _db = SessionLocal()
                    try:
                        update_movie_status(_db, dh.movie_id, MovieStatus.pending)
                    finally:
                        _db.close()
                except Exception as _e:
                    logger.error(f"[TorrentManager] DB reset failed: {_e}")
                break

            if not dh.buffer_event.is_set():
                # Adaptive buffer: a fixed 30 MB forces small movies to download a
                # big fraction (e.g. 11% of a 270 MB file) before the player shows.
                # Use 4% of the target file, floored at 8 MB (enough for the fmp4
                # transcode to get going) and capped at MIN_BUFFER_BYTES for big files.
                buffer_target = MIN_BUFFER_BYTES
                if s.total_wanted > 0:
                    buffer_target = min(MIN_BUFFER_BYTES, max(8 * 1024 * 1024, int(s.total_wanted * 0.04)))
                if s.total_done >= buffer_target and dh.file_path:
                    dh.buffer_event.set()
                    logger.info(f"[TorrentManager] ✓ buffer ready movie_id={dh.movie_id} "
                                f"({s.total_done // (1024*1024)} MB / target {buffer_target // (1024*1024)} MB)")

            if state_str in states_done:
                logger.info(f"[TorrentManager] download complete movie_id={dh.movie_id} state={state_str}")
                if dh.file_path is None:
                    dh.file_path = self.resolve_video_file(dh.movie_id)
                if not dh.buffer_event.is_set() and dh.file_path:
                    dh.buffer_event.set()
                # Persist resume data so a future run skips the recheck.
                await self._persist_resume(dh)
                break

        logger.info(f"[TorrentManager] poll_loop ended for movie_id={dh.movie_id}")

    async def _persist_resume(self, dh: DownloadHandle) -> None:
        """Save libtorrent resume data to ``<save_path>/.resume`` so a later run
        can skip rechecking files already on disk. Best-effort: any failure is
        logged and ignored (the next run just rechecks)."""
        try:
            dh.handle.save_resume_data()
        except Exception as e:
            logger.warning(f"[TorrentManager] save_resume_data call failed movie_id={dh.movie_id}: {e}")
            return
        loop = asyncio.get_event_loop()
        deadline = loop.time() + 10.0
        while loop.time() < deadline:
            for a in self._session.pop_alerts():
                if isinstance(a, lt.save_resume_data_alert):
                    try:
                        buf = lt.write_resume_data_buf(a.params)
                    except Exception:
                        try:
                            buf = lt.bencode(a.resume_data)
                        except Exception:
                            buf = None
                    if buf:
                        path = os.path.join(DOWNLOAD_DIR, dh.archive_id, ".resume")
                        try:
                            with open(path, "wb") as f:
                                f.write(buf)
                            logger.info(f"[TorrentManager] resume data saved for movie_id={dh.movie_id}")
                        except OSError as e:
                            logger.warning(f"[TorrentManager] resume write failed movie_id={dh.movie_id}: {e}")
                    return
                if isinstance(a, lt.save_resume_data_failed_alert):
                    logger.warning(f"[TorrentManager] resume data failed movie_id={dh.movie_id}")
                    return
            await asyncio.sleep(0.2)

    def abort_download(self, movie_id: int) -> None:
        dh = self._handles.pop(movie_id, None)
        if dh:
            try:
                self._session.remove_torrent(dh.handle)
            except Exception:
                pass

    @staticmethod
    async def _fetch_torrent(url: str, attempts: int = 4) -> bytes:
        """Fetch a .torrent, retrying transient failures. Archive.org's CDN
        mirrors intermittently 500/503 on the redirected download URL; a single
        failure must not doom the whole stream. Retries 5xx and network errors
        with exponential backoff; 4xx fails fast (genuinely missing torrent)."""
        last_exc: Optional[Exception] = None
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            for attempt in range(attempts):
                try:
                    r = await client.get(url)
                    r.raise_for_status()
                    return r.content
                except httpx.HTTPStatusError as e:
                    last_exc = e
                    if e.response.status_code < 500:
                        raise  # 4xx — no point retrying
                    logger.warning(
                        f"[TorrentManager] .torrent fetch {e.response.status_code} "
                        f"(attempt {attempt + 1}/{attempts}) for {url}"
                    )
                except httpx.HTTPError as e:
                    last_exc = e
                    logger.warning(
                        f"[TorrentManager] .torrent fetch error "
                        f"(attempt {attempt + 1}/{attempts}) for {url}: {e}"
                    )
                if attempt < attempts - 1:
                    await asyncio.sleep(0.5 * (2 ** attempt))
        assert last_exc is not None
        raise last_exc
