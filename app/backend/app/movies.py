import asyncio
import json
import os
import subprocess
import threading
import time
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

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
from services.torrent_manager import TorrentManager

router = APIRouter()
torrent_manager = TorrentManager()

# Semaphore to avoid hammering TMDb (40 req/10s on free tier)
_tmdb_sem = asyncio.Semaphore(5)

VIDEO_DIRECT       = {".mp4", ".webm"}
VIDEO_TRANSCODE    = {".mkv", ".avi", ".mov", ".wmv", ".flv"}
CHUNK_DIRECT       = 1 * 1024 * 1024   # 1 MB
CHUNK_TRANSCODE    = 64 * 1024          # 64 KB

# Tracks active FFmpeg processes by file_path — prevents concurrent transcodes of finished files
_active_transcodes: dict[str, subprocess.Popen] = {}
# Tracks movie_ids currently being streamed via FIFO (growing download) — set is checked atomically
_currently_growing: set[int] = set()
FFMPEG_NOISE = (
    "invalid as first byte of an EBML number",
    "EBML header parsing failed",
    "Error opening input file",
    "Error submitting packet to decoder",
    "Invalid data found when processing input",
    "Last message repeated",
)


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
            print("[list_movies] DB empty, falling back to live Archive.org search")
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
        # genre filter requires genres in DB — best-effort
        results = results

    # Sorting
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

    print(f"[Stream] movie_id={movie_id} title={movie.title!r} status={movie.status} mp4_path={movie.mp4_path}")

    # Case 1: already downloaded
    if movie.status == MovieStatus.ready and movie.mp4_path and os.path.isfile(movie.mp4_path):
        print(f"[Stream] serving from disk: {movie.mp4_path}")
        mark_movie_watched(db, movie_id)
        return _serve(movie.mp4_path, request)

    # Case 2: currently downloading by another request — join the wait
    if movie.status == MovieStatus.downloading:
        print(f"[Stream] joining existing download for movie_id={movie_id}")
        try:
            file_path = await torrent_manager.wait_for_buffer(movie_id, timeout=300.0)
        except asyncio.TimeoutError:
            print(f"[Stream] timeout waiting for buffer movie_id={movie_id}")
            update_movie_status(db, movie_id, MovieStatus.failed)
            raise HTTPException(status_code=503, detail="torrent_timeout")
        if file_path and os.path.isfile(file_path):
            _, fext = os.path.splitext(file_path.lower())
            print(f"[Stream] buffer ready (joined), serving: {file_path}")
            mark_movie_watched(db, movie_id)
            if fext in VIDEO_DIRECT:
                update_movie_path(db, movie_id, file_path)
                update_movie_status(db, movie_id, MovieStatus.ready)
                return _stream_direct(file_path, request)
            else:
                asyncio.create_task(_finalize_when_done(movie_id, file_path))
                return _stream_transcoded_growing(file_path, movie_id)

    # Case 3: not started / previously failed
    print(f"[Stream] starting new download for movie_id={movie_id} archive_id={movie.archive_id}")
    torrent_url = movie.torrent_url
    if not torrent_url:
        print(f"[Stream] fetching torrent URL from Archive.org for {movie.archive_id}")
        torrent_url = await get_torrent_url(movie.archive_id)
        if not torrent_url:
            print(f"[Stream] ERROR: no torrent found for {movie.archive_id}")
            raise HTTPException(status_code=422, detail="No torrent available for this movie")
        print(f"[Stream] torrent URL: {torrent_url}")
        m = db.query(Movie).filter(Movie.id == movie_id).first()
        if m:
            m.torrent_url = torrent_url
            db.commit()

    update_movie_status(db, movie_id, MovieStatus.downloading)

    try:
        await torrent_manager.start_download(torrent_url, movie_id, movie.archive_id)
    except Exception as e:
        print(f"[Stream] ERROR starting download movie_id={movie_id}: {e}")
        update_movie_status(db, movie_id, MovieStatus.failed)
        raise HTTPException(status_code=500, detail=f"Download error: {e}")

    print(f"[Stream] waiting for 30 MB buffer movie_id={movie_id}…")
    try:
        file_path = await torrent_manager.wait_for_buffer(movie_id, timeout=300.0)
    except (asyncio.TimeoutError, KeyError):
        print(f"[Stream] timeout (300s) waiting for buffer movie_id={movie_id}")
        update_movie_status(db, movie_id, MovieStatus.failed)
        raise HTTPException(status_code=503, detail="torrent_timeout")

    if not file_path:
        file_path = torrent_manager.resolve_video_file(movie_id)

    if not file_path or not os.path.isfile(file_path):
        print(f"[Stream] ERROR: no video file found after download for movie_id={movie_id}")
        update_movie_status(db, movie_id, MovieStatus.failed)
        raise HTTPException(status_code=503, detail="Video file not found after download")

    _, fext = os.path.splitext((file_path or "").lower())
    print(f"[Stream] 30 MB buffer ready, serving: {file_path}")
    mark_movie_watched(db, movie_id)
    if fext in VIDEO_DIRECT:
        update_movie_path(db, movie_id, file_path)
        update_movie_status(db, movie_id, MovieStatus.ready)
        return _stream_direct(file_path, request)
    else:
        asyncio.create_task(_finalize_when_done(movie_id, file_path))
        return _stream_transcoded_growing(file_path, movie_id)


