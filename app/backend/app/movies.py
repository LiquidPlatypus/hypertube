import asyncio
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from typing import Optional, List

logger = logging.getLogger(__name__)

from email.utils import formatdate

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse
from starlette.background import BackgroundTask

from database import (
    Movie, MovieStatus,
    create_or_get_movie, get_movie_by_archive_id, get_movie_by_id,
    get_popular_movies,
    mark_movie_watched, update_movie_path, update_movie_status, update_movie_tmdb,
)
from models_db import get_db
from services.archive_client import get_thumbnail_url, get_torrent_url, search_archive
from services.subtitle_service import fetch_subtitles, get_subtitle_path, list_available_subtitles
from services.tmdb_client import get_genres as tmdb_get_genres, search_tmdb
from services.torrent_manager import TorrentManager, DOWNLOAD_DIR, VIDEO_EXTENSIONS

router = APIRouter()
torrent_manager = TorrentManager()


def _is_file_complete(path: str, min_ratio: float = 0.99) -> bool:
    """True when ``path`` is fully materialised on disk (not sparse). libtorrent
    pre-allocates the full nominal size as a sparse file while downloading; the
    block count only catches up to the byte count once all pieces have landed.
    """
    try:
        st = os.stat(path)
    except OSError:
        return False
    if st.st_size <= 0:
        return False
    return (st.st_blocks * 512) >= st.st_size * min_ratio


def _find_existing_video(archive_id: str) -> Optional[str]:
    """Walk DOWNLOAD_DIR/<archive_id> looking for a complete video file from a prior
    run. Skips sparse files (incomplete torrent leftovers). Prefers a browser-native
    container (.mp4/.webm) over a larger non-direct sibling so we keep the zero-CPU
    direct path; falls back to the largest complete video otherwise."""
    base = os.path.join(DOWNLOAD_DIR, archive_id)
    if not os.path.isdir(base):
        return None
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
            if not _is_file_complete(full):
                continue
            key = (1 if ext in VIDEO_DIRECT else 0, size)
            if key > best_key:
                best_key, best = key, full
    return best

# Semaphore to avoid hammering TMDb (40 req/10s on free tier)
_tmdb_sem = asyncio.Semaphore(5)

VIDEO_DIRECT       = {".mp4", ".webm"}
VIDEO_TRANSCODE    = {".mkv", ".avi", ".mov", ".wmv", ".flv"}
CHUNK_DIRECT       = 1 * 1024 * 1024   # 1 MB
CHUNK_TRANSCODE    = 64 * 1024          # 64 KB

# Tracks active FFmpeg processes by file_path — prevents concurrent transcodes of finished files
_active_transcodes: dict[str, subprocess.Popen] = {}
FFMPEG_NOISE = (
    "invalid as first byte of an EBML number",
    "EBML header parsing failed",
    "Error opening input file",
    "Error submitting packet to decoder",
    "Invalid data found when processing input",
    "Last message repeated",
)

# Codecs the browser <video> tag can play natively inside a fragmented MP4. When
# the source already uses these, we remux (stream-copy) instead of re-encoding —
# orders of magnitude cheaper on CPU and lossless. Anything else is re-encoded.
BROWSER_VCODECS = {"h264", "avc1"}
BROWSER_ACODECS = {"aac"}


def _probe_codecs(file_path: str) -> tuple[Optional[str], Optional[str]]:
    """Return ``(video_codec, audio_codec)`` of the first video/audio stream via
    ffprobe, or ``(None, None)`` if the probe fails. Used to decide remux vs.
    re-encode. Safe on partially-downloaded files — failure just falls back to
    a full re-encode."""
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "stream=codec_type,codec_name",
                "-of", "json", file_path,
            ],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20,
        )
        data = json.loads(out.stdout or b"{}")
    except Exception as e:
        logger.warning(f"[FFprobe] codec probe failed for {file_path}: {e}")
        return None, None
    vcodec = acodec = None
    for s in data.get("streams", []):
        if s.get("codec_type") == "video" and vcodec is None:
            vcodec = s.get("codec_name")
        elif s.get("codec_type") == "audio" and acodec is None:
            acodec = s.get("codec_name")
    return vcodec, acodec


def _ffmpeg_codec_args(file_path: str) -> list[str]:
    """Build the ``-c:v``/``-c:a`` portion of the FFmpeg command. Stream-copies
    browser-native codecs (remux only) and re-encodes the rest. Returns args
    suitable to splice into the fragmented-MP4 command."""
    vcodec, acodec = _probe_codecs(file_path)
    if vcodec in BROWSER_VCODECS:
        vargs = ["-c:v", "copy"]
    else:
        vargs = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-g", "50"]
    if acodec is None:
        aargs: list[str] = []  # no audio stream to map
    elif acodec in BROWSER_ACODECS:
        aargs = ["-c:a", "copy"]
    else:
        aargs = ["-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000"]
    logger.info(f"[FFmpeg] codec plan for {file_path}: v={vcodec}->{vargs[1]} a={acodec}->{aargs[1] if aargs else 'none'}")
    return vargs + aargs


# Cache of source media duration (seconds), keyed by file path. Used to turn the
# FFmpeg `-progress` out_time into a real percentage of the movie.
_duration_cache: dict[str, Optional[float]] = {}


def _probe_duration(file_path: str) -> Optional[float]:
    """Total duration of the media in seconds via ffprobe, cached. Returns None
    if unknown (e.g. container without a header duration). Works on a partially
    downloaded file as long as the container declares duration up front (mkv/mp4)."""
    if file_path in _duration_cache:
        return _duration_cache[file_path]
    dur: Optional[float] = None
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                file_path,
            ],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20,
        )
        dur = float((out.stdout or b"").strip())
        if dur <= 0:
            dur = None
    except Exception:
        dur = None
    _duration_cache[file_path] = dur
    return dur


def _ffmpeg_progress_args(file_path: str) -> list[str]:
    """FFmpeg args that stream machine-readable progress to a sidecar file. Pair
    with ``_read_ffmpeg_progress`` for a live percentage + transcode speed."""
    return ["-nostats", "-progress", file_path + ".fmp4.prog"]


def _read_ffmpeg_progress(file_path: str) -> dict:
    """Parse the latest block of the FFmpeg ``-progress`` sidecar into a dict.
    FFmpeg appends ``key=value`` blocks; later values win, so a flat parse keeps
    the most recent reading for each key."""
    try:
        with open(file_path + ".fmp4.prog", "r", encoding="utf-8", errors="replace") as f:
            txt = f.read()
    except OSError:
        return {}
    out: dict = {}
    for line in txt.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def _terminate_process(process: subprocess.Popen, timeout: float = 2.0) -> None:
    """SIGTERM, wait up to timeout, escalate to SIGKILL. Never blocks indefinitely."""
    if process.poll() is not None:
        return
    try:
        process.terminate()
    except Exception:
        pass
    try:
        process.wait(timeout=timeout)
        return
    except subprocess.TimeoutExpired:
        pass
    except Exception:
        return
    try:
        process.kill()
    except Exception:
        pass
    try:
        process.wait(timeout=timeout)
    except Exception:
        pass


