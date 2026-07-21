"""TMDb correlation for FILM items (subject III.2.2: name, year, TMDb rating,
cover, plus cast/director/runtime/genres on the detail page).

Only ``media_kind == "film"`` items (archive.org) are enriched — an academic
lecture has no TMDb entry, so those keep their native metadata.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

# TMDb free tier ~40 req/10s — cap concurrency so bursts of enrichment don't 429.
_sem = asyncio.Semaphore(5)
_genres_cache: Optional[list[dict]] = None

# Archive.org titles carry junk that breaks the TMDb match. Strip it before query.
_JUNK_RE = re.compile(
    r"\((?:19|20)\d{2}\)|\b(?:public\s+domain|restored|hd|1080p|720p|full\s+movie|feature\s+film)\b",
    re.IGNORECASE,
)


@dataclass
class Enrichment:
    tmdb_id: Optional[int] = None
    poster_url: Optional[str] = None
    overview: Optional[str] = None
    rating: Optional[float] = None
    runtime: Optional[int] = None
    genres: list[str] = field(default_factory=list)
    cast: list[dict] = field(default_factory=list)
    director: Optional[str] = None


def _api_key() -> Optional[str]:
    return os.getenv("TMDB_API_KEY")


def _poster(path: Optional[str]) -> Optional[str]:
    return f"{TMDB_IMAGE_BASE}{path}" if path else None


def _clean_title(title: str) -> str:
    cleaned = _JUNK_RE.sub(" ", title)
    return re.sub(r"\s+", " ", cleaned).strip() or title


async def enrich(title: str, year: Optional[int], language: str = "en-US") -> Optional[Enrichment]:
    key = _api_key()
    if not key:
        return None
    query = _clean_title(title)
    params = {"api_key": key, "query": query, "include_adult": "false", "language": language}
    if year:
        params["year"] = year
    async with _sem:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(f"{TMDB_BASE}/search/movie", params=params)
                if r.status_code != 200:
                    return None
                results = r.json().get("results", [])
                if not results:
                    return None
                tmdb_id = results[0]["id"]
                detail_r = await client.get(f"{TMDB_BASE}/movie/{tmdb_id}", params={"api_key": key, "language": language})
                credits_r = await client.get(f"{TMDB_BASE}/movie/{tmdb_id}/credits", params={"api_key": key})
        except httpx.HTTPError as e:
            logger.warning("[tmdb] enrich failed for %r: %r", title, e)
            return None

    if detail_r.status_code != 200:
        return None
    detail = detail_r.json()
    credits = credits_r.json() if credits_r.status_code == 200 else {}

    cast = [
        {"name": a.get("name", ""), "character": a.get("character", ""),
         "picture_url": _poster(a.get("profile_path"))}
        for a in credits.get("cast", [])[:5]
    ]
    director = next((c.get("name") for c in credits.get("crew", []) if c.get("job") == "Director"), None)

    return Enrichment(
        tmdb_id=tmdb_id,
        poster_url=_poster(detail.get("poster_path")),
        overview=detail.get("overview"),
        rating=detail.get("vote_average"),
        runtime=detail.get("runtime"),
        genres=[g["name"] for g in detail.get("genres", [])],
        cast=cast,
        director=director,
    )


async def get_genres(language: str = "en-US") -> list[dict]:
    global _genres_cache
    if _genres_cache is not None:
        return _genres_cache
    key = _api_key()
    if not key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{TMDB_BASE}/genre/movie/list", params={"api_key": key, "language": language})
            if r.status_code != 200:
                return []
            _genres_cache = r.json().get("genres", [])
            return _genres_cache
    except httpx.HTTPError:
        return []


async def genre_id_to_name(genre: Optional[str]) -> Optional[str]:
    """Map a numeric TMDb genre id (as sent by the frontend FiltersBar) to its
    name, which is how genres are stored/filtered. Pass-through for non-numeric."""
    if not genre or not genre.isdigit():
        return genre
    gid = int(genre)
    for g in await get_genres():
        if g.get("id") == gid:
            return g.get("name")
    return None