async def _finalize_when_done(movie_id: int, file_path: str) -> None:
    """Background task: when the torrent finishes, mark the movie as ready in DB."""
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
                print(f"[Stream] movie_id={movie_id} finalized: status=ready path={resolved}")
            finally:
                _db.close()
            return
        await asyncio.sleep(5.0)


# ---------------------------------------------------------------------------
# stream_direct — for .mp4 / .webm  (Range support)
# ---------------------------------------------------------------------------

def _media_type(path: str) -> str:
    ext = os.path.splitext(path.lower())[1]
    return "video/webm" if ext == ".webm" else "video/mp4"


def _stream_direct(file_path: str, request: Request) -> StreamingResponse:
    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("Range")

    if range_header:
        range_val = range_header.replace("bytes=", "")
        start_str, _, end_str = range_val.partition("-")
        start = int(start_str) if start_str else 0
        end   = int(end_str)   if end_str   else file_size - 1
        end   = min(end, file_size - 1)
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
            },
        )

    return StreamingResponse(
        open(file_path, "rb"),
        media_type=_media_type(file_path),
        headers={
            "Accept-Ranges":  "bytes",
            "Content-Length": str(file_size),
        },
    )


# ---------------------------------------------------------------------------
# stream_transcoded — for .mkv / .avi / others  (FFmpeg → fragmented MP4)
# ---------------------------------------------------------------------------

def _stream_transcoded(file_path: str) -> StreamingResponse:
    # Deduplicate: only one FFmpeg process per file at a time.
    # Concurrent requests (browser probe + actual playback) create resource storms.
    existing = _active_transcodes.get(file_path)
    if existing is not None and existing.poll() is None:
        print(f"[FFmpeg] already transcoding {file_path} — rejecting concurrent request")
        raise HTTPException(status_code=503, detail="already_transcoding")
    # Stale entry (process ended) — clean it up
    _active_transcodes.pop(file_path, None)

    _, ext = os.path.splitext(file_path.lower())
    print(f"[FFmpeg] transcoding {file_path} (ext={ext})")

    cmd = [
        "ffmpeg",
        "-fflags", "+genpts+discardcorrupt+igndts",
        "-err_detect", "ignore_err",
        "-analyzeduration", "500000",
        "-probesize", "500000",
        "-i", file_path,
        "-map", "0:V:0",
        "-map", "0:a:0?",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-g", "50",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ac", "2",
        "-ar", "48000",
        "-sn",
        "-f", "mp4",
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-loglevel", "warning",
        "pipe:1",
    ]

    process = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0
    )
    _active_transcodes[file_path] = process

    def _log_stderr():
        for line in process.stderr:
            msg = line.decode(errors="replace").strip()
            if msg and not any(noise in msg for noise in FFMPEG_NOISE):
                print(f"[FFmpeg] {msg}")

    threading.Thread(target=_log_stderr, daemon=True).start()

    async def _iter():
        loop = asyncio.get_event_loop()
        try:
            while True:
                chunk = await loop.run_in_executor(None, process.stdout.read, CHUNK_TRANSCODE)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                process.terminate()
                process.wait()
            except Exception:
                pass
            _active_transcodes.pop(file_path, None)

    return StreamingResponse(
        _iter(),
        media_type="video/mp4",
        headers={"Cache-Control": "no-cache"},
    )


# ---------------------------------------------------------------------------
# stream_transcoded_growing — FIFO-based: transcode while still downloading
# ---------------------------------------------------------------------------

