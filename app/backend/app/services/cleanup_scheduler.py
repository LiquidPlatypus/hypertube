import logging
import os
import shutil
import datetime
from datetime import timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# Quota config — read at scheduler start (env). Default 50 GB.
MAX_DOWNLOAD_GB = float(os.getenv("MAX_DOWNLOAD_GB", "50"))
DOWNLOAD_DIR = os.getenv("DOWNLOAD_DIR", "/data/movies")


async def cleanup_old_movies() -> None:
    from models_db import SessionLocal
    from database import get_movies_unwatched_since, update_movie_path, update_movie_status, MovieStatus
    from services.torrent_manager import TorrentManager

    tm = TorrentManager()
    now = datetime.datetime.now(timezone.utc)
    cutoff = now - datetime.timedelta(days=30)
    grace = now - datetime.timedelta(minutes=60)
    db = SessionLocal()
    try:
        movies = get_movies_unwatched_since(db, cutoff)
        for movie in movies:
            # Interlock #1: skip if a libtorrent handle is still active for this movie.
            if movie.id in tm._handles:
                logger.info(f"[Cleanup] skipping movie_id={movie.id} ({movie.title}) — active torrent handle")
                continue
            # Interlock #2: 60-min grace window vs. recent viewers (defensive — the
            # 30-day cutoff already excludes recently-watched movies, but a clock
            # skew or partial DB update could slip something through).
            lw = getattr(movie, "last_watched", None)
            if lw is not None and lw > grace:
                logger.info(f"[Cleanup] skipping movie_id={movie.id} ({movie.title}) — last_watched within 60 min")
                continue

            if movie.mp4_path and os.path.exists(movie.mp4_path):
                download_dir = os.path.dirname(movie.mp4_path)
                shutil.rmtree(download_dir, ignore_errors=True)
                logger.info(f"[Cleanup] deleted files for movie_id={movie.id} ({movie.title})")
            update_movie_path(db, movie.id, None)
            update_movie_status(db, movie.id, MovieStatus.pending)
    finally:
        db.close()


def _dir_size_bytes(path: str) -> int:
    """Sum total file sizes under ``path``. Returns 0 if path missing."""
    total = 0
    if not os.path.isdir(path):
        return 0
    for root, _dirs, files in os.walk(path):
        for fname in files:
            full = os.path.join(root, fname)
            try:
                total += os.path.getsize(full)
            except OSError:
                pass
    return total


async def evict_until_under_quota() -> None:
    """Evict least-recently-watched ready movies until DOWNLOAD_DIR is under
    MAX_DOWNLOAD_GB. Skips movies with active torrent handles.

    Movies with ``last_watched IS NULL`` sort first (treated as oldest).
    Runs hourly, independent of the 30-day cleanup.
    """
    from models_db import SessionLocal
    from database import Movie, MovieStatus, update_movie_path, update_movie_status
    from services.torrent_manager import TorrentManager

    quota_bytes = int(MAX_DOWNLOAD_GB * 1024 * 1024 * 1024)
    used = _dir_size_bytes(DOWNLOAD_DIR)
    if used <= quota_bytes:
        return

    logger.warning(
        f"[Quota] DOWNLOAD_DIR over quota: "
        f"{used / (1024**3):.2f} GB used > {MAX_DOWNLOAD_GB:.2f} GB limit — evicting"
    )

    tm = TorrentManager()
    db = SessionLocal()
    try:
        # Oldest-first: NULL last_watched first (never watched), then ascending.
        candidates = (
            db.query(Movie)
            .filter(Movie.mp4_path != None)
            .filter(Movie.status == MovieStatus.ready)
            .order_by(Movie.last_watched.is_(None).desc(), Movie.last_watched.asc())
            .all()
        )
        for movie in candidates:
            if used <= quota_bytes:
                break
            if movie.id in tm._handles:
                logger.info(f"[Quota] skipping movie_id={movie.id} ({movie.title}) — active handle")
                continue
            if not movie.mp4_path:
                continue
            download_dir = os.path.dirname(movie.mp4_path)
            freed = _dir_size_bytes(download_dir) if os.path.isdir(download_dir) else 0
            if os.path.exists(download_dir):
                shutil.rmtree(download_dir, ignore_errors=True)
            update_movie_path(db, movie.id, None)
            update_movie_status(db, movie.id, MovieStatus.pending)
            used -= freed
            logger.info(
                f"[Quota] evicted movie_id={movie.id} ({movie.title}) — "
                f"freed {freed / (1024**2):.1f} MB; now {used / (1024**3):.2f} GB"
            )
    finally:
        db.close()

    if used > quota_bytes:
        logger.warning(
            f"[Quota] still over quota after eviction: "
            f"{used / (1024**3):.2f} GB used > {MAX_DOWNLOAD_GB:.2f} GB"
        )


def start_scheduler() -> None:
    scheduler.add_job(
        cleanup_old_movies,
        CronTrigger(hour=3, minute=0),
        id="cleanup_old_movies",
        replace_existing=True,
    )
    scheduler.add_job(
        evict_until_under_quota,
        IntervalTrigger(hours=1),
        id="evict_until_under_quota",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[Scheduler] APScheduler started (cleanup daily at 03:00, quota check hourly)")


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
