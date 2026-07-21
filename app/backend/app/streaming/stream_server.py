"""Streaming orchestration: turn a movie row into bytes on the wire.

Decides between raw Range serving (native + complete), a static fMP4 remux/
transcode (complete but non-native), and a growing fMP4 (still downloading), and
drives the player's SSE progress overlay. Everything downstream is non-blocking:
the torrent runs in the engine, ffmpeg in daemon threads.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Optional

from fastapi import Request
from fastapi.responses import FileResponse, Response, StreamingResponse

from database import (
    Movie, MovieStatus, get_movie_by_id,
    update_movie_status, update_movie_path, touch_last_streamed, set_movie_file_index,
)
from models_db import SessionLocal

from . import ranges, transcode
from .sources import get_registry
from .torrent_engine import get_engine

logger = logging.getLogger(__name__)

# Per-movie lock: the player opens the stream endpoint AND the SSE progress feed
# at the same time, so both call ensure_pipeline() concurrently for one movie.
# Serialising per movie means only the first writes the DB status / starts the
# download; the second sees the handle and returns early (no concurrent UPDATE).
_pipeline_locks: dict[int, asyncio.Lock] = {}


def _pipeline_lock(movie_id: int) -> asyncio.Lock:
    lock = _pipeline_locks.get(movie_id)
    if lock is None:
        lock = asyncio.Lock()
        _pipeline_locks[movie_id] = lock
    return lock


def _disk_complete(path: str, min_ratio: float = 0.99) -> bool:
    try:
        st = os.stat(path)
    except OSError:
        return False
    return st.st_size > 0 and (st.st_blocks * 512) >= st.st_size * min_ratio


def _movie_key(movie: Movie) -> str:
    return movie.archive_id


def _source_of(movie: Movie) -> tuple[str, str]:
    """(source, source_id) with legacy fallback (old rows are archive.org)."""
    source = movie.source or "archive_org"
    source_id = movie.source_id or (movie.archive_id if source == "archive_org" else movie.archive_id.split("__", 1)[-1])
    return source, source_id


async def _resolve_torrent_url(movie: Movie) -> Optional[str]:
    if movie.torrent_url:
        return movie.torrent_url
    source, source_id = _source_of(movie)
    url = await get_registry().resolve_torrent(source, source_id)
    if url:
        db = SessionLocal()
        try:
            m = get_movie_by_id(db, movie.id)
            if m:
                m.torrent_url = url
                db.commit()
        except Exception:
            db.rollback()  # cosmetic cache write — never fail the stream over it
        finally:
            db.close()
    return url


async def ensure_pipeline(movie_id: int, file_index: Optional[int] = None) -> tuple[str, Optional[str]]:
    """Idempotently ensure a download is running. Returns (state, path) where
    state ∈ {ready, downloading, error}. Safe to call from both the stream
    endpoint and the SSE loop (serialised per movie). ``file_index`` selects a
    file inside a multi-file (academic) torrent — persisted before download."""
    engine = get_engine()
    async with _pipeline_lock(movie_id):
        db = SessionLocal()
        try:
            movie = get_movie_by_id(db, movie_id)
            if movie is None:
                return "error", None
            # Already on disk?
            if movie.status == MovieStatus.ready and movie.mp4_path and os.path.isfile(movie.mp4_path):
                return "ready", movie.mp4_path
            if engine.has_handle(movie_id):
                return "downloading", engine.target_file_path(movie_id)
            # Persist the chosen file before the download starts (multi-file bundles).
            if file_index is not None and movie.file_index != file_index:
                set_movie_file_index(db, movie_id, file_index)
            torrent_url = await _resolve_torrent_url(movie)
            if not torrent_url:
                update_movie_status(db, movie_id, MovieStatus.failed)
                return "error", None
            update_movie_status(db, movie_id, MovieStatus.downloading)
            key = _movie_key(movie)
            effective_index = file_index if file_index is not None else movie.file_index
        finally:
            db.close()
        try:
            await engine.ensure_download(torrent_url, movie_id, key, effective_index)
        except Exception as e:
            logger.error("[stream] ensure_download failed movie_id=%s: %r", movie_id, e)
            _set_status(movie_id, MovieStatus.failed)
            return "error", None
        return "downloading", engine.target_file_path(movie_id)


def _set_status(movie_id: int, status: MovieStatus) -> None:
    db = SessionLocal()
    try:
        update_movie_status(db, movie_id, status)
    finally:
        db.close()


def _mark_streamed(movie_id: int) -> None:
    db = SessionLocal()
    try:
        touch_last_streamed(db, movie_id)
    finally:
        db.close()


def _finalize_if_complete(movie_id: int, path: str) -> None:
    """When the torrent has fully landed, persist ready + path so future visits
    skip the download."""
    db = SessionLocal()
    try:
        movie = get_movie_by_id(db, movie_id)
        if movie and movie.status != MovieStatus.ready:
            update_movie_path(db, movie_id, path)
            update_movie_status(db, movie_id, MovieStatus.ready)
    finally:
        db.close()


def _serve_video(path: str, movie_id: int, request: Request, prefer_complete: bool) -> Response:
    """Pick the serving strategy for a resolved video file."""
    engine = get_engine()
    complete = prefer_complete or (not engine.has_handle(movie_id) and _disk_complete(path)) or engine.is_complete(movie_id)

    if complete and _disk_complete(path):
        _finalize_if_complete(movie_id, path)
        if transcode.is_browser_native(path):
            return ranges.range_response(path, request)
        # Non-native complete file → static fMP4, seekable once done.
        transcode.ensure_static_fmp4(path)
        _tmp, final, done = transcode.cache_paths(path)
        if os.path.exists(done) and os.path.exists(final):
            return ranges.range_response(final, request)
        return StreamingResponse(transcode.tail_fmp4(path), media_type="video/mp4")

    # Still downloading.
    ext = os.path.splitext(path.lower())[1]
    if ext in transcode.DIRECT_EXTS and engine.is_complete(movie_id) and _disk_complete(path):
        return ranges.range_response(path, request)
    transcode.ensure_growing_fmp4(path, lambda: engine.contiguous_bytes(movie_id))
    return StreamingResponse(transcode.tail_fmp4(path), media_type="video/mp4")


async def serve_stream(movie_id: int, request: Request, complete: bool = False, file_index: Optional[int] = None) -> Response:
    engine = get_engine()
    _mark_streamed(movie_id)

    # Fast path: ready + on disk.
    db = SessionLocal()
    try:
        movie = get_movie_by_id(db, movie_id)
        if movie is None:
            return Response(status_code=404)
        ready_path = movie.mp4_path if (movie.status == MovieStatus.ready and movie.mp4_path and os.path.isfile(movie.mp4_path)) else None
    finally:
        db.close()
    if ready_path:
        return _serve_video(ready_path, movie_id, request, prefer_complete=True)

    state, path = await ensure_pipeline(movie_id, file_index)
    if state == "error":
        return Response(status_code=502, content="stream source unavailable")
    if state == "ready" and path:
        return _serve_video(path, movie_id, request, prefer_complete=True)

    # Wait for the start buffer (bounded) if not ready yet.
    if not engine.is_buffer_ready(movie_id):
        try:
            await engine.wait_for_buffer(movie_id, timeout=300)
        except (asyncio.TimeoutError, KeyError):
            return Response(status_code=504, content="buffering timed out")
    path = engine.target_file_path(movie_id) or path
    if not path:
        return Response(status_code=502, content="no video file")

    # Natively playable + index available → serve the sparse file itself with
    # piece-aware Range. The browser sees the real size/duration (full seek bar)
    # and any seek just re-prioritises the pieces behind it. No transcoding.
    if engine.has_tail(movie_id) and await asyncio.to_thread(transcode.is_browser_native, path):
        return ranges.piece_aware_range_response(path, request, movie_id, engine)

    return _serve_video(path, movie_id, request, prefer_complete=complete)


# ---------------------------------------------------------------------------
# HLS (segmented) delivery
# ---------------------------------------------------------------------------

async def _hls_source(movie_id: int, file_index: Optional[int] = None) -> Optional[str]:
    """Resolve the video path and make sure an HLS writer is running for it."""
    engine = get_engine()
    state, path = await ensure_pipeline(movie_id, file_index)
    if state == "error":
        return None
    if state == "ready" and path:
        _start_hls_for(movie_id, path)
        return path
    if not engine.is_buffer_ready(movie_id):
        try:
            await engine.wait_for_buffer(movie_id, timeout=300)
        except (asyncio.TimeoutError, KeyError):
            return None
    path = engine.target_file_path(movie_id) or path
    if not path:
        return None
    # If we can build a VOD playlist, segments are produced on demand — starting
    # the progressive whole-file encoder as well would just burn CPU twice.
    if not await asyncio.to_thread(transcode.cached_duration, path):
        _start_hls_for(movie_id, path)
    return path


def _start_hls_for(movie_id: int, path: str) -> None:
    """Kick the progressive HLS writer (fallback mode, when the duration is not
    known so we cannot publish a complete playlist).

    complete file → direct; streamable container → bounded FIFO; moov-at-end
    MP4 whose tail has landed → real seekable file behind the read gate.
    """
    engine = get_engine()
    if _disk_complete(path) and not engine.has_handle(movie_id):
        transcode.ensure_hls(path, None)
    elif transcode.can_stream_from_pipe(path):
        transcode.ensure_hls(path, lambda: engine.contiguous_bytes(movie_id))
    elif engine.has_tail(movie_id):
        transcode.ensure_hls(path, lambda: engine.contiguous_bytes(movie_id), seekable=True)


def _playlist_response(body: str) -> Response:
    return Response(
        content=body,
        media_type="application/vnd.apple.mpegurl",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


async def serve_hls_playlist(movie_id: int, file_index: Optional[int] = None) -> Response:
    _mark_streamed(movie_id)
    path = await _hls_source(movie_id, file_index)
    if not path:
        return Response(status_code=502, content="stream source unavailable")

    # Preferred: a COMPLETE VOD playlist built from the media duration. Every
    # segment is listed up front, so the player shows the whole timeline and can
    # seek anywhere; each segment is transcoded only when actually requested.
    duration = await asyncio.to_thread(transcode.cached_duration, path)
    if duration:
        return _playlist_response(transcode.build_vod_playlist(duration))

    # Fallback (duration not probeable yet): progressive playlist that grows.
    playlist = transcode.hls_playlist(path)
    # Wait (bounded) for the first segment so the player never gets an empty
    # playlist, which hls.js reports as a fatal error.
    waited = 0.0
    while not transcode.hls_ready(path) and waited < 120.0:
        await asyncio.sleep(0.5)
        waited += 0.5
    if not os.path.isfile(playlist):
        return Response(status_code=504, content="playlist not ready")
    try:
        with open(playlist, "r", encoding="utf-8", errors="replace") as f:
            body = f.read()
    except OSError:
        return Response(status_code=503, content="playlist unavailable")
    return _playlist_response(body)


async def _serve_vod_segment(movie_id: int, path: str, index: int) -> Response:
    """Produce (or reuse) one on-demand segment.

    This is what makes seeking work while downloading: we translate the segment
    index into a byte window, pull those pieces to the front of the torrent
    queue, wait for them, then transcode just that slice.
    """
    engine = get_engine()
    # Must run before the cache shortcut below, otherwise a segment produced
    # with a different segment length would be served straight from disk.
    await asyncio.to_thread(transcode.ensure_segment_cache_valid, path)
    cached = transcode.vod_segment_path(path, index)
    if os.path.isfile(cached) and os.path.getsize(cached) > 0:
        return FileResponse(cached, media_type="video/mp2t",
                            headers={"Cache-Control": "public, max-age=31536000, immutable"})

    duration = await asyncio.to_thread(transcode.cached_duration, path)
    if not duration:
        return Response(status_code=503, content="duration unknown")

    if engine.has_handle(movie_id):
        size = engine.file_size(movie_id) or 0
        start, end = transcode.vod_byte_window(path, index, duration, size)
        if not await engine.wait_for_range(movie_id, start, end, timeout=180):
            return Response(status_code=504, content="segment data not available yet")

    out = await asyncio.to_thread(transcode.ensure_vod_segment, path, index)
    if not out:
        return Response(status_code=500, content="segment transcode failed")
    return FileResponse(out, media_type="video/mp2t",
                        headers={"Cache-Control": "public, max-age=31536000, immutable"})


async def serve_hls_segment(movie_id: int, segment: str) -> Response:
    """Serve one .ts segment. The name is validated against a strict pattern and
    the resolved path is confined to the movie's own HLS directory."""
    vod = transcode.VOD_SEGMENT_RE.match(segment or "")
    if not vod and not transcode.SEGMENT_RE.match(segment or ""):
        return Response(status_code=400, content="bad segment name")
    engine = get_engine()
    db = SessionLocal()
    try:
        movie = get_movie_by_id(db, movie_id)
        if movie is None:
            return Response(status_code=404)
        path = movie.mp4_path
    finally:
        db.close()
    path = path or engine.target_file_path(movie_id)
    if not path:
        return Response(status_code=404)

    # On-demand VOD segment: generated (and cached) on first request.
    if vod:
        return await _serve_vod_segment(movie_id, path, int(vod.group(1)))

    base = os.path.realpath(transcode.hls_dir(path))
    candidate = os.path.realpath(os.path.join(base, segment))
    try:
        if os.path.commonpath([base, candidate]) != base:
            return Response(status_code=400, content="bad segment path")
    except ValueError:
        return Response(status_code=400, content="bad segment path")
    if not os.path.isfile(candidate):
        return Response(status_code=404)
    return FileResponse(
        candidate, media_type="video/mp2t",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


async def ready_status(movie_id: int) -> dict:
    """Cheap poll used by the player to switch to the seekable complete file."""
    engine = get_engine()
    db = SessionLocal()
    try:
        movie = get_movie_by_id(db, movie_id)
        if movie is None:
            return {"downloaded": False}
        if movie.status == MovieStatus.ready and movie.mp4_path and _disk_complete(movie.mp4_path):
            return {"downloaded": True}
    finally:
        db.close()
    path = engine.target_file_path(movie_id)
    if path and engine.is_complete(movie_id) and _disk_complete(path):
        _finalize_if_complete(movie_id, path)
        return {"downloaded": True}
    return {"downloaded": False}


async def progress_events(movie_id: int, file_index: Optional[int] = None):
    """SSE generator driving the overlay. Emits until the video is playable
    (status 'idle') or the pipeline fails (status 'error')."""
    engine = get_engine()

    def payload(status: str, **extra) -> dict:
        return {"data": json.dumps({"status": status, "progress": 0.0, **extra})}

    # Kick the pipeline (idempotent).
    state, path = await ensure_pipeline(movie_id, file_index)
    if state == "ready":
        yield payload("idle", progress=100.0)
        return
    if state == "error":
        yield payload("error")
        return

    stale = 0
    while True:
        prog = engine.get_progress(movie_id)
        if prog is None:
            # Handle gone: either finished (ready) or aborted (error).
            db = SessionLocal()
            try:
                movie = get_movie_by_id(db, movie_id)
                status = movie.status if movie else None
            finally:
                db.close()
            if status == MovieStatus.ready:
                yield payload("idle", progress=100.0)
            else:
                yield payload("error")
            return

        path = engine.target_file_path(movie_id) or path
        buffered = engine.is_buffer_ready(movie_id)

        if buffered and path:
            file_done = engine.is_complete(movie_id) or _disk_complete(path)
            # The container index (moov) is what unlocks probing, full duration
            # and seeking. Once it is there we can commit to a delivery mode.
            index_ready = file_done or engine.has_tail(movie_id)

            if index_ready and await asyncio.to_thread(transcode.is_browser_native, path):
                # Natively playable: serve the file itself with piece-aware Range
                # — full seek bar and no ffmpeg, even mid-download.
                yield payload("idle", progress=100.0 if file_done else prog["progress"],
                              mode="direct")
                return

            if index_ready and await asyncio.to_thread(transcode.cached_duration, path):
                # Needs transcoding, but we know the duration → publish the full
                # VOD playlist and transcode segments on demand. Full seek bar.
                yield payload("idle", progress=prog["progress"], mode="hls")
                return
            # Fall back to the progressive writer. The player only mounts once we
            # report idle, so the writer has to be kicked from here — otherwise
            # the playlist is never requested and nothing ever starts.
            #
            # A pipe-streamable container (mkv/ogv/avi/ts…) needs NO index to get
            # going, so it must not be gated on the tail: only a moov-at-end MP4
            # has to wait for it.
            if not transcode.can_stream_from_pipe(path) and not index_ready:
                yield payload("downloading", progress=prog["progress"],
                              speed_kbs=prog["speed_kbs"], peers=prog["peers"],
                              downloaded_mb=prog["downloaded_mb"])
                await asyncio.sleep(1.0)
                continue
            _start_hls_for(movie_id, path)
            if transcode.hls_ready(path):
                yield payload("idle", progress=prog["progress"], mode="hls")
                return
            if transcode.is_cache_ready(path):  # fMP4 fallback already warm
                yield payload("idle", progress=prog["progress"], mode="direct")
                return
            yield payload("transcoding", progress=prog["progress"],
                          segments=transcode.hls_segment_count(path))
        else:
            yield payload("downloading", progress=prog["progress"],
                          speed_kbs=prog["speed_kbs"], peers=prog["peers"],
                          downloaded_mb=prog["downloaded_mb"])

        # Safety: bail if nothing is happening for too long.
        if prog["peers"] == 0 and prog["speed_kbs"] == 0 and not buffered:
            stale += 1
            if stale > 300:  # ~5 min
                yield payload("error")
                return
        else:
            stale = 0
        await asyncio.sleep(1.0)
