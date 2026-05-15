import os
import shutil
import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()


async def cleanup_old_movies() -> None:
    from models_db import SessionLocal
    from database import get_movies_unwatched_since, update_movie_path, update_movie_status, MovieStatus

    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    db = SessionLocal()
    try:
        movies = get_movies_unwatched_since(db, cutoff)
        for movie in movies:
            if movie.mp4_path and os.path.exists(movie.mp4_path):
                download_dir = os.path.dirname(movie.mp4_path)
                shutil.rmtree(download_dir, ignore_errors=True)
                print(f"[Cleanup] deleted files for movie_id={movie.id} ({movie.title})")
            update_movie_path(db, movie.id, None)
            update_movie_status(db, movie.id, MovieStatus.pending)
    finally:
        db.close()


def start_scheduler() -> None:
    scheduler.add_job(
        cleanup_old_movies,
        CronTrigger(hour=3, minute=0),
        id="cleanup_old_movies",
        replace_existing=True,
    )
    scheduler.start()
    print("[Scheduler] APScheduler started (cleanup daily at 03:00)")


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