def _stream_transcoded_growing(file_path: str, movie_id: int) -> StreamingResponse:
    """Feed the growing torrent file into FFmpeg via a FIFO — no need to wait for 100%.

    asyncio is single-threaded: _currently_growing.add() runs atomically (no yield between
    the check and the add), so concurrent requests are correctly rejected with 503.
    """
    if movie_id in _currently_growing:
        print(f"[FFmpeg] movie_id={movie_id} already streaming — rejecting concurrent request")
        raise HTTPException(status_code=503, detail="already_transcoding")
    _currently_growing.add(movie_id)

    fifo_path = f"/tmp/ht_{movie_id}.fifo"
    try:
        os.unlink(fifo_path)
    except FileNotFoundError:
        pass
    os.mkfifo(fifo_path)

    def _feed_fifo():
        # safe_limit = how many bytes from the START of the file are safely readable.
        # With sparse storage, os.path.getsize() returns the full nominal size immediately,
        # so we must use libtorrent's total_done instead to avoid feeding unwritten regions.
        try:
            with open(fifo_path, "wb") as fifo:
                offset = 0
                safe_limit = 0
                last_check = 0.0

                while True:
                    now = time.monotonic()

                    # Refresh safe_limit every 0.25s, or immediately when we've caught up.
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
                        # When download is complete use the real file size; otherwise
                        # use total_done which reflects contiguous bytes from piece 0.
                        safe_limit = file_total if done else int(prog["downloaded_mb"] * 1024 * 1024)
                        last_check = now

                        if offset >= safe_limit and done:
                            break

                    if offset < safe_limit:
                        to_read = min(65536, safe_limit - offset)
                        with open(file_path, "rb") as f:
                            f.seek(offset)
                            chunk = f.read(to_read)
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
            print(f"[FFmpeg] FIFO feeder error: {e}")
        finally:
            try:
                os.unlink(fifo_path)
            except Exception:
                pass

    threading.Thread(target=_feed_fifo, daemon=True).start()

    _, ext = os.path.splitext(file_path.lower())
    print(f"[FFmpeg] transcoding (growing) {file_path} (ext={ext}) via FIFO {fifo_path}")

    cmd = [
        "ffmpeg",
        "-fflags", "+genpts+discardcorrupt+igndts",
        "-err_detect", "ignore_err",
        "-analyzeduration", "500000",   # 0.5s — don't stall before first output
        "-probesize", "500000",         # 500 KB — MPEG-2 is detectable in the first few KB
        "-i", fifo_path,
        "-map", "0:V:0",
        "-map", "0:a:0?",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-g", "50",                     # keyframe every 2s — tighter fragments
        "-c:a", "aac",
        "-b:a", "192k",
        "-ac", "2",
        "-ar", "48000",
        "-sn",
        "-f", "mp4",
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-loglevel", "warning",
        "pipe:1",
    ]

    process = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0
    )

    def _log_stderr():
        for line in process.stderr:
            msg = line.decode(errors="replace").strip()
            if msg and not any(noise in msg for noise in FFMPEG_NOISE):
                print(f"[FFmpeg] {msg}")

    threading.Thread(target=_log_stderr, daemon=True).start()

    async def _iter():
        loop = asyncio.get_event_loop()
        try:
            while True:
                chunk = await loop.run_in_executor(None, process.stdout.read, CHUNK_TRANSCODE)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                process.terminate()
                process.wait()
            except Exception:
                pass
            _currently_growing.discard(movie_id)

    return StreamingResponse(
        _iter(),
        media_type="video/mp4",
        headers={"Cache-Control": "no-cache"},
    )


# ---------------------------------------------------------------------------
# GET /api/stream/{movie_id}/progress — SSE
# ---------------------------------------------------------------------------

@router.get("/api/stream/{movie_id}/progress")
async def stream_progress(movie_id: int):
    async def _generator():
        from models_db import SessionLocal
        # SSE may fire before the stream endpoint calls start_download (race).
        # Wait up to 120s when status is pending OR downloading.
        # For mp4/webm: close when 30 MB buffer ready (seek works on partial file).
        # For transcoded formats: keep open until 100% — FFmpeg needs the full file.
        start_wait = 0
        MAX_WAIT = 120

        while True:
            dh = torrent_manager._handles.get(movie_id)

            if dh is None:
                # No active torrent handle — check DB
                db = SessionLocal()
                try:
                    movie = get_movie_by_id(db, movie_id)
                    db_status = movie.status if movie else None
                finally:
                    db.close()
                if db_status in (MovieStatus.pending, MovieStatus.downloading) and start_wait < MAX_WAIT:
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

            # Close overlay as soon as 30 MB buffer is ready — works for all formats.
            # Direct: browser ranges into growing file. Transcoded: FIFO feeds FFmpeg live.
            if dh.buffer_event.is_set():
                yield {"data": json.dumps({"status": "idle", "progress": 100})}
                break

            yield {"data": json.dumps(prog)}
            await asyncio.sleep(1)

    return EventSourceResponse(_generator())


# ---------------------------------------------------------------------------
# GET /api/genres
# ---------------------------------------------------------------------------

@router.get("/api/genres")
async def get_genres():
    return await tmdb_get_genres()


# ---------------------------------------------------------------------------
# GET /api/subtitles/{archive_id}/{lang}
# ---------------------------------------------------------------------------

@router.get("/api/subtitles/{archive_id}/{lang}")
async def get_subtitle(archive_id: str, lang: str):
    path = await get_subtitle_path(archive_id, lang)
    if not path:
        raise HTTPException(status_code=404, detail="Subtitle not found")
    return FileResponse(path, media_type="text/vtt")
