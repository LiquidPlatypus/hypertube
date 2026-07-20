"""FastAPI router for the streaming subsystem. Preserves the existing API surface
(/api/movies, /api/stream/*, /api/subtitles/*, /api/genres) so the frontend keeps
working, and adds a subtitle-refresh endpoint for the CC menu.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from database import (
    User, get_movie_by_id, mark_watched_by_user, create_or_get_source_movie,
)
from models_db import get_db, SessionLocal
from utils import verif_access_token

from . import library, stream_server, subtitles
from .sources import get_registry

logger = logging.getLogger(__name__)
router = APIRouter()

ALGORITHM = "HS256"
SECRET_KEY = os.getenv("SECRET_KEY")


def optional_user_id(request: Request) -> Optional[int]:
    """Decode the bearer token if present; return user id or None. Never raises —
    lets list/detail compute per-user 'watched' when logged in, stay open otherwise."""
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=ALGORITHM)
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


def _preferred_language(db: Session, user_id: Optional[int], ui_language: str) -> str:
    """Effective preferred language (subject III.1/III.3). The en/fr UI toggle is
    the user's language choice, so an explicit non-English UI language wins; the
    stored profile preference applies only when the UI is on the English default."""
    ui = (ui_language or "en").split("-")[0].lower()
    if ui and ui != "en":
        return ui
    if user_id:
        u = db.query(User).filter(User.id == user_id).first()
        if u and u.preferred_language and u.preferred_language != "en":
            return u.preferred_language
    return "en"


# ---------------------------------------------------------------------------
# Library
# ---------------------------------------------------------------------------

@router.get("/api/movies")
async def list_movies(
    request: Request,
    query: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    sort: Optional[str] = Query(None),
    genre: Optional[str] = Query(None),
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    min_rating: Optional[float] = Query(None),
    language: str = Query("en-US"),
    db: Session = Depends(get_db),
):
    if sort in (None, "relevance"):
        sort = "title_asc" if query else None
    user_id = optional_user_id(request)
    return await library.list_movies(
        db, user_id=user_id, query=query, page=page, sort=sort, genre=genre,
        year_from=year_from, year_to=year_to, min_rating=min_rating, language=language,
    )


@router.get("/api/genres")
async def genres(language: str = Query("en-US")):
    return await library.get_genres(language)


@router.get("/api/movies/{movie_ref}")
async def get_movie(
    movie_ref: str, request: Request,
    language: str = Query("en-US"), db: Session = Depends(get_db),
):
    user_id = optional_user_id(request)
    lang = _preferred_language(db, user_id, language)
    detail = await library.get_movie_detail(db, movie_ref, user_id=user_id, language=lang)
    if detail is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    return detail


@router.post("/api/movies/{movie_id}/watch")
async def mark_watched(movie_id: int, current_user=Depends(verif_access_token), db: Session = Depends(get_db)):
    if get_movie_by_id(db, movie_id) is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    mark_watched_by_user(db, current_user["id"], movie_id)
    return {"watched": True}


@router.get("/api/movies/{movie_id}/subtitles")
async def movie_subtitles(movie_id: int, db: Session = Depends(get_db)):
    """Cheap poll for the CC menu — subtitles arrive asynchronously after load."""
    movie = get_movie_by_id(db, movie_id)
    if movie is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    return {"subtitles": subtitles.list_subtitles(movie.archive_id)}


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------

@router.get("/api/stream/{movie_id}")
async def stream(movie_id: int, request: Request, complete: int = Query(0), file: Optional[int] = Query(None)):
    return await stream_server.serve_stream(movie_id, request, complete=bool(complete), file_index=file)


@router.get("/api/stream/{movie_id}/hls/index.m3u8")
async def hls_playlist(movie_id: int, file: Optional[int] = Query(None)):
    """HLS playlist — segments are produced progressively, so the player can
    start after the first one instead of waiting on a byte threshold."""
    return await stream_server.serve_hls_playlist(movie_id, file_index=file)


@router.get("/api/stream/{movie_id}/hls/{segment}")
async def hls_segment(movie_id: int, segment: str):
    return await stream_server.serve_hls_segment(movie_id, segment)


@router.get("/api/stream/{movie_id}/ready")
async def stream_ready(movie_id: int):
    return await stream_server.ready_status(movie_id)


@router.get("/api/stream/{movie_id}/progress")
async def stream_progress(movie_id: int, file: Optional[int] = Query(None)):
    return EventSourceResponse(stream_server.progress_events(movie_id, file_index=file))


# ---------------------------------------------------------------------------
# Subtitles
# ---------------------------------------------------------------------------

@router.get("/api/subtitles/{key}/{lang}")
async def get_subtitle(key: str, lang: str):
    path = subtitles.subtitle_path(key, lang)
    if path is None:
        raise HTTPException(status_code=404, detail="Subtitle not found")
    return FileResponse(path, media_type="text/vtt")


# ---------------------------------------------------------------------------
# Startup seeding (called from main lifespan)
# ---------------------------------------------------------------------------

async def seed_popular(limit: int = 60) -> None:
    """Pre-populate the DB with popular items from all sources so the front page
    is instant on first load. Best-effort; enrichment runs in the background."""
    reg = get_registry()
    collected = []
    page = 1
    while len(collected) < limit and page <= 5:
        batch = await reg.popular(page)
        if not batch:
            break
        collected.extend(batch)
        page += 1
    db = SessionLocal()
    seeded = []
    try:
        for it in collected[:limit]:
            row = create_or_get_source_movie(db, it.source, it.source_id, it.title, it.year, it.media_kind)
            if row.media_kind == "film" and not row.poster_url and not row.tmdb_id:
                seeded.append((row.id, row.title, row.year))
    finally:
        db.close()
    logger.info("[seed] %d popular items", len(collected[:limit]))
    if seeded:
        import asyncio
        asyncio.create_task(library.enrich_background(seeded, "en-US"))