def reap_orphan_transcodes() -> None:
    """Remove stale ``*.fmp4.tmp`` files from prior crashed runs.

    A ``.tmp`` without a matching ``.done`` marker means the writer died mid-stream;
    keeping it tricks future tail-readers into waiting on a file that will never grow.
    """
    if not os.path.isdir(DOWNLOAD_DIR):
        return
    removed = 0
    for root, _dirs, files in os.walk(DOWNLOAD_DIR):
        for fname in files:
            if not fname.endswith(".fmp4.tmp"):
                continue
            tmp = os.path.join(root, fname)
            done = tmp[:-len(".tmp")] + ".done"
            if os.path.exists(done):
                continue
            try:
                os.unlink(tmp)
                removed += 1
            except OSError:
                pass
    if removed:
        logger.info(f"[startup] removed {removed} orphan .fmp4.tmp file(s)")


# ---------------------------------------------------------------------------
# Helper : serialize a Movie row for list views
# ---------------------------------------------------------------------------

def _movie_thumbnail(movie: Movie, db: Session) -> dict:
    return {
        "id": movie.id,
        "archive_id": movie.archive_id,
        "title": movie.title,
        "year": movie.year,
        "poster_url": movie.poster_url or get_thumbnail_url(movie.archive_id),
        "rating": movie.rating,
        "genres": json.loads(movie.genres_json) if movie.genres_json else [],
        "watched": bool(movie.mp4_path and (movie.watch_count or 0) > 0),
        "status": movie.status,
    }


async def _enrich_movie(movie_id: int, title: str, year: Optional[int]) -> None:
    """Fire-and-forget TMDb enrichment for a single movie."""
    from models_db import SessionLocal
    async with _tmdb_sem:
        tmdb = await search_tmdb(title, year)
        if not tmdb:
            return
        db = SessionLocal()
        try:
            update_movie_tmdb(db, movie_id, {
                "tmdb_id":   tmdb.tmdb_id,
                "poster_url": tmdb.poster_url,
                "overview":  tmdb.overview,
                "rating":    tmdb.rating,
                "runtime":   tmdb.runtime,
                "genres":    tmdb.genres,
                "cast":      tmdb.cast,
            })
        finally:
            db.close()


async def enrich_movies_background(movies: list) -> None:
    """Enrich a list of (id, title, year) tuples that have no poster yet."""
    tasks = [
        asyncio.create_task(_enrich_movie(m_id, title, year))
        for m_id, title, year in movies
    ]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


def _movie_detail(movie: Movie) -> dict:
    genres = json.loads(movie.genres_json) if movie.genres_json else []
    cast   = json.loads(movie.cast_json)   if movie.cast_json   else []
    return {
        "id": movie.id,
        "archive_id": movie.archive_id,
        "title": movie.title,
        "year": movie.year,
        "overview": movie.overview,
        "poster_url": movie.poster_url or get_thumbnail_url(movie.archive_id),
        "rating": movie.rating,
        "runtime": movie.runtime,
        "genres": genres,
        "cast": cast,
        "status": movie.status,
        "watched": bool(movie.mp4_path and (movie.watch_count or 0) > 0),
    }


# ---------------------------------------------------------------------------
# GET /api/movies — library / search
# ---------------------------------------------------------------------------

@router.get("/api/movies")
async def list_movies(
        query: Optional[str]  = Query(None),
        page: int             = Query(1, ge=1),
        page_size: int        = Query(20, ge=1, le=100),
        sort: Optional[str]   = Query(None),
        genre: Optional[str]  = Query(None),
        year_from: Optional[int] = Query(None),
        year_to: Optional[int]   = Query(None),
        min_rating: Optional[float] = Query(None),
        db: Session = Depends(get_db),
):
    if query:
        archive_movies = await search_archive(query=query, page=page, page_size=page_size)
        page_movies_objs = []
        for am in archive_movies:
            movie = create_or_get_movie(db, am.identifier, am.title, am.year)
            page_movies_objs.append(movie)
        results = [_movie_thumbnail(m, db) for m in page_movies_objs]
    else:
        # No query: serve from DB (pre-seeded at startup)
        movies = get_popular_movies(db, limit=page_size * page)
        offset = page_size * (page - 1)
        page_movies_objs = movies[offset:offset + page_size]
        if not page_movies_objs:
            # DB empty (seeding failed) — fall back to live Archive.org call
            logger.warning("[list_movies] DB empty, falling back to live Archive.org search")
            archive_movies = await search_archive(query=None, page=page, page_size=page_size)
            page_movies_objs = []
            for am in archive_movies:
                movie = create_or_get_movie(db, am.identifier, am.title, am.year)
                page_movies_objs.append(movie)
        results = [_movie_thumbnail(m, db) for m in page_movies_objs]

    # Trigger background TMDb enrichment for movies without poster
    need_enrich = [
        (m.id, m.title, m.year)
        for m in page_movies_objs
        if not m.poster_url and not m.tmdb_id
    ]
    if need_enrich:
        asyncio.create_task(enrich_movies_background(need_enrich))

    # Apply client-side filters on DB results
    if min_rating is not None:
        results = [r for r in results if r["rating"] is not None and r["rating"] >= min_rating]
    if year_from is not None:
        results = [r for r in results if r["year"] is not None and r["year"] >= year_from]
    if year_to is not None:
        results = [r for r in results if r["year"] is not None and r["year"] <= year_to]
    if genre:
        # Case-insensitive match against the movie's TMDb genres. Movies whose
        # genres aren't enriched yet (empty list) are excluded from a genre query.
        g = genre.strip().lower()
        results = [r for r in results if any(g == (x or "").lower() for x in r.get("genres", []))]

    # Sorting. Explicit sort param wins; otherwise the subject requires search
    # results to be ordered by name (III.2.1), so default a query to title_asc.
    if sort is None and query:
        sort = "title_asc"
    if sort == "rating_desc":
        results.sort(key=lambda r: r["rating"] or 0, reverse=True)
    elif sort == "rating_asc":
        results.sort(key=lambda r: r["rating"] or 0)
    elif sort == "year_desc":
        results.sort(key=lambda r: r["year"] or 0, reverse=True)
    elif sort == "year_asc":
        results.sort(key=lambda r: r["year"] or 0)
    elif sort == "title_asc":
        results.sort(key=lambda r: (r["title"] or "").lower())

    return results


# ---------------------------------------------------------------------------
# GET /api/movies/{archive_id} — detail page
# ---------------------------------------------------------------------------

