import os
import httpx
from dataclasses import dataclass, field
from typing import Optional, List

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

_genres_cache: Optional[List[dict]] = None


@dataclass
class TMDbEnrichment:
    tmdb_id: Optional[int]
    poster_url: Optional[str]
    overview: Optional[str]
    rating: Optional[float]
    runtime: Optional[int]
    genres: List[str] = field(default_factory=list)
    cast: List[dict] = field(default_factory=list)
    director: Optional[str] = None


def _api_key() -> Optional[str]:
    return os.getenv("TMDB_API_KEY")


def _poster(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    return f"{TMDB_IMAGE_BASE}{path}"


async def search_tmdb(title: str, year: Optional[int] = None) -> Optional[TMDbEnrichment]:
    key = _api_key()
    if not key:
        return None

    params: dict = {"api_key": key, "query": title, "include_adult": "false"}
    if year:
        params["year"] = year

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{TMDB_BASE}/search/movie", params=params)
        if r.status_code != 200:
            return None
        results = r.json().get("results", [])
        if not results:
            return None

        tmdb_id = results[0]["id"]

        detail_r  = await client.get(f"{TMDB_BASE}/movie/{tmdb_id}", params={"api_key": key})
        credits_r = await client.get(f"{TMDB_BASE}/movie/{tmdb_id}/credits", params={"api_key": key})

    if detail_r.status_code != 200:
        return None

    detail  = detail_r.json()
    credits = credits_r.json() if credits_r.status_code == 200 else {}

    genres = [g["name"] for g in detail.get("genres", [])]

    cast = []
    for actor in credits.get("cast", [])[:5]:
        cast.append({
            "name": actor.get("name", ""),
            "character": actor.get("character", ""),
            "picture_url": _poster(actor.get("profile_path")),
        })

    director = None
    for crew in credits.get("crew", []):
        if crew.get("job") == "Director":
            director = crew.get("name")
            break

    return TMDbEnrichment(
        tmdb_id=tmdb_id,
        poster_url=_poster(detail.get("poster_path")),
        overview=detail.get("overview"),
        rating=detail.get("vote_average"),
        runtime=detail.get("runtime"),
        genres=genres,
        cast=cast,
        director=director,
    )


async def get_genres() -> List[dict]:
    global _genres_cache
    if _genres_cache is not None:
        return _genres_cache

    key = _api_key()
    if not key:
        return []

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{TMDB_BASE}/genre/movie/list", params={"api_key": key})
            if r.status_code != 200:
                return []
            _genres_cache = r.json().get("genres", [])
            return _genres_cache
    except (httpx.ConnectError, httpx.TimeoutException):
        return []
