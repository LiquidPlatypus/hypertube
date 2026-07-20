"""Subtitles (subject III.3: English + the user's preferred language, selectable).

Three providers, merged per movie key:
  - OpenSubtitles API v1 (English + preferred language),
  - .srt files bundled inside the torrent (academic courses ship one per video),
  - subtitle tracks embedded in the container (mkv), extracted to WebVTT.

All served as text/vtt. Path components are strictly validated + realpath-checked
against SUBTITLE_DIR (anti path-traversal — eliminatory security requirement).
"""
from __future__ import annotations

import logging
import os
import re
from typing import Optional

import httpx

from . import transcode

logger = logging.getLogger(__name__)

OPENSUBS_BASE = "https://api.opensubtitles.com/api/v1"
SUBTITLE_DIR = os.getenv("SUBTITLE_DIR", "/data/subtitles")
_SAFE_RE = re.compile(r"^[A-Za-z0-9._-]+$")

# ISO-639-1 codes we accept when guessing a bundled subtitle's language from its
# filename. Anything else (e.g. the "asr" in "movie.asr.srt") falls back to "en".
KNOWN_LANGS = {
    "en", "fr", "es", "de", "it", "pt", "nl", "ru", "pl", "sv", "no", "da", "fi",
    "cs", "el", "tr", "ar", "he", "hi", "ja", "ko", "zh", "ro", "hu", "uk", "bg",
}


# ---------------------------------------------------------------------------
# Safe path helpers
# ---------------------------------------------------------------------------

def _safe_dir(key: str) -> Optional[str]:
    if not key or not _SAFE_RE.match(key):
        return None
    base = os.path.realpath(SUBTITLE_DIR)
    cand = os.path.realpath(os.path.join(base, key))
    try:
        if os.path.commonpath([base, cand]) != base:
            return None
    except ValueError:
        return None
    return cand


def _safe_path(key: str, lang: str) -> Optional[str]:
    if not key or not lang or not _SAFE_RE.match(key) or not _SAFE_RE.match(lang):
        return None
    base = os.path.realpath(SUBTITLE_DIR)
    cand = os.path.realpath(os.path.join(base, key, f"{lang}.vtt"))
    try:
        if os.path.commonpath([base, cand]) != base:
            return None
    except ValueError:
        return None
    return cand


def srt_to_vtt(srt: str) -> str:
    srt = srt.lstrip("﻿")
    vtt = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", srt)
    vtt = re.sub(r"(?m)^\d+\s*\n(?=\d{2}:\d{2})", "", vtt)
    return "WEBVTT\n\n" + vtt.strip() + "\n"


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------

async def fetch_opensubtitles(key: str, title: str, year: Optional[int], languages: list[str]) -> list[str]:
    api_key = os.getenv("OPENSUBTITLES_API_KEY")
    if not api_key:
        logger.info("[subs] OPENSUBTITLES_API_KEY unset — skipping remote fetch for %s", key)
        return []
    out_dir = _safe_dir(key)
    if out_dir is None:
        return []
    os.makedirs(out_dir, exist_ok=True)
    headers = {
        "Api-Key": api_key, "Content-Type": "application/json",
        "Accept": "application/json", "User-Agent": "Hypertube v1.0.0",
    }
    saved: list[str] = []
    async with httpx.AsyncClient(timeout=15, headers=headers) as client:
        for lang in languages:
            if not _SAFE_RE.match(lang or ""):
                continue
            vtt = _safe_path(key, lang)
            if vtt is None:
                continue
            if os.path.isfile(vtt):
                saved.append(lang)
                continue
            try:
                params: dict = {"query": title, "languages": lang}
                if year:
                    params["year"] = year
                r = await client.get(f"{OPENSUBS_BASE}/subtitles", params=params)
                if r.status_code != 200:
                    continue
                items = r.json().get("data", [])
                if not items:
                    continue
                file_id = items[0].get("attributes", {}).get("files", [{}])[0].get("file_id")
                if not file_id:
                    continue
                dl = await client.post(f"{OPENSUBS_BASE}/download", json={"file_id": file_id})
                if dl.status_code != 200:
                    continue
                link = dl.json().get("link")
                if not link:
                    continue
                srt = await client.get(link)
                if srt.status_code != 200:
                    continue
                with open(vtt, "w", encoding="utf-8") as f:
                    f.write(srt_to_vtt(srt.text))
                saved.append(lang)
                logger.info("[subs] opensubtitles saved %s/%s", key, lang)
            except Exception as e:
                logger.error("[subs] opensubtitles error %s/%s: %r", key, lang, e)
    return saved


def import_bundled_srt(key: str, video_path: str) -> list[str]:
    """Import .srt files sitting next to the video (torrent-bundled) → WebVTT.
    Language guessed from the filename suffix (``.en.srt``/``_fr.srt``), else 'en'."""
    out_dir = _safe_dir(key)
    if out_dir is None or not video_path:
        return []
    folder = os.path.dirname(video_path)
    if not os.path.isdir(folder):
        return []
    os.makedirs(out_dir, exist_ok=True)
    saved: list[str] = []
    for fname in os.listdir(folder):
        if not fname.lower().endswith(".srt"):
            continue
        # Only accept a real language code. Archive.org ships machine-generated
        # tracks named "<title>.asr.srt" — "asr" is the method, not a language,
        # and would show up as a bogus entry in the CC menu.
        m = re.search(r"[._-]([a-z]{2,3})\.srt$", fname.lower())
        lang = m.group(1) if (m and m.group(1) in KNOWN_LANGS) else "en"
        if not _SAFE_RE.match(lang):
            continue
        vtt = _safe_path(key, lang)
        if vtt is None or os.path.isfile(vtt):
            if vtt and os.path.isfile(vtt):
                saved.append(lang)
            continue
        try:
            with open(os.path.join(folder, fname), "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            with open(vtt, "w", encoding="utf-8") as f:
                f.write(srt_to_vtt(content))
            saved.append(lang)
            logger.info("[subs] bundled srt imported %s/%s", key, lang)
        except OSError as e:
            logger.warning("[subs] bundled srt import failed %s/%s: %r", key, lang, e)
    return saved


def import_embedded(key: str, video_path: str) -> list[str]:
    """Extract container-embedded subtitle tracks (mkv) → WebVTT."""
    out_dir = _safe_dir(key)
    if out_dir is None or not video_path or not os.path.isfile(video_path):
        return []
    saved: list[str] = []
    for lang, _vtt in transcode.extract_embedded_subtitles(video_path, out_dir):
        if _SAFE_RE.match(lang):
            saved.append(lang)
    return saved


def list_subtitles(key: str) -> list[str]:
    directory = _safe_dir(key)
    if directory is None or not os.path.isdir(directory):
        return []
    return sorted(
        f[:-4] for f in os.listdir(directory)
        if f.endswith(".vtt") and _SAFE_RE.match(f[:-4] or "")
    )


def subtitle_path(key: str, lang: str) -> Optional[str]:
    path = _safe_path(key, lang)
    if path is None:
        return None
    return path if os.path.isfile(path) else None