@router.get("/api/movies/{archive_id}")
async def get_movie(archive_id: str, db: Session = Depends(get_db)):
    movie = get_movie_by_archive_id(db, archive_id)
    if not movie:
        # Try to create it on the fly from Archive.org search
        archive_results = await search_archive(query=archive_id, page=1, page_size=1)
        if not archive_results:
            raise HTTPException(status_code=404, detail="Movie not found")
        am = archive_results[0]
        movie = create_or_get_movie(db, am.identifier, am.title, am.year)

    # Enrich with TMDb if not yet done
    if movie.tmdb_id is None:
        tmdb = await search_tmdb(movie.title, movie.year)
        if tmdb:
            update_movie_tmdb(db, movie.id, {
                "tmdb_id":   tmdb.tmdb_id,
                "poster_url": tmdb.poster_url,
                "overview":  tmdb.overview,
                "rating":    tmdb.rating,
                "runtime":   tmdb.runtime,
                "genres":    tmdb.genres,
                "cast":      tmdb.cast,
            })
            db.refresh(movie)

    # Fetch subtitles in background (best-effort, don't block response)
    asyncio.create_task(fetch_subtitles(
        archive_id=movie.archive_id,
        title=movie.title,
        year=movie.year,
        languages=["en"],
    ))

    subtitles = await list_available_subtitles(movie.archive_id)
    detail = _movie_detail(movie)
    detail["subtitles"] = subtitles
    return detail


# ---------------------------------------------------------------------------
# GET /api/stream/{movie_id} — streaming endpoint
# ---------------------------------------------------------------------------

