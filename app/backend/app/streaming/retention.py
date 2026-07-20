"""Retention (subject III.3: delete a movie's files if unwatched for a month,
keep the DB row) + optional disk-quota eviction. Runs under APScheduler.

Interlocks: never purge a movie with an active torrent handle, and honour a
short grace window against very-recent views.
"""
from __future__ import annotations

import datetime
import logging
import os
import shutil
from datetime import timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

MAX_DOWNLOAD_GB = float(os.getenv("MAX_DOWNLOAD_GB", "50"))
DOWNLOAD_DIR = os.getenv("DOWNLOAD_DIR", "/data/movies")

_scheduler = AsyncIOScheduler()


def _dir_size(path: str) -> int:
    total = 0
    if not os.path.isdir(path):
        return 0
    for root, _d, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


async def purge_unwatched() -> None:
    from models_db import SessionLocal
    from database import get_movies_unwatched_since, update_movie_path, update_movie_status, MovieStatus
    from .torrent_engine import get_engine

    engine = get_engine()
    now = datetime.datetime.now(timezone.utc)
    cutoff = now - datetime.timedelta(days=30)
    grace = now - datetime.timedelta(minutes=60)
    db = SessionLocal()
    try:
        for movie in get_movies_unwatched_since(db, cutoff):
            if engine.has_handle(movie.id):
                continue
            lw = getattr(movie, "last_watched", None)
            ls = getattr(movie, "last_streamed_at", None)
            if (lw and lw > grace) or (ls and ls > grace):
                continue
            if movie.mp4_path and os.path.exists(movie.mp4_path):
                shutil.rmtree(os.path.dirname(movie.mp4_path), ignore_errors=True)
                logger.info("[retention] purged files movie_id=%s (%s)", movie.id, movie.title)
            update_movie_path(db, movie.id, None)
            update_movie_status(db, movie.id, MovieStatus.pending)
    finally:
        db.close()


async def evict_over_quota() -> None:
    from models_db import SessionLocal
    from database import Movie, MovieStatus, update_movie_path, update_movie_status
    from .torrent_engine import get_engine

    quota = int(MAX_DOWNLOAD_GB * 1024 ** 3)
    used = _dir_size(DOWNLOAD_DIR)
    if used <= quota:
        return
    logger.warning("[retention] over quota: %.2f/%.2f GB — evicting", used / 1024 ** 3, MAX_DOWNLOAD_GB)
    engine = get_engine()
    db = SessionLocal()
    try:
        candidates = (
            db.query(Movie)
            .filter(Movie.mp4_path != None, Movie.status == MovieStatus.ready)
            .order_by(Movie.last_streamed_at.is_(None).desc(), Movie.last_streamed_at.asc())
            .all()
        )
        for movie in candidates:
            if used <= quota:
                break
            if engine.has_handle(movie.id) or not movie.mp4_path:
                continue
            folder = os.path.dirname(movie.mp4_path)
            freed = _dir_size(folder)
            shutil.rmtree(folder, ignore_errors=True)
            update_movie_path(db, movie.id, None)
            update_movie_status(db, movie.id, MovieStatus.pending)
            used -= freed
            logger.info("[retention] evicted movie_id=%s, freed %.1f MB", movie.id, freed / 1024 ** 2)
    finally:
        db.close()


def start_scheduler() -> None:
    _scheduler.add_job(purge_unwatched, CronTrigger(hour=3, minute=0),
                       id="purge_unwatched", replace_existing=True)
    _scheduler.add_job(evict_over_quota, IntervalTrigger(hours=1),
                       id="evict_over_quota", replace_existing=True)
    _scheduler.start()
    logger.info("[retention] scheduler started (purge 03:00 daily, quota hourly)")


def stop_scheduler() -> None:
    try:
        _scheduler.shutdown(wait=False)
    except Exception:
        pass
