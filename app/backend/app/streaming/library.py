"""Library: search / filter / thumbnails / detail (subject III.2).

Fans a query out to every source, upserts a Movie row per result, enriches FILM
rows via TMDb in the background, applies rating filter/sort, and returns a
``has_more`` flag driven by the raw source counts (not the filtered result count)
so infinite scroll never stops early when a rating filter empties a page.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from sqlalchemy.orm import Session

from database import (
    Movie, create_or_get_source_movie, get_movie_by_id, get_movie_by_archive_id,
    get_watched_movie_ids, is_watched_by_user, count_comments_for_movie,
    update_movie_tmdb,
)
from models_db import SessionLocal

from . import metadata, subtitles
from .sources import get_registry, SourceItem
from .torrent_engine import get_engine

logger = logging.getLogger(__name__)

_PAGE = 20


def _thumbnail(movie: Movie, watched: bool) -> dict:
    return {
        "id": movie.id,
        "archive_id": movie.archive_id,
        "source": movie.source,
        "media_kind": movie.media_kind,
        "title": movie.title,
        "year": movie.year,
        "poster_url": movie.poster_url,   # None for academic → frontend placeholder
        "rating": movie.rating,
        "genres": json.loads(movie.genres_json) if movie.genres_json else [],
        "watched": watched,
        "status": movie.status,
    }


async def _enrich_one(movie_id: int, title: str, year: Optional[int], language: str) -> None:
    en = await metadata.enrich(title, year, language)
    if not en:
        return
    db = SessionLocal()
    try:
        update_movie_tmdb(db, movie_id, {
            "tmdb_id": en.tmdb_id, "poster_url": en.poster_url, "overview": en.overview,
            "rating": en.rating, "runtime": en.runtime, "genres": en.genres, "cast": en.cast,
        })
    finally:
        db.close()


async def enrich_background(rows: list[tuple[int, str, Optional[int]]], language: str) -> None:
    tasks = [asyncio.create_task(_enrich_one(mid, t, y, language)) for mid, t, y in rows]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def list_movies(
    db: Session, *, user_id: Optional[int], query: Optional[str], page: int,
    sort: Optional[str], genre: Optional[str],
    year_from: Optional[int], year_to: Optional[int], min_rating: Optional[float],
    language: str,
) -> dict:
    genre_name = await metadata.genre_id_to_name(genre) if genre else None
    reg = get_registry()
    if query:
        items: list[SourceItem] = await reg.search(
            query, page, year_from=year_from, year_to=year_to, genre=genre_name)
    else:
        # Genre/year must filter the popular listing too, not just text search —
        # previously these were silently dropped whenever the search box was
        # empty, so picking a genre/year with no query text had no effect at all.
        items = await reg.popular(page, year_from=year_from, year_to=year_to, genre=genre_name)

    # has_more BEFORE filtering — a rating filter emptying a page must not stop scroll.
    has_more = len(items) >= _PAGE

    rows: list[Movie] = [
        create_or_get_source_movie(db, it.source, it.source_id, it.title, it.year, it.media_kind)
        for it in items
    ]

    watched_ids = get_watched_movie_ids(db, user_id) if user_id else set()
    thumbs = [_thumbnail(m, m.id in watched_ids) for m in rows]

    # Background TMDb enrichment for un-enriched FILM rows.
    need = [(m.id, m.title, m.year) for m in rows if m.media_kind == "film" and not m.poster_url and not m.tmdb_id]
    if need:
        asyncio.create_task(enrich_background(need, language))

    # Rating filter/sort (TMDb-only, best-effort on already-enriched rows).
    if min_rating is not None:
        thumbs = [t for t in thumbs if t["rating"] is not None and t["rating"] >= min_rating]
    if sort == "rating_desc":
        thumbs.sort(key=lambda t: t["rating"] or 0, reverse=True)
    elif sort == "rating_asc":
        thumbs.sort(key=lambda t: t["rating"] or 0)
    elif sort == "year_desc":
        thumbs.sort(key=lambda t: t["year"] or 0, reverse=True)
    elif sort == "year_asc":
        thumbs.sort(key=lambda t: t["year"] or 0)
    elif sort == "title_asc" or query:
        thumbs.sort(key=lambda t: (t["title"] or "").lower())
    else:
        thumbs.sort(key=lambda t: 0)  # keep source (popularity) order

    return {"results": thumbs, "has_more": has_more}


def _detail(movie: Movie, subs: list[str], files: list[dict], comments: int, watched: bool) -> dict:
    return {
        "id": movie.id,
        "archive_id": movie.archive_id,
        "source": movie.source,
        "media_kind": movie.media_kind,
        "title": movie.title,
        "year": movie.year,
        "overview": movie.overview,
        "poster_url": movie.poster_url,
        "rating": movie.rating or 0,
        "runtime": movie.runtime or 0,
        "genres": json.loads(movie.genres_json) if movie.genres_json else [],
        "cast": json.loads(movie.cast_json) if movie.cast_json else [],
        "status": movie.status,
        "subtitles": subs,
        "files": files,
        "comments_count": comments,
        "watched": watched,
    }


async def get_movie_detail(db: Session, movie_ref: str, *, user_id: Optional[int], language: str) -> Optional[dict]:
    movie = _resolve_movie(db, movie_ref)
    if movie is None:
        # Create on the fly from an archive.org search (numeric refs already failed).
        results = await get_registry().get(  # type: ignore[union-attr]
            "archive_org").search(movie_ref, 1)
        if not results:
            return None
        it = results[0]
        movie = create_or_get_source_movie(db, it.source, it.source_id, it.title, it.year, it.media_kind)

    # Enrich FILM detail if not done.
    if movie.media_kind == "film" and movie.tmdb_id is None:
        en = await metadata.enrich(movie.title, movie.year, language)
        if en:
            update_movie_tmdb(db, movie.id, {
                "tmdb_id": en.tmdb_id, "poster_url": en.poster_url, "overview": en.overview,
                "rating": en.rating, "runtime": en.runtime, "genres": en.genres, "cast": en.cast,
            })
            db.refresh(movie)

    # Kick subtitle acquisition (EN + preferred language), non-blocking.
    prefs = _sub_langs(language)
    asyncio.create_task(_acquire_subtitles(movie.id, movie.archive_id, movie.title, movie.year, prefs))

    # Multi-file: expose the video file list so the UI can offer a picker.
    files = await _video_files(movie)

    subs = subtitles.list_subtitles(movie.archive_id)
    watched = is_watched_by_user(db, user_id, movie.id) if user_id else False
    return _detail(movie, subs, files, count_comments_for_movie(db, movie.id), watched)


def _resolve_movie(db: Session, movie_ref: str) -> Optional[Movie]:
    if movie_ref.isdigit():
        return get_movie_by_id(db, int(movie_ref))
    return get_movie_by_archive_id(db, movie_ref)


def _sub_langs(language: str) -> list[str]:
    pref = (language or "en").split("-")[0].lower()
    langs = ["en"]
    if pref and pref != "en":
        langs.append(pref)
    return langs


async def _video_files(movie: Movie) -> list[dict]:
    """Video file list for a multi-file torrent (academic bundles). Empty for
    single-file films — the frontend then hides the picker."""
    if movie.media_kind != "video":
        return []
    from .stream_server import _resolve_torrent_url  # avoid import cycle at module load
    url = await _resolve_torrent_url(movie)
    if not url:
        return []
    try:
        files = await get_engine().list_video_files(url)
    except Exception as e:
        logger.warning("[library] list_video_files failed for movie_id=%s: %r", movie.id, e)
        return []
    return files if len(files) > 1 else []


async def _acquire_subtitles(movie_id: int, key: str, title: str, year, langs: list[str]) -> None:
    # Remote (OpenSubtitles) — EN + preferred.
    try:
        await subtitles.fetch_opensubtitles(key, title, year, langs)
    except Exception as e:
        logger.warning("[library] opensubtitles fetch failed for %s: %r", key, e)
    # Local (bundled .srt / embedded tracks) once a file is present.
    db = SessionLocal()
    try:
        movie = get_movie_by_id(db, movie_id)
        path = movie.mp4_path if movie else None
    finally:
        db.close()
    if path:
        try:
            subtitles.import_bundled_srt(key, path)
            subtitles.import_embedded(key, path)
        except Exception as e:
            logger.warning("[library] local subtitle import failed for %s: %r", key, e)


async def get_genres(language: str) -> list[dict]:
    return await metadata.get_genres(language)