@router.get("/api/stream/{movie_id}")
async def stream_movie(movie_id: int, request: Request, db: Session = Depends(get_db)):
    movie = get_movie_by_id(db, movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    logger.info(f"[Stream] movie_id={movie_id} title={movie.title!r} status={movie.status} mp4_path={movie.mp4_path}")

    # Case 1: already downloaded
    if movie.status == MovieStatus.ready and movie.mp4_path and os.path.isfile(movie.mp4_path):
        logger.info(f"[Stream] serving from disk: {movie.mp4_path}")
        mark_movie_watched(db, movie_id)
        return _serve(movie.mp4_path, request)

    # Case 1b: file exists on disk from a prior run but DB lost the path/status
    # (e.g. cleanup reset, container rebuild). Only trigger when no active torrent
    # handle exists — otherwise libtorrent's sparse-allocated file (full nominal
    # size, with holes) would be misread as complete.
    if movie_id not in torrent_manager._handles:
        existing = _find_existing_video(movie.archive_id)
        if existing:
            logger.info(f"[Stream] existing file found on disk, skipping torrent: {existing}")
            update_movie_path(db, movie_id, existing)
            update_movie_status(db, movie_id, MovieStatus.ready)
            mark_movie_watched(db, movie_id)
            return _serve(existing, request)

    # Case 2: currently downloading by another request — join the wait
    if movie.status == MovieStatus.downloading:
        logger.info(f"[Stream] joining existing download for movie_id={movie_id}")
        try:
            file_path = await torrent_manager.wait_for_buffer(movie_id, timeout=300.0)
        except asyncio.TimeoutError:
            logger.warning(f"[Stream] timeout waiting for buffer movie_id={movie_id}")
            update_movie_status(db, movie_id, MovieStatus.failed)
            raise HTTPException(status_code=503, detail="torrent_timeout")
        if file_path and os.path.isfile(file_path):
            _, fext = os.path.splitext(file_path.lower())
            logger.info(f"[Stream] buffer ready (joined), serving: {file_path}")
            mark_movie_watched(db, movie_id)
            # Serve raw bytes only when the file is fully on disk. A direct .mp4
            # that's still downloading may have its moov atom at the end (no
            # faststart) — the leading bytes alone are undecodable. Route the
            # incomplete case through the fmp4 remux (cheap -c copy) which emits
            # a moov-front fragmented stream playable progressively.
            if fext in VIDEO_DIRECT and _is_file_complete(file_path):
                update_movie_path(db, movie_id, file_path)
                update_movie_status(db, movie_id, MovieStatus.ready)
                return _stream_direct(file_path, request)
            else:
                update_movie_path(db, movie_id, file_path)
                asyncio.create_task(_finalize_when_done(movie_id, file_path))
                _start_growing_fmp4_writer(file_path, movie_id)
                return _serve_fmp4_growing(file_path, request)

    # Case 3: not started / previously failed
    logger.info(f"[Stream] starting new download for movie_id={movie_id} archive_id={movie.archive_id}")
    torrent_url = movie.torrent_url
    if not torrent_url:
        logger.info(f"[Stream] fetching torrent URL from Archive.org for {movie.archive_id}")
        torrent_url = await get_torrent_url(movie.archive_id)
        if not torrent_url:
            logger.error(f"[Stream] ERROR: no torrent found for {movie.archive_id}")
            raise HTTPException(status_code=422, detail="No torrent available for this movie")
        logger.info(f"[Stream] torrent URL: {torrent_url}")
        m = db.query(Movie).filter(Movie.id == movie_id).first()
        if m:
            m.torrent_url = torrent_url
            db.commit()

    update_movie_status(db, movie_id, MovieStatus.downloading)

    try:
        await torrent_manager.start_download(torrent_url, movie_id, movie.archive_id)
    except Exception as e:
        logger.error(f"[Stream] ERROR starting download movie_id={movie_id}: {e}")
        update_movie_status(db, movie_id, MovieStatus.failed)
        raise HTTPException(status_code=500, detail=f"Download error: {e}")

    logger.info(f"[Stream] waiting for 30 MB buffer movie_id={movie_id}…")
    try:
        file_path = await torrent_manager.wait_for_buffer(movie_id, timeout=300.0)
    except (asyncio.TimeoutError, KeyError):
        logger.warning(f"[Stream] timeout (300s) waiting for buffer movie_id={movie_id}")
        update_movie_status(db, movie_id, MovieStatus.failed)
        raise HTTPException(status_code=503, detail="torrent_timeout")

    if not file_path:
        file_path = torrent_manager.resolve_video_file(movie_id)

    if not file_path or not os.path.isfile(file_path):
        logger.error(f"[Stream] ERROR: no video file found after download for movie_id={movie_id}")
        update_movie_status(db, movie_id, MovieStatus.failed)
        raise HTTPException(status_code=503, detail="Video file not found after download")

    _, fext = os.path.splitext((file_path or "").lower())
    logger.info(f"[Stream] 30 MB buffer ready, serving: {file_path}")
    mark_movie_watched(db, movie_id)
    # Raw direct serve only when complete (see Case 2 note on moov placement).
    if fext in VIDEO_DIRECT and _is_file_complete(file_path):
        update_movie_path(db, movie_id, file_path)
        update_movie_status(db, movie_id, MovieStatus.ready)
        return _stream_direct(file_path, request)
    else:
        update_movie_path(db, movie_id, file_path)
        asyncio.create_task(_finalize_when_done(movie_id, file_path))
        _start_growing_fmp4_writer(file_path, movie_id)
        return _serve_fmp4_growing(file_path, request)


async def _ensure_pipeline_started(movie_id: int) -> None:
    """Idempotently kick off whatever's needed for the movie to become playable:
    fetch torrent URL, start download, or trigger fmp4 precompute. Safe to call
    repeatedly from SSE polling loop.
    """
    from models_db import SessionLocal
    db = SessionLocal()
    try:
        movie = get_movie_by_id(db, movie_id)
        if movie is None:
            return

        # Already-downloaded path: precompute cache for non-direct formats.
        # Only trust ``ready`` when the file is actually fully on disk — a sparse
        # libtorrent allocation will fool ffprobe and cause transcode failures.
        if (
                movie.status == MovieStatus.ready
                and movie.mp4_path
                and os.path.isfile(movie.mp4_path)
                and _is_file_complete(movie.mp4_path)
        ):
            ext = os.path.splitext(movie.mp4_path.lower())[1]
            if ext and ext not in VIDEO_DIRECT:
                _precompute_fmp4_cache(movie.mp4_path)
            return

        # DB says ready but file is sparse / missing — downgrade so the rest of
        # this function takes the download-resume path.
        if movie.status == MovieStatus.ready:
            update_movie_status(db, movie_id, MovieStatus.downloading)
            logger.warning(
                f"[SSE] movie_id={movie_id} marked ready but file incomplete; "
                f"re-triggering download"
            )

        # Recover a stray file on disk if DB lost the link — only counts when
        # the file is fully materialised.
        if movie_id not in torrent_manager._handles:
            existing = _find_existing_video(movie.archive_id)
            if existing:
                update_movie_path(db, movie_id, existing)
                update_movie_status(db, movie_id, MovieStatus.ready)
                ext = os.path.splitext(existing.lower())[1]
                if ext and ext not in VIDEO_DIRECT:
                    _precompute_fmp4_cache(existing)
                return

        if movie_id in torrent_manager._handles:
            return  # torrent already running

        torrent_url = movie.torrent_url
        if not torrent_url:
            torrent_url = await get_torrent_url(movie.archive_id)
            if not torrent_url:
                logger.error(f"[SSE] no torrent for {movie.archive_id}")
                update_movie_status(db, movie_id, MovieStatus.failed)
                return
            m = db.query(Movie).filter(Movie.id == movie_id).first()
            if m:
                m.torrent_url = torrent_url
                db.commit()

        update_movie_status(db, movie_id, MovieStatus.downloading)
        try:
            await torrent_manager.start_download(torrent_url, movie_id, movie.archive_id)
            asyncio.create_task(_finalize_when_done(movie_id, ""))
        except Exception as e:
            logger.error(f"[SSE] start_download failed for movie_id={movie_id}: {e}")
            update_movie_status(db, movie_id, MovieStatus.failed)
    finally:
        db.close()


async def _finalize_when_done(movie_id: int, file_path: str) -> None:
    """Background task: when the torrent finishes, mark the movie as ready in DB
    and (for non-direct formats) kick off the fmp4 precompute so the SSE-driven
    overlay can show transcode progress instead of dropping the user onto a
    half-baked stream."""
    deadline = asyncio.get_event_loop().time() + 3600.0
    while asyncio.get_event_loop().time() < deadline:
        progress = torrent_manager.get_progress(movie_id)
        if progress is None or progress["status"] in ("finished", "seeding") or progress["progress"] >= 100:
            from models_db import SessionLocal
            _db = SessionLocal()
            try:
                resolved = torrent_manager.resolve_video_file(movie_id) or file_path
                update_movie_path(_db, movie_id, resolved)
                update_movie_status(_db, movie_id, MovieStatus.ready)
                logger.info(f"[Stream] movie_id={movie_id} finalized: status=ready path={resolved}")
            finally:
                _db.close()
            ext = os.path.splitext((resolved or "").lower())[1]
            if ext and ext not in VIDEO_DIRECT:
                _precompute_fmp4_cache(resolved)
            return
        await asyncio.sleep(5.0)


# ---------------------------------------------------------------------------
# stream_direct — for .mp4 / .webm  (Range support)
# ---------------------------------------------------------------------------

def _media_type(path: str) -> str:
    ext = os.path.splitext(path.lower())[1]
    return "video/webm" if ext == ".webm" else "video/mp4"


_RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


def _range_not_satisfiable(file_size: int) -> StreamingResponse:
    """Return a 416 response with Content-Range: bytes */<size>."""
    return StreamingResponse(
        iter([b""]),
        status_code=416,
        headers={
            "Content-Range": f"bytes */{file_size}",
            "Accept-Ranges": "bytes",
        },
    )


def _stream_direct(file_path: str, request: Request) -> Response:
    stat = os.stat(file_path)
    file_size = stat.st_size
    # ETag derived from size+mtime — invalidates whenever the file changes on disk.
    etag = f'"{stat.st_size:x}-{int(stat.st_mtime):x}"'
    last_modified = formatdate(stat.st_mtime, usegmt=True)  # RFC1123
    cache_headers = {
        "ETag": etag,
        "Cache-Control": "private, max-age=3600",
        "Last-Modified": last_modified,
    }

    # Conditional GET: short-circuit if client already has this representation.
    inm = request.headers.get("If-None-Match")
    if inm and inm.strip() == etag:
        return Response(status_code=304, headers=cache_headers)

    range_header = request.headers.get("Range")

    if range_header:
        m = _RANGE_RE.match(range_header.strip())
        if not m:
            return _range_not_satisfiable(file_size)
        start_str, end_str = m.group(1), m.group(2)

        # Suffix range: bytes=-N  → last N bytes
        if start_str == "" and end_str == "":
            return _range_not_satisfiable(file_size)
        if start_str == "":
            try:
                suffix_len = int(end_str)
            except ValueError:
                return _range_not_satisfiable(file_size)
            if suffix_len <= 0:
                return _range_not_satisfiable(file_size)
            suffix_len = min(suffix_len, file_size)
            start = file_size - suffix_len
            end = file_size - 1
        else:
            try:
                start = int(start_str)
                end = int(end_str) if end_str else file_size - 1
            except ValueError:
                return _range_not_satisfiable(file_size)
            if start >= file_size or start < 0 or end < start:
                return _range_not_satisfiable(file_size)
            end = min(end, file_size - 1)

        length = end - start + 1

        def _iter_range():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(CHUNK_DIRECT, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            _iter_range(),
            status_code=206,
            media_type=_media_type(file_path),
            headers={
                "Content-Range":  f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges":  "bytes",
                "Content-Length": str(length),
                **cache_headers,
            },
        )

    def _iter_full():
        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(CHUNK_DIRECT)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        _iter_full(),
        media_type=_media_type(file_path),
        headers={
            "Accept-Ranges":  "bytes",
            "Content-Length": str(file_size),
            **cache_headers,
        },
    )


# ---------------------------------------------------------------------------
# stream_transcoded_static — full-file transcode (no FIFO, file is complete)
# ---------------------------------------------------------------------------
#
# Concurrent-viewer strategy (P2.13):
#   1. If a sibling ``<file_path>.fmp4`` + ``<file_path>.fmp4.done`` marker exist,
#      the file has already been transcoded — serve it via ``_stream_direct``
#      so the client gets Range, ETag, Cache-Control for free.
#   2. Otherwise we acquire ``_static_transcode_locks[file_path]``:
#        - winner spawns FFmpeg, tees its stdout to ``<file_path>.fmp4.tmp``
#          AND yields it to its own client. On EOF, atomically rename
#          ``.tmp -> .fmp4`` and touch ``.fmp4.done``.
#        - losers tail ``<file_path>.fmp4.tmp`` (file may not exist yet —
#          poll up to a few seconds for it to appear) until the ``.done``
#          marker is created AND EOF is reached.
#   3. This eliminates the 503 the old implementation returned for any
#      simultaneous request, and amortises CPU: only one FFmpeg per file
#      regardless of viewer count.

