"""Pluggable legal video sources (subject III.2.1: search must query ≥2 external
sources that provide legally distributable video content).

Two sources, one interface:
  - ArchiveOrgSource       : public-domain FILMS (Solr search, HTTP web seeds).
  - AcademicTorrentsSource : legally-distributable VIDEOS (course lectures),
                             via the sanctioned database.xml feed (no scraping).

``SourceRegistry`` fans a query out to every enabled source concurrently, with a
per-source timeout so a slow/dead source never blocks the results.
"""
from __future__ import annotations

import asyncio
import logging
import time
import xml.etree.ElementTree as ET
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SOURCE_ARCHIVE = "archive_org"
SOURCE_ACADEMIC = "academic_torrents"

# Extensions we consider "video" when validating a torrent's file list.
VIDEO_EXTS = (".mp4", ".webm", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".ogv", ".m4v", ".mpeg", ".mpg", ".ts")


@dataclass
class SourceItem:
    """A search/browse result from one source, before TMDb enrichment."""
    source: str
    source_id: str                 # archive slug | academic infohash
    title: str
    year: Optional[int] = None
    thumbnail: Optional[str] = None
    popularity: float = 0.0        # downloads (archive) | seeders/recency (academic)
    media_kind: str = "film"       # "film" → enrich w/ TMDb | "video" → native metadata
    torrent_ref: Optional[str] = None  # resolved lazily via resolve_torrent()


class MovieSource(ABC):
    name: str

    @abstractmethod
    async def search(
        self, query: str, page: int, *,
        year_from: Optional[int] = None, year_to: Optional[int] = None,
        genre: Optional[str] = None,
    ) -> list[SourceItem]: ...

    @abstractmethod
    async def popular(
        self, page: int, *,
        year_from: Optional[int] = None, year_to: Optional[int] = None,
        genre: Optional[str] = None,
    ) -> list[SourceItem]: ...

    @abstractmethod
    async def resolve_torrent(self, source_id: str) -> Optional[str]:
        """Resolve the downloadable .torrent URL for a source item."""


# ---------------------------------------------------------------------------
# archive.org — public-domain films
# ---------------------------------------------------------------------------

