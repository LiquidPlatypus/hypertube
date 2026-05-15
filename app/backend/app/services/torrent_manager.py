import asyncio
import os
import httpx
import libtorrent as lt
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional

DOWNLOAD_DIR = os.getenv("DOWNLOAD_DIR", "/data/movies")
MIN_BUFFER_BYTES = 30 * 1024 * 1024   # 30 MB
POLL_INTERVAL = 0.5                    # seconds

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".webm", ".mov", ".wmv", ".flv", ".ogv", ".mpeg", ".mpg", ".m4v", ".ts"}


@dataclass
class DownloadHandle:
    handle: lt.torrent_handle
    movie_id: int
    archive_id: str
    buffer_event: asyncio.Event
    file_path: Optional[str] = None
    started_at: datetime = field(default_factory=datetime.utcnow)
    stall_since: Optional[datetime] = None   # set when peers==0 and speed==0 after metadata
    last_active: datetime = field(default_factory=datetime.utcnow)  # updated on every get_progress() call


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
        print("[TorrentManager] libtorrent session started")

    def _create_session(self) -> lt.session:
        settings = {
            "listen_interfaces": "0.0.0.0:6881",
            "enable_dht": True,
            "enable_lsd": True,
            "enable_upnp": True,
            "enable_natpmp": True,
            "alert_mask": lt.alert.category_t.error_notification | lt.alert.category_t.status_notification,
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
                print(f"[TorrentManager] movie_id={movie_id} already in handles, reusing")
                return self._handles[movie_id]

            print(f"[TorrentManager] fetching .torrent from {torrent_url}")
            torrent_data = await self._fetch_torrent(torrent_url)
            print(f"[TorrentManager] .torrent fetched ({len(torrent_data)} bytes)")

            ti = lt.torrent_info(lt.bdecode(torrent_data))
            print(f"[TorrentManager] torrent_info ok — name={ti.name()!r} files={ti.num_files()} pieces={ti.num_pieces()}")

            save_path = os.path.join(DOWNLOAD_DIR, archive_id)
            os.makedirs(save_path, exist_ok=True)

            atp = lt.add_torrent_params()
            atp.ti = ti
            atp.save_path = save_path
            atp.storage_mode = lt.storage_mode_t.storage_mode_sparse

            handle = self._session.add_torrent(atp)
            print(f"[TorrentManager] torrent added to session — save_path={save_path}")

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
        return (datetime.utcnow() - dh.stall_since).total_seconds() >= threshold_seconds

    def get_progress(self, movie_id: int) -> Optional[dict]:
        dh = self._handles.get(movie_id)
        if dh is None:
            return None
        dh.last_active = datetime.utcnow()
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
        best_size = 0
        for root, _dirs, files in os.walk(base):
            for fname in files:
                _, ext = os.path.splitext(fname.lower())
                if ext in VIDEO_EXTENSIONS:
                    full = os.path.join(root, fname)
                    size = os.path.getsize(full)
                    if size > best_size:
                        best_size = size
                        best = full
        return best

    async def _poll_loop(self, dh: DownloadHandle) -> None:
        metadata_set = False
        last_log_tick = 0
        states = [
            "queued", "checking", "downloading_metadata", "downloading",
            "finished", "seeding", "allocating", "checking_fastresume",
        ]
        states_done = {"finished", "seeding"}
        tick = 0

        print(f"[TorrentManager] poll_loop started for movie_id={dh.movie_id}")

        while True:
            await asyncio.sleep(POLL_INTERVAL)
            tick += 1
            try:
                s = dh.handle.status()
            except Exception as e:
                print(f"[TorrentManager] poll_loop status error movie_id={dh.movie_id}: {e}")
                break

            state_str = states[s.state] if s.state < len(states) else "unknown"

            if not metadata_set and s.has_metadata:
                print(f"[TorrentManager] metadata ready movie_id={dh.movie_id} — enabling sequential download")
                try:
                    dh.handle.set_sequential_download(True)
                    tf = dh.handle.torrent_file()
                    if tf:
                        files = tf.files()
                        num_pieces = tf.num_pieces()

                        # For multi-file torrents: download ONLY the largest video file
                        best_idx, best_size = -1, 0
                        for i in range(files.num_files()):
                            _, ext = os.path.splitext(files.file_path(i).lower())
                            if ext in VIDEO_EXTENSIONS:
                                sz = files.file_size(i)
                                if sz > best_size:
                                    best_size, best_idx = sz, i
                        if best_idx >= 0:
                            for i in range(files.num_files()):
                                dh.handle.file_priority(i, 7 if i == best_idx else 0)
                            print(
                                f"[TorrentManager] targeting file {best_idx}: "
                                f"{files.file_path(best_idx)} ({best_size // (1024*1024)} MB)"
                            )
                        else:
                            print(f"[TorrentManager] no video file found in torrent metadata for movie_id={dh.movie_id}")

                        # Boost first 20 pieces for fast stream start
                        for i in range(min(20, num_pieces)):
                            dh.handle.piece_priority(i, 7)
                        print(f"[TorrentManager] prioritized first 20/{num_pieces} pieces")
                except Exception as e:
                    print(f"[TorrentManager] sequential setup error: {e}")
                metadata_set = True

            if dh.file_path is None and metadata_set:
                dh.file_path = self.resolve_video_file(dh.movie_id)
                if dh.file_path:
                    print(f"[TorrentManager] video file resolved: {dh.file_path}")

            # Log progress every 10 seconds
            if tick - last_log_tick >= int(10 / POLL_INTERVAL):
                mb_done = s.total_done / (1024 * 1024)
                mb_total = s.total_wanted / (1024 * 1024)
                speed_kb = s.download_rate / 1024
                print(
                    f"[TorrentManager] movie_id={dh.movie_id} state={state_str} "
                    f"{mb_done:.1f}/{mb_total:.1f} MB  {speed_kb:.0f} KB/s  "
                    f"peers={s.num_peers}  file={dh.file_path}"
                )
                last_log_tick = tick

            # Track stall: no peers and no speed after metadata is known
            if metadata_set:
                if s.num_peers == 0 and s.download_rate == 0:
                    if dh.stall_since is None:
                        dh.stall_since = datetime.utcnow()
                        print(f"[TorrentManager] stall detected movie_id={dh.movie_id} (0 peers, 0 KB/s)")
                elif dh.stall_since is not None:
                    dh.stall_since = None  # traffic resumed

            # Abort stalled downloads that nobody is watching.
            # last_active is updated by get_progress() which is called by SSE every second.
            # If no SSE has touched it for 2 minutes AND the torrent is stalled → cleanup.
            if (
                dh.stall_since is not None
                and not dh.buffer_event.is_set()
                and (datetime.utcnow() - dh.last_active).total_seconds() > 120
            ):
                stall_s = (datetime.utcnow() - dh.stall_since).total_seconds()
                print(
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
                    print(f"[TorrentManager] DB reset failed: {_e}")
                break

            if not dh.buffer_event.is_set():
                if s.total_done >= MIN_BUFFER_BYTES and dh.file_path:
                    dh.buffer_event.set()
                    print(f"[TorrentManager] ✓ buffer ready movie_id={dh.movie_id} "
                          f"({s.total_done // (1024*1024)} MB downloaded)")

            if state_str in states_done:
                print(f"[TorrentManager] download complete movie_id={dh.movie_id} state={state_str}")
                if dh.file_path is None:
                    dh.file_path = self.resolve_video_file(dh.movie_id)
                if not dh.buffer_event.is_set() and dh.file_path:
                    dh.buffer_event.set()
                break

        print(f"[TorrentManager] poll_loop ended for movie_id={dh.movie_id}")

    def abort_download(self, movie_id: int) -> None:
        dh = self._handles.pop(movie_id, None)
        if dh:
            try:
                self._session.remove_torrent(dh.handle)
            except Exception:
                pass

    @staticmethod
    async def _fetch_torrent(url: str) -> bytes:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
            return r.content