# Per-file writer lock: only one concurrent FFmpeg per source file. Readers
# tail the in-progress ``.fmp4.tmp`` file. threading.Lock is fine — the
# contention window is just the writer/reader decision.
_static_transcode_writer_locks: dict[str, "threading.Lock"] = {}
# Per-file cooldown: monotonic timestamp until which transcode retry is refused
# after a recent failure. Prevents browser-spam loops when ffmpeg fails to
# produce output (corrupt source, missing codec, etc).
_transcode_fail_until: dict[str, float] = {}
TRANSCODE_FAIL_COOLDOWN = 30.0  # seconds

# Bytes of fmp4 buffered before the SSE overlay yields control to the <video> tag.
# Needs to be large enough to cover moov + a few GOPs so playback starts smoothly
# without immediate re-buffering, but small enough that the user doesn't wait
# minutes for the first frame on slow torrents.
FMP4_READY_BYTES = 8 * 1024 * 1024  # 8 MB


def _fmp4_paths(file_path: str) -> tuple[str, str, str]:
    return file_path + ".fmp4", file_path + ".fmp4.tmp", file_path + ".fmp4.done"


def _fmp4_state_idle(file_path: str) -> bool:
    """True when the fmp4 has enough buffered output for playback to start —
    either the cache is fully built, or the in-progress .tmp has crossed
    FMP4_READY_BYTES."""
    fmp4_path, tmp_path, done_marker = _fmp4_paths(file_path)
    if os.path.isfile(fmp4_path) and os.path.isfile(done_marker):
        return True
    try:
        return os.path.getsize(tmp_path) >= FMP4_READY_BYTES
    except OSError:
        return False


def _fmp4_progress_event(file_path: str) -> dict:
    """SSE payload describing the in-progress fmp4 build (status=`transcoding`).

    Prefers FFmpeg's real progress (encoded time / total duration + speed). Falls
    back to output-bytes-vs-ready-threshold when duration or progress is unknown.
    """
    _fmp4_path, tmp_path, _done_marker = _fmp4_paths(file_path)
    prog = _read_ffmpeg_progress(file_path)
    duration = _probe_duration(file_path)

    out_us = None
    try:
        out_us = int(prog["out_time_us"])
    except (KeyError, ValueError):
        try:
            out_us = int(prog["out_time_ms"]) * 1000  # older ffmpeg names it _ms (still µs)
        except (KeyError, ValueError):
            out_us = None

    if out_us is not None and duration and duration > 0:
        pct = min(99.0, (out_us / 1_000_000) / duration * 100.0)
        speed = prog.get("speed", "").rstrip("x")
        try:
            speed_x = round(float(speed), 1) if speed and speed != "N/A" else None
        except ValueError:
            speed_x = None
        return {
            "status": "transcoding",
            "progress": round(pct, 1),
            "speed_x": speed_x,
            "transcoded_sec": round(out_us / 1_000_000),
        }

    # Fallback: output bytes vs the ready threshold (no duration available).
    try:
        tmp_size = os.path.getsize(tmp_path) if os.path.exists(tmp_path) else 0
    except OSError:
        tmp_size = 0
    pct = min(99.0, (tmp_size / FMP4_READY_BYTES) * 100.0) if tmp_size else 0.0
    return {
        "status": "transcoding",
        "progress": round(pct, 1),
        "transcoded_mb": tmp_size // (1024 * 1024),
    }


def _precompute_fmp4_cache(file_path: str) -> bool:
    """Trigger background FFmpeg transcode of ``file_path`` -> cached fmp4.

    Idempotent. Returns True when a worker is now running (or was already running);
    False when nothing to do (cache present, file missing, cooldown active).
    """
    if not file_path or not os.path.isfile(file_path):
        return False
    fmp4_path, tmp_path, done_marker = _fmp4_paths(file_path)
    if os.path.isfile(fmp4_path) and os.path.isfile(done_marker):
        return False
    fail_until = _transcode_fail_until.get(file_path, 0.0)
    if time.monotonic() < fail_until:
        return False
    lock = _static_transcode_writer_locks.setdefault(file_path, threading.Lock())
    if not lock.acquire(blocking=False):
        return True  # already running

    def _run() -> None:
        proc: Optional[subprocess.Popen] = None
        try:
            try:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            except OSError:
                pass
            cmd = [
                "ffmpeg", "-y",
                "-fflags", "+genpts+discardcorrupt+igndts",
                "-err_detect", "ignore_err",
                "-analyzeduration", "5000000",
                "-probesize", "5000000",
                "-i", file_path,
                "-map", "0:V:0",
                "-map", "0:a:0?",
                *_ffmpeg_codec_args(file_path),
                "-sn",
                "-f", "mp4",
                "-movflags", "frag_keyframe+empty_moov+default_base_moof",
                "-loglevel", "warning",
                *_ffmpeg_progress_args(file_path),
                tmp_path,
            ]
            logger.info(f"[FFmpeg] precomputing fmp4 cache for {file_path}")
            try:
                proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            except Exception as e:
                logger.error(f"[FFmpeg] precompute Popen failed for {file_path}: {e}")
                _transcode_fail_until[file_path] = time.monotonic() + TRANSCODE_FAIL_COOLDOWN
                return
            _active_transcodes[file_path] = proc
            assert proc.stderr is not None
            for line in proc.stderr:
                msg = line.decode(errors="replace").strip()
                if msg and not any(noise in msg for noise in FFMPEG_NOISE):
                    logger.warning(f"[FFmpeg] {msg}")
            proc.wait()
            success = (
                    proc.returncode == 0
                    and os.path.exists(tmp_path)
                    and os.path.getsize(tmp_path) > 0
            )
            if success:
                try:
                    os.replace(tmp_path, fmp4_path)
                    with open(done_marker, "wb"):
                        pass
                    _transcode_fail_until.pop(file_path, None)
                    logger.info(
                        f"[FFmpeg] precompute done: {fmp4_path} "
                        f"({os.path.getsize(fmp4_path)} bytes)"
                    )
                except OSError as e:
                    logger.error(f"[FFmpeg] precompute finalize failed: {e}")
                    _transcode_fail_until[file_path] = time.monotonic() + TRANSCODE_FAIL_COOLDOWN
            else:
                if os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
                _transcode_fail_until[file_path] = time.monotonic() + TRANSCODE_FAIL_COOLDOWN
                logger.error(
                    f"[FFmpeg] precompute failed for {file_path} "
                    f"rc={proc.returncode if proc else 'n/a'}"
                )
        finally:
            if proc is not None:
                _active_transcodes.pop(file_path, None)
            try:
                lock.release()
            except RuntimeError:
                pass

    threading.Thread(target=_run, daemon=True).start()
    return True