class ArchiveOrgSource(MovieSource):
    name = SOURCE_ARCHIVE

    SEARCH_URL = "https://archive.org/advancedsearch.php"
    METADATA_URL = "https://archive.org/metadata/{id}"
    DOWNLOAD_BASE = "https://archive.org/download"
    THUMB_URL = "https://archive.org/services/img/{id}"

    COLLECTIONS = ["feature_films", "silent_films", "animationandcartoons", "short_films"]
    _SOLR_SPECIAL = set('+-&|!(){}[]^"~*?:\\/')
    _SORT = {"year_asc": "year asc", "year_desc": "year desc", "title_asc": "titleSorter asc"}

    def _collection_clause(self) -> str:
        return "(" + " OR ".join(f"collection:{c}" for c in self.COLLECTIONS) + ")"

    @classmethod
    def _escape_solr(cls, value: str) -> str:
        return "".join(("\\" + ch) if ch in cls._SOLR_SPECIAL else ch for ch in value)

    @staticmethod
    def _year(raw) -> Optional[int]:
        if not raw:
            return None
        try:
            return int(str(raw)[:4])
        except (ValueError, TypeError):
            return None

    async def _query(
        self, *, query: Optional[str], page: int, page_size: int,
        genre: Optional[str], year_from: Optional[int], year_to: Optional[int],
        sort: Optional[str],
    ) -> list[SourceItem]:
        parts = [f"({self._escape_solr(query)})" if query else self._collection_clause(), "mediatype:movies"]
        if genre:
            parts.append(f'subject:("{self._escape_solr(genre.lower())}")')
        if year_from is not None or year_to is not None:
            lo = year_from if year_from is not None else "*"
            hi = year_to if year_to is not None else "*"
            parts.append(f"year:[{lo} TO {hi}]")
        params = {
            "q": " AND ".join(parts),
            "fl[]": ["identifier", "title", "year", "downloads"],
            "sort[]": self._SORT.get(sort or "", "downloads desc"),
            "rows": page_size, "page": page, "output": "json",
        }
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(self.SEARCH_URL, params=params)
            r.raise_for_status()
            docs = r.json().get("response", {}).get("docs", [])
        out: list[SourceItem] = []
        for d in docs:
            ident = d.get("identifier", "")
            if not ident:
                continue
            title = d.get("title") or ident
            if isinstance(title, list):
                title = title[0] if title else ident
            out.append(SourceItem(
                source=self.name, source_id=ident, title=str(title),
                year=self._year(d.get("year")),
                thumbnail=self.THUMB_URL.format(id=ident),
                popularity=float(d.get("downloads") or 0),
                media_kind="film",
            ))
        return out

    async def search(self, query, page, *, year_from=None, year_to=None, genre=None):
        # A search sorts by name (subject III.2.2); the "sort" nuance is applied
        # by the library layer — here we just resolve title order for searches.
        return await self._query(
            query=query, page=page, page_size=20, genre=genre,
            year_from=year_from, year_to=year_to, sort="title_asc",
        )

    async def popular(self, page, *, year_from=None, year_to=None, genre=None):
        return await self._query(
            query=None, page=page, page_size=20, genre=genre,
            year_from=year_from, year_to=year_to, sort=None,  # downloads desc
        )

    async def resolve_torrent(self, source_id: str) -> Optional[str]:
        url = self.METADATA_URL.format(id=source_id)
        timeout = httpx.Timeout(connect=10.0, read=20.0, write=10.0, pool=10.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            for attempt in range(3):
                try:
                    r = await client.get(url)
                    r.raise_for_status()
                    for f in r.json().get("files", []):
                        if f.get("format") == "Archive BitTorrent":
                            return f"{self.DOWNLOAD_BASE}/{source_id}/{f.get('name', '')}"
                    return None
                except httpx.HTTPStatusError as e:
                    if e.response.status_code < 500:
                        return None
                except httpx.HTTPError:
                    pass
                if attempt < 2:
                    await asyncio.sleep(0.5 * (2 ** attempt))
        logger.error("[archive] torrent resolve gave up for %s", source_id)
        return None


# ---------------------------------------------------------------------------
# academictorrents — legally-distributable videos (course lectures)
# ---------------------------------------------------------------------------

@dataclass
class _AcademicItem:
    infohash: str
    title: str
    description: str
    size: int


class AcademicTorrentsSource(MovieSource):
    """Video content from academictorrents.com.

    The site explicitly forbids scraping browse.php and asks integrators to use
    its cached XML feeds instead. We pull ``database.xml`` once and cache it,
    keeping only the ``Course`` category — the subset that is actual playable
    video (lecture recordings, .mp4). Downloads are reliable: these torrents
    carry an ``https://archive.org/download`` web seed (BEP-19) plus live peers.
    """
    name = SOURCE_ACADEMIC

    DATABASE_URL = "https://academictorrents.com/database.xml"
    DOWNLOAD_URL = "https://academictorrents.com/download/{infohash}.torrent"
    VIDEO_CATEGORY = "Course"
    CACHE_TTL = 24 * 3600  # feed refreshes ~1×/day upstream
    _UA = "Hypertube/1.0 (+legal video streaming; contact via 42 project)"

    def __init__(self) -> None:
        self._cache: list[_AcademicItem] = []
        self._cache_ts: float = 0.0
        self._lock = asyncio.Lock()

    async def _catalog(self) -> list[_AcademicItem]:
        async with self._lock:
            if self._cache and (time.time() - self._cache_ts) < self.CACHE_TTL:
                return self._cache
            try:
                async with httpx.AsyncClient(timeout=40, headers={"User-Agent": self._UA}) as client:
                    r = await client.get(self.DATABASE_URL)
                    r.raise_for_status()
                    xml = r.text
            except httpx.HTTPError as e:
                logger.warning("[academic] database.xml fetch failed: %r", e)
                return self._cache  # serve stale on failure
            items: list[_AcademicItem] = []
            try:
                root = ET.fromstring(xml)
            except ET.ParseError as e:
                logger.warning("[academic] database.xml parse failed: %r", e)
                return self._cache
            for it in root.iter("item"):
                if (it.findtext("category") or "").strip() != self.VIDEO_CATEGORY:
                    continue
                infohash = (it.findtext("infohash") or "").strip()
                title = (it.findtext("title") or "").strip()
                if not infohash or not title:
                    continue
                try:
                    size = int((it.findtext("size") or "0").strip())
                except ValueError:
                    size = 0
                items.append(_AcademicItem(
                    infohash=infohash, title=title,
                    description=(it.findtext("description") or "").strip(), size=size,
                ))
            if items:
                self._cache = items
                self._cache_ts = time.time()
            logger.info("[academic] catalog cached: %d video (Course) items", len(self._cache))
            return self._cache

    def _to_item(self, a: _AcademicItem) -> SourceItem:
        return SourceItem(
            source=self.name, source_id=a.infohash, title=a.title,
            year=None, thumbnail=None, popularity=float(a.size),
            media_kind="video",
        )

    async def search(self, query, page, *, year_from=None, year_to=None, genre=None):
        # Same reasoning as popular(): no genre/year metadata in the feed, so an
        # active filter can never be honestly satisfied — exclude, don't ignore.
        if genre or year_from is not None or year_to is not None:
            return []
        catalog = await self._catalog()
        q = (query or "").lower().strip()
        matched = [
            a for a in catalog
            if q in a.title.lower() or q in a.description.lower()
        ] if q else list(catalog)
        # sorted() on a copy — never mutate the shared cache list in place.
        matched = sorted(matched, key=lambda a: a.title.lower())
        start = (page - 1) * 20
        return [self._to_item(a) for a in matched[start:start + 20]]

    async def popular(self, page, *, year_from=None, year_to=None, genre=None):
        # The feed carries neither genre nor year — an active genre/year filter
        # can never be honestly satisfied, so exclude rather than show
        # unfiltered results under a filter the user explicitly set.
        if genre or year_from is not None or year_to is not None:
            return []
        catalog = await self._catalog()
        # No download counter in the feed → "popular" = largest (richest) courses.
        ordered = sorted(catalog, key=lambda a: a.size, reverse=True)
        start = (page - 1) * 20
        return [self._to_item(a) for a in ordered[start:start + 20]]

    async def resolve_torrent(self, source_id: str) -> Optional[str]:
        # source_id is the infohash; the download endpoint serves the .torrent.
        return self.DOWNLOAD_URL.format(infohash=source_id)


# ---------------------------------------------------------------------------
# Registry — concurrent fan-out with per-source timeout
# ---------------------------------------------------------------------------

class SourceRegistry:
    PER_SOURCE_TIMEOUT = 8.0

    def __init__(self, sources: Optional[list[MovieSource]] = None) -> None:
        self._sources: dict[str, MovieSource] = {}
        for s in (sources or [ArchiveOrgSource(), AcademicTorrentsSource()]):
            self._sources[s.name] = s

    def get(self, name: str) -> Optional[MovieSource]:
        return self._sources.get(name)

    async def _gather(self, coros: list) -> list[SourceItem]:
        async def guard(c):
            try:
                return await asyncio.wait_for(c, timeout=self.PER_SOURCE_TIMEOUT)
            except Exception as e:  # timeout, HTTP error, parse error — never fatal
                logger.warning("[registry] source call failed/timeout: %r", e)
                return []
        results = await asyncio.gather(*(guard(c) for c in coros))
        merged: list[SourceItem] = []
        for r in results:
            merged.extend(r or [])
        return merged

    async def search(self, query, page, *, year_from=None, year_to=None, genre=None) -> list[SourceItem]:
        coros = [
            s.search(query, page, year_from=year_from, year_to=year_to, genre=genre)
            for s in self._sources.values()
        ]
        return await self._gather(coros)

    async def popular(self, page, *, year_from=None, year_to=None, genre=None) -> list[SourceItem]:
        coros = [
            s.popular(page, year_from=year_from, year_to=year_to, genre=genre)
            for s in self._sources.values()
        ]
        return await self._gather(coros)

    async def resolve_torrent(self, source: str, source_id: str) -> Optional[str]:
        src = self._sources.get(source)
        if src is None:
            return None
        return await src.resolve_torrent(source_id)


_registry: Optional[SourceRegistry] = None


def get_registry() -> SourceRegistry:
    global _registry
    if _registry is None:
        _registry = SourceRegistry()
    return _registry
