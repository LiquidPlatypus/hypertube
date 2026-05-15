import httpx
from dataclasses import dataclass
from typing import Optional, List

ARCHIVE_SEARCH_URL = "https://archive.org/advancedsearch.php"
ARCHIVE_METADATA_URL = "https://archive.org/metadata/{identifier}"
ARCHIVE_DOWNLOAD_BASE = "https://archive.org/download"

COLLECTIONS = ["feature_films", "silent_films", "animationandcartoons", "short_films"]
_COLLECTION_QUERY = "(" + " OR ".join(f"collection:{c}" for c in COLLECTIONS) + ")"


@dataclass
class ArchiveMovie:
    identifier: str
    title: str
    year: Optional[int]
    description: Optional[str]
    downloads: int


def _parse_year(raw) -> Optional[int]:
    if not raw:
        return None
    try:
        return int(str(raw)[:4])
    except (ValueError, TypeError):
        return None


async def search_archive(
    query: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> List[ArchiveMovie]:
    if query:
        q = f"({query}) AND mediatype:movies"
    else:
        q = f"{_COLLECTION_QUERY} AND mediatype:movies"

    params = {
        "q": q,
        "fl[]": ["identifier", "title", "year", "description", "downloads"],
        "sort[]": "downloads desc",
        "rows": page_size,
        "page": page,
        "output": "json",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(ARCHIVE_SEARCH_URL, params=params)
        r.raise_for_status()
        data = r.json()

    docs = data.get("response", {}).get("docs", [])
    results = []
    for doc in docs:
        raw_title = doc.get("title") or doc.get("identifier", "")
        if isinstance(raw_title, list):
            raw_title = raw_title[0] if raw_title else doc.get("identifier", "")
        results.append(ArchiveMovie(
            identifier=doc.get("identifier", ""),
            title=str(raw_title),
            year=_parse_year(doc.get("year")),
            description=doc.get("description"),
            downloads=int(doc.get("downloads") or 0),
        ))
    return results


async def get_torrent_url(identifier: str) -> Optional[str]:
    url = ARCHIVE_METADATA_URL.format(identifier=identifier)
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url)
        r.raise_for_status()
        data = r.json()

    for f in data.get("files", []):
        if f.get("format") == "Archive BitTorrent":
            name = f.get("name", "")
            return f"{ARCHIVE_DOWNLOAD_BASE}/{identifier}/{name}"
    return None


def get_thumbnail_url(identifier: str) -> str:
    return f"https://archive.org/services/img/{identifier}"



async def seed_popular_movies(limit: int = 100) -> List[ArchiveMovie]:
    results: List[ArchiveMovie] = []
    page = 1
    page_size = 50
    while len(results) < limit:
        batch = await search_archive(query=None, page=page, page_size=page_size)
        if not batch:
            break
        results.extend(batch)
        page += 1
        if len(batch) < page_size:
            break
    return results[:limit]