def _start_growing_fmp4_writer(file_path: str, movie_id: int) -> bool:
    """Spawn a background FFmpeg that reads the still-downloading torrent file
    via a FIFO (so it never sees sparse-hole zeros) and writes fragmented MP4
    to ``<file_path>.fmp4.tmp``. On success: rename .tmp -> .fmp4 + touch .done.

    Shares the static writer lock so any concurrent caller (SSE polling, stream
    endpoint tailing) sees a single in-progress output and a single FFmpeg.

    Idempotent. Returns True if a worker is now running (newly started or
    already in flight), False if there's nothing to do.
    """
    if not file_path or not os.path.isfile(file_path):
        return False
    fmp4_path, tmp_path, done_marker = _fmp4_paths(file_path)
    if os.path.isfile(fmp4_path) and os.path.isfile(done_marker):
        return False
    fail_until = _transcode_fail_until.get(file_path, 0.0)
    if time.monotonic() < fail_until:
        return False
    lock = _static_transcode_writer_locks.setdefault(file_path, threading.Lock())
    if not lock.acquire(blocking=False):
        return True  # already running

    fifo_dir = tempfile.mkdtemp(prefix="ht_grow_")
    fifo_path = os.path.join(fifo_dir, f"ht_{movie_id}.fifo")
    try:
        os.mkfifo(fifo_path, mode=0o600)
    except OSError as e:
        shutil.rmtree(fifo_dir, ignore_errors=True)
        try:
            lock.release()
        except RuntimeError:
            pass
        logger.error(f"[FFmpeg] grow mkfifo failed for movie_id={movie_id}: {e}")
        return False

    feeder_stop = threading.Event()

    def _feed() -> None:
        # Same contiguous-bytes feeder used by _stream_transcoded_growing:
        # only forward bytes we actually have, never read sparse holes.
        try:
            with open(fifo_path, "wb") as fifo, open(file_path, "rb") as src:
                offset = 0
                safe_limit = 0
                last_check = 0.0
                while not feeder_stop.is_set():
                    now = time.monotonic()
                    if now - last_check >= 0.25 or offset >= safe_limit:
                        try:
                            file_total = os.path.getsize(file_path)
                        except OSError:
                            break
                        prog = torrent_manager.get_progress(movie_id)
                        done = (
                                prog is None
                                or prog["status"] in ("finished", "seeding")
                                or prog.get("progress", 0) >= 100.0
                        )
                        safe_limit = file_total if done else torrent_manager.contiguous_bytes(movie_id)
                        last_check = now
                        if offset >= safe_limit and done:
                            break
                    if offset < safe_limit:
                        to_read = min(65536, safe_limit - offset)
                        src.seek(offset)
                        chunk = src.read(to_read)
                        if chunk:
                            try:
                                fifo.write(chunk)
                                fifo.flush()
                            except BrokenPipeError:
                                break
                            offset += len(chunk)
                    else:
                        time.sleep(0.2)
        except Exception as e:
            logger.error(f"[FFmpeg] grow feeder error movie_id={movie_id}: {e}")

    def _run() -> None:
        proc: Optional[subprocess.Popen] = None
        try:
            try:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            except OSError:
                pass
            cmd = [
                "ffmpeg", "-y",
                "-fflags", "+genpts+discardcorrupt+igndts",
                "-err_detect", "ignore_err",
                "-analyzeduration", "5000000",
                "-probesize", "5000000",
                "-i", fifo_path,
                "-map", "0:V:0",
                "-map", "0:a:0?",
                # Probe the real on-disk file (FFmpeg input is the FIFO, which
                # ffprobe can't seek); codecs are identical either way.
                *_ffmpeg_codec_args(file_path),
                "-sn",
                "-f", "mp4",
                "-movflags", "frag_keyframe+empty_moov+default_base_moof",
                "-loglevel", "warning",
                *_ffmpeg_progress_args(file_path),
                tmp_path,
            ]
            logger.info(f"[FFmpeg] growing fmp4 writer for movie_id={movie_id} {file_path} via FIFO")
            try:
                proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            except Exception as e:
                logger.error(f"[FFmpeg] grow Popen failed: {e}")
                _transcode_fail_until[file_path] = time.monotonic() + TRANSCODE_FAIL_COOLDOWN
                return
            _active_transcodes[file_path] = proc
            # Start the feeder AFTER Popen — FFmpeg's open(fifo, 'r') must be ready
            # so our writer-side open(fifo, 'wb') doesn't block forever.
            threading.Thread(target=_feed, daemon=True).start()
            assert proc.stderr is not None
            for line in proc.stderr:
                msg = line.decode(errors="replace").strip()
                if msg and not any(noise in msg for noise in FFMPEG_NOISE):
                    logger.warning(f"[FFmpeg] {msg}")
            proc.wait()
            success = (
                    proc.returncode == 0
                    and os.path.exists(tmp_path)
                    and os.path.getsize(tmp_path) > 0
            )
            if success:
                try:
                    os.replace(tmp_path, fmp4_path)
                    with open(done_marker, "wb"):
                        pass
                    _transcode_fail_until.pop(file_path, None)
                    logger.info(
                        f"[FFmpeg] grow done: {fmp4_path} ({os.path.getsize(fmp4_path)} bytes)"
                    )
                except OSError as e:
                    logger.error(f"[FFmpeg] grow finalize failed: {e}")
                    _transcode_fail_until[file_path] = time.monotonic() + TRANSCODE_FAIL_COOLDOWN
            else:
                if os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
                _transcode_fail_until[file_path] = time.monotonic() + TRANSCODE_FAIL_COOLDOWN
                logger.error(
                    f"[FFmpeg] grow failed for movie_id={movie_id} "
                    f"rc={proc.returncode if proc else 'n/a'}"
                )
        finally:
            feeder_stop.set()
            if proc is not None:
                _active_transcodes.pop(file_path, None)
            try:
                os.unlink(fifo_path)
            except Exception:
                pass
            try:
                shutil.rmtree(fifo_dir, ignore_errors=True)
            except Exception:
                pass
            try:
                lock.release()
            except RuntimeError:
                pass

    threading.Thread(target=_run, daemon=True).start()
    return True


