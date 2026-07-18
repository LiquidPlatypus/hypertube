import logging
import os
import re
import httpx
from dataclasses import dataclass
from typing import Optional, List

logger = logging.getLogger(__name__)

OPENSUBS_BASE = "https://api.opensubtitles.com/api/v1"
SUBTITLE_DIR = os.getenv("SUBTITLE_DIR", "/data/subtitles")

# Restrict any user-supplied path component to a safe charset.
_SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def _safe_subtitle_path(archive_id: str, lang: str) -> Optional[str]:
    """Join SUBTITLE_DIR/archive_id/lang.vtt with strict validation.

    Returns ``None`` if either component is malformed or if the resolved path
    escapes ``SUBTITLE_DIR`` (defense in depth against path traversal).
    """
    if not archive_id or not lang:
        return None
    if not _SAFE_NAME_RE.match(archive_id) or not _SAFE_NAME_RE.match(lang):
        return None

    base_real = os.path.realpath(SUBTITLE_DIR)
    candidate = os.path.realpath(os.path.join(base_real, archive_id, f"{lang}.vtt"))
    try:
        if os.path.commonpath([base_real, candidate]) != base_real:
            return None
    except ValueError:
        # commonpath raises on different drives (Windows) or mixed absolute/relative
        return None
    return candidate


def _safe_subtitle_dir(archive_id: str) -> Optional[str]:
    """Join SUBTITLE_DIR/archive_id with the same guardrails as _safe_subtitle_path."""
    if not archive_id or not _SAFE_NAME_RE.match(archive_id):
        return None
    base_real = os.path.realpath(SUBTITLE_DIR)
    candidate = os.path.realpath(os.path.join(base_real, archive_id))
    try:
        if os.path.commonpath([base_real, candidate]) != base_real:
            return None
    except ValueError:
        return None
    return candidate


@dataclass
class SubtitleInfo:
    lang: str
    vtt_path: str


async def fetch_subtitles(
    archive_id: str,
    title: str,
    year: Optional[int],
    languages: Optional[List[str]] = None,
) -> List[SubtitleInfo]:
    if languages is None:
        languages = ["en"]

    api_key = os.getenv("OPENSUBTITLES_API_KEY")
    if not api_key:
        return []

    out_dir = _safe_subtitle_dir(archive_id)
    if out_dir is None:
        return []
    os.makedirs(out_dir, exist_ok=True)

    results = []
    headers = {
        "Api-Key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        for lang in languages:
            if not _SAFE_NAME_RE.match(lang or ""):
                continue
            vtt_path = _safe_subtitle_path(archive_id, lang)
            if vtt_path is None:
                continue
            if os.path.isfile(vtt_path):
                results.append(SubtitleInfo(lang=lang, vtt_path=vtt_path))
                continue

            params: dict = {"query": title, "languages": lang}
            if year:
                params["year"] = year

            r = await client.get(f"{OPENSUBS_BASE}/subtitles", params=params)
            if r.status_code != 200:
                continue
            data = r.json()
            items = data.get("data", [])
            if not items:
                continue

            file_id = items[0].get("attributes", {}).get("files", [{}])[0].get("file_id")
            if not file_id:
                continue

            dl_r = await client.post(f"{OPENSUBS_BASE}/download", json={"file_id": file_id})
            if dl_r.status_code != 200:
                continue
            dl_data = dl_r.json()
            srt_url = dl_data.get("link")
            if not srt_url:
                continue

            srt_r = await client.get(srt_url)
            if srt_r.status_code != 200:
                continue

            vtt_content = _srt_to_vtt(srt_r.text)
            with open(vtt_path, "w", encoding="utf-8") as f:
                f.write(vtt_content)

            results.append(SubtitleInfo(lang=lang, vtt_path=vtt_path))

    return results


def _srt_to_vtt(srt: str) -> str:
    # Remove BOM if present
    srt = srt.lstrip("﻿")
    # Replace SRT timestamp comma with VTT dot
    vtt = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt)
    # Remove sequence numbers (lines that are just digits before a timestamp block)
    vtt = re.sub(r"(?m)^\d+\s*\n(?=\d{2}:\d{2})", "", vtt)
    return "WEBVTT\n\n" + vtt.strip() + "\n"


async def get_subtitle_path(archive_id: str, lang: str) -> Optional[str]:
    path = _safe_subtitle_path(archive_id, lang)
    if path is None:
        return None
    return path if os.path.isfile(path) else None


async def list_available_subtitles(archive_id: str) -> List[str]:
    directory = _safe_subtitle_dir(archive_id)
    if directory is None or not os.path.isdir(directory):
        return []
    return [
        f[:-4]
        for f in os.listdir(directory)
        if f.endswith(".vtt") and _SAFE_NAME_RE.match(f[:-4] or "")
    ]