def _tail_file_iter(tmp_path: str, done_marker: str, chunk_size: int = CHUNK_TRANSCODE):
    """Generator that tails ``tmp_path`` and yields chunks until the done marker
    is present AND we've read past EOF. Sync generator (run inside StreamingResponse).
    """
    # Wait up to 10s for the writer to create the tmp file.
    waited = 0.0
    while not os.path.exists(tmp_path) and waited < 10.0:
        if os.path.exists(done_marker):
            # Writer finished before we got here — the final file should exist already.
            return
        time.sleep(0.1)
        waited += 0.1
    if not os.path.exists(tmp_path):
        return

    with open(tmp_path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if chunk:
                yield chunk
                continue
            # EOF reached. If writer is finished, we're done.
            if os.path.exists(done_marker):
                # Drain any final bytes in case writer flushed after our last read.
                final = f.read(chunk_size)
                while final:
                    yield final
                    final = f.read(chunk_size)
                return
            time.sleep(0.2)


def _stream_transcoded_static(file_path: str, request: Request) -> Response:
    """Transcode a fully-downloaded non-mp4/webm file to fragmented MP4.

    Caches the transcoded output as ``<file_path>.fmp4`` so subsequent viewers
    get a cheap Range-capable served file. While the first viewer triggers the
    transcode, concurrent viewers tail the partially-written ``.tmp`` file.
    Last writer atomically renames ``.tmp -> .fmp4`` and creates a
    ``.fmp4.done`` marker.
    """
    fmp4_path, tmp_path, done_marker = _fmp4_paths(file_path)

    # Fast path: cached transcoded output already exists.
    if os.path.isfile(fmp4_path) and os.path.isfile(done_marker):
        logger.info(f"[FFmpeg] serving cached fmp4 for {file_path}")
        return _stream_direct(fmp4_path, request)

    # Failure cooldown: recent transcode failed — refuse for a while so the
    # browser <video> element stops retry-spamming the endpoint.
    fail_until = _transcode_fail_until.get(file_path, 0.0)
    if time.monotonic() < fail_until:
        logger.warning(
            f"[FFmpeg] transcode in cooldown ({fail_until - time.monotonic():.0f}s left) for {file_path}"
        )
        raise HTTPException(status_code=502, detail="transcode_failed_cooldown")

    lock = _static_transcode_writer_locks.setdefault(file_path, threading.Lock())
    is_writer = lock.acquire(blocking=False)

    if not is_writer:
        # Someone else is already transcoding — tail their .tmp file.
        logger.info(f"[FFmpeg] tailing in-progress transcode for {file_path}")
        # If by the time we get here the writer already finished, fall back to direct.
        if os.path.isfile(fmp4_path) and os.path.isfile(done_marker):
            return _stream_direct(fmp4_path, request)
        return StreamingResponse(
            _tail_file_iter(tmp_path, done_marker),
            media_type="video/mp4",
            headers={"Cache-Control": "no-cache"},
        )

    # We are the writer.
    _, ext = os.path.splitext(file_path.lower())
    logger.info(f"[FFmpeg] transcoding (static, cached) {file_path} (ext={ext}) -> {fmp4_path}")

    # Clean any stale .tmp from a previous crashed run.
    try:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
    except OSError:
        pass

    cmd = [
        "ffmpeg",
        "-fflags", "+genpts+discardcorrupt+igndts",
        "-err_detect", "ignore_err",
        "-analyzeduration", "5000000",
        "-probesize", "5000000",
        "-i", file_path,
        "-map", "0:V:0",
        "-map", "0:a:0?",
        *_ffmpeg_codec_args(file_path),
        "-sn",
        "-f", "mp4",
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-loglevel", "warning",
        *_ffmpeg_progress_args(file_path),
        "pipe:1",
    ]

    try:
        process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0
        )
    except Exception as e:
        lock.release()
        logger.error(f"[FFmpeg] Popen failed (static) for {file_path}: {e}")
        raise HTTPException(status_code=500, detail="ffmpeg_spawn_failed")
    _active_transcodes[file_path] = process

    try:
        out_fh = open(tmp_path, "wb")
    except OSError as e:
        _terminate_process(process)
        _active_transcodes.pop(file_path, None)
        lock.release()
        logger.error(f"[FFmpeg] open tmp failed for {file_path}: {e}")
        raise HTTPException(status_code=500, detail="tmp_open_failed")

    state = {"bytes": 0, "cleaned": False}

    def _log_stderr():
        for line in process.stderr:
            msg = line.decode(errors="replace").strip()
            if msg and not any(noise in msg for noise in FFMPEG_NOISE):
                logger.warning(f"[FFmpeg] {msg}")

    threading.Thread(target=_log_stderr, daemon=True).start()

    def _cleanup() -> None:
        # Idempotent — runs from BackgroundTask after response ends OR aborts.
        if state["cleaned"]:
            return
        state["cleaned"] = True
        _terminate_process(process)
        _active_transcodes.pop(file_path, None)
        try:
            out_fh.close()
        except Exception:
            pass
        bytes_yielded = state["bytes"]
        success = (process.returncode == 0 and bytes_yielded > 0)
        try:
            if success and os.path.exists(tmp_path):
                os.replace(tmp_path, fmp4_path)
                with open(done_marker, "wb"):
                    pass
                _transcode_fail_until.pop(file_path, None)
                logger.info(f"[FFmpeg] cached fmp4 ready: {fmp4_path}")
            else:
                if os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
                _transcode_fail_until[file_path] = time.monotonic() + TRANSCODE_FAIL_COOLDOWN
                logger.error(
                    f"[FFmpeg] transcode ended for {file_path} "
                    f"(rc={process.returncode}, bytes={bytes_yielded}) — "
                    f"cooldown {TRANSCODE_FAIL_COOLDOWN}s"
                )
        except OSError as e:
            logger.error(f"[FFmpeg] fmp4 finalize failed for {file_path}: {e}")
        finally:
            try:
                lock.release()
            except RuntimeError:
                pass

    async def _iter():
        loop = asyncio.get_event_loop()
        try:
            while True:
                if await request.is_disconnected():
                    break
                chunk = await loop.run_in_executor(None, process.stdout.read, CHUNK_TRANSCODE)
                if not chunk:
                    break
                try:
                    out_fh.write(chunk)
                    out_fh.flush()
                except OSError as e:
                    logger.error(f"[FFmpeg] write to {tmp_path} failed: {e}")
                state["bytes"] += len(chunk)
                yield chunk
        finally:
            # Run cleanup inline too — covers cases where BackgroundTask is skipped.
            _cleanup()

    return StreamingResponse(
        _iter(),
        media_type="video/mp4",
        headers={"Cache-Control": "no-cache"},
        background=BackgroundTask(_cleanup),
    )


def _serve(file_path: str, request: Request) -> Response:
    """Dispatcher for fully-downloaded files: pick direct or transcoded path by extension."""
    _, fext = os.path.splitext(file_path.lower())
    if fext in VIDEO_DIRECT:
        return _stream_direct(file_path, request)
    return _stream_transcoded_static(file_path, request)


def _serve_fmp4_growing(file_path: str, request: Request) -> Response:
    """Serve a non-direct file whose torrent is still downloading. Assumes the
    SSE generator has already kicked off the growing fmp4 writer, so we either
    serve the cached output (if finished) or tail the in-progress .fmp4.tmp.
    """
    fmp4_path, tmp_path, done_marker = _fmp4_paths(file_path)
    if os.path.isfile(fmp4_path) and os.path.isfile(done_marker):
        return _stream_direct(fmp4_path, request)
    # The writer thread may not have created .tmp yet (started microseconds ago).
    # Don't 503 on that race — _tail_file_iter polls up to 10s for the file to
    # appear and exits cleanly if the writer finished before we got here.
    return StreamingResponse(
        _tail_file_iter(tmp_path, done_marker),
        media_type="video/mp4",
        headers={"Cache-Control": "no-cache"},
    )


# ---------------------------------------------------------------------------
# GET /api/stream/{movie_id}/progress — SSE
# ---------------------------------------------------------------------------

@router.get("/api/stream/{movie_id}/progress")
async def stream_progress(movie_id: int):
    """Drive the player overlay. SSE stays open until the file is truly playable:
      - direct formats (.mp4/.webm): close as soon as the 30 MB torrent buffer is ready,
      - transcoded formats: close only once the cached fmp4 (.fmp4 + .fmp4.done) exists.
    Emits coarse states (`starting`, `downloading`, `transcoding`, `idle`) so the
    frontend can keep the user out of the <video> tag until playback is safe.
    """
    async def _generator():
        from models_db import SessionLocal
        start_wait = 0
        MAX_WAIT = 120  # seconds we'll wait for the download to *start*
        kicked_off = False
        retries = 0
        MAX_RETRIES = 3  # re-kick the pipeline on transient torrent failures

        err_count = 0
        MAX_ERR = 5  # total iteration errors before we give up on this stream

        while True:
            try:
                if not kicked_off:
                    kicked_off = True
                    try:
                        await _ensure_pipeline_started(movie_id)
                    except Exception as e:
                        # Never let a transient pipeline error (e.g. archive.org
                        # ReadTimeout) crash the SSE TaskGroup — that surfaces as an
                        # uncaught ASGI exception and leaves the overlay spinning.
                        logger.error(f"[SSE] pipeline start crashed for movie_id={movie_id}: {e!r}")
                        db = SessionLocal()
                        try:
                            update_movie_status(db, movie_id, MovieStatus.failed)
                        finally:
                            db.close()

                db = SessionLocal()
                try:
                    movie = get_movie_by_id(db, movie_id)
                finally:
                    db.close()
                if movie is None:
                    yield {"data": json.dumps({"status": "idle", "progress": 100})}
                    break

                # Classify direct vs. transcode from the real target file. The DB
                # mp4_path is written only after the 30 MB buffer fills, so early SSE
                # ticks would otherwise see "" → ext "" → is_direct False and wrongly
                # spin up a transcode on a .mp4 that should stream directly. Fall back
                # to the torrent's pinned target file when the DB path isn't set yet.
                file_path = movie.mp4_path or ""
                if not file_path:
                    dh_early = torrent_manager._handles.get(movie_id)
                    if dh_early is not None and dh_early.file_path:
                        file_path = dh_early.file_path
                    else:
                        file_path = torrent_manager.resolve_video_file(movie_id) or ""
                ext = os.path.splitext(file_path.lower())[1]
                is_direct = ext in VIDEO_DIRECT

                # Movie marked ready in DB — decide if we can release the overlay.
                if movie.status == MovieStatus.ready and file_path:
                    if is_direct:
                        yield {"data": json.dumps({"status": "idle", "progress": 100})}
                        break
                    if _fmp4_state_idle(file_path):
                        yield {"data": json.dumps({"status": "idle", "progress": 100})}
                        break
                    # Need transcode — ensure worker is running, report progress.
                    _precompute_fmp4_cache(file_path)
                    yield {"data": json.dumps(_fmp4_progress_event(file_path))}
                    await asyncio.sleep(1)
                    continue

                # Transient failure (e.g. archive.org 500 on the .torrent) — don't
                # drop the user onto an empty player. Re-kick the pipeline a few
                # times before surfacing a hard error.
                if movie.status == MovieStatus.failed:
                    if retries < MAX_RETRIES:
                        retries += 1
                        logger.info(f"[SSE] movie_id={movie_id} failed — retry {retries}/{MAX_RETRIES}")
                        try:
                            await _ensure_pipeline_started(movie_id)
                        except Exception as e:
                            logger.error(f"[SSE] pipeline re-kick crashed for movie_id={movie_id}: {e!r}")
                        yield {"data": json.dumps({"status": "starting", "progress": 0, "speed_kbs": 0, "peers": 0})}
                        await asyncio.sleep(2)
                        continue
                    yield {"data": json.dumps({"status": "error", "progress": 0})}
                    break

                # Movie not ready — driven by torrent state.
                dh = torrent_manager._handles.get(movie_id)
                if dh is None:
                    if movie.status in (MovieStatus.pending, MovieStatus.downloading) and start_wait < MAX_WAIT:
                        start_wait += 1
                        yield {"data": json.dumps({"status": "starting", "progress": 0, "speed_kbs": 0, "peers": 0})}
                        await asyncio.sleep(1)
                        continue
                    yield {"data": json.dumps({"status": "idle", "progress": 100})}
                    break

                start_wait = 0
                prog = torrent_manager.get_progress(movie_id)
                if prog is None:
                    yield {"data": json.dumps({"status": "idle", "progress": 100})}
                    break

                # A direct .mp4/.webm can only be range-streamed raw once it's fully on
                # disk (its moov atom may sit at the end). While still downloading, even
                # a "direct" file goes through the fmp4 remux so the overlay tracks the
                # transcode and the browser gets a moov-front fragmented stream.
                resolved = torrent_manager.resolve_video_file(movie_id) or file_path
                serve_direct = is_direct and bool(resolved) and _is_file_complete(resolved)

                if not serve_direct:
                    # Non-direct, or direct-but-incomplete: drive the growing fmp4.
                    if dh.buffer_event.is_set() and resolved:
                        _start_growing_fmp4_writer(resolved, movie_id)
                        if _fmp4_state_idle(resolved):
                            yield {"data": json.dumps({"status": "idle", "progress": 100})}
                            break
                        yield {"data": json.dumps(_fmp4_progress_event(resolved))}
                        await asyncio.sleep(1)
                        continue
                    # Buffer not ready yet — still show torrent download progress.
                    yield {"data": json.dumps(prog)}
                    await asyncio.sleep(1)
                    continue

                # Direct AND complete: release — browser can range-seek the raw file.
                if dh.buffer_event.is_set():
                    yield {"data": json.dumps({"status": "idle", "progress": 100})}
                    break

                yield {"data": json.dumps(prog)}
                await asyncio.sleep(1)
            except Exception as e:
                # Defense-in-depth: any unexpected error in one iteration must not
                # crash the SSE TaskGroup (eliminatory: no uncaught server errors).
                # Log, back off, and give up after MAX_ERR total — a single stream
                # racking up that many errors means something is genuinely broken.
                err_count += 1
                logger.error(
                    f"[SSE] generator iteration error movie_id={movie_id} "
                    f"({err_count}/{MAX_ERR}): {e!r}"
                )
                if err_count >= MAX_ERR:
                    yield {"data": json.dumps({"status": "error", "progress": 0})}
                    break
                await asyncio.sleep(1)

    return EventSourceResponse(_generator())


# ---------------------------------------------------------------------------
# GET /api/genres
# ---------------------------------------------------------------------------

@router.get("/api/genres")
async def get_genres_route(language: str = "en-US"):
    return await tmdb_get_genres(language)


# ---------------------------------------------------------------------------
# GET /api/subtitles/{archive_id}/{lang}
# ---------------------------------------------------------------------------

@router.get("/api/subtitles/{archive_id}/{lang}")
async def get_subtitle(archive_id: str, lang: str):
    path = await get_subtitle_path(archive_id, lang)
    if not path:
        raise HTTPException(status_code=404, detail="Subtitle not found")
    return FileResponse(path, media_type="text/vtt")
