"""HTTP Range serving (subject III.3: resume/seek via Range) for a complete file.

Hardened parser (RFC 7233): validates ``bytes=start-end`` with a regex, supports
suffix ranges (``bytes=-N``), returns 416 on malformed/out-of-bounds instead of
crashing, sends ETag + conditional 304, and reads through a generator that always
closes the file handle (no leak on client disconnect).
"""
from __future__ import annotations

import os
import re
from email.utils import formatdate
from typing import Optional

from fastapi import Request
from fastapi.responses import Response, StreamingResponse

_RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")
_CHUNK = 1024 * 1024
_MIME = {".mp4": "video/mp4", ".webm": "video/webm", ".m4v": "video/mp4"}


def _content_type(path: str) -> str:
    return _MIME.get(os.path.splitext(path.lower())[1], "video/mp4")


def _etag(path: str, size: int) -> str:
    try:
        mtime = int(os.stat(path).st_mtime)
    except OSError:
        mtime = 0
    return f'"{size:x}-{mtime:x}"'


def _parse_range(header: str, size: int) -> Optional[tuple[int, int]]:
    """Return (start, end) inclusive, or None if unsatisfiable → caller sends 416."""
    m = _RANGE_RE.match(header.strip())
    if not m:
        return None
    start_s, end_s = m.group(1), m.group(2)
    if start_s == "" and end_s == "":
        return None
    if start_s == "":  # suffix: last N bytes
        n = int(end_s)
        if n == 0:
            return None
        start = max(0, size - n)
        return start, size - 1
    start = int(start_s)
    end = int(end_s) if end_s else size - 1
    if start >= size or start > end:
        return None
    return start, min(end, size - 1)


def _reader(path: str, start: int, end: int):
    remaining = end - start + 1
    with open(path, "rb") as f:
        f.seek(start)
        while remaining > 0:
            chunk = f.read(min(_CHUNK, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


def piece_aware_range_response(path: str, request: Request, movie_id: int, engine) -> Response:
    """Serve a Range from a file that is STILL DOWNLOADING.

    The sparse file already has its final size, so the browser sees the real
    duration and shows a full seek bar. Whatever byte range it asks for — the
    moov at the end, or a seek an hour in — we raise the priority of the pieces
    behind that range, wait for them, then serve. Seeking anywhere therefore
    works without transcoding anything.
    """
    size = engine.file_size(movie_id) or 0
    if size <= 0:
        return Response(status_code=404)

    ctype = _content_type(path)
    common = {"Accept-Ranges": "bytes", "Cache-Control": "no-store"}

    range_header = request.headers.get("range")
    if not range_header:
        start, end = 0, size - 1
        status = 200
        headers = {**common, "Content-Length": str(size)}
    else:
        parsed = _parse_range(range_header, size)
        if parsed is None:
            return Response(status_code=416, headers={**common, "Content-Range": f"bytes */{size}"})
        start, end = parsed
        status = 206
        headers = {
            **common,
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(end - start + 1),
        }

    def reader():
        pos = start
        with open(path, "rb") as f:
            while pos <= end:
                chunk_end = min(pos + _CHUNK - 1, end)
                # Block until the torrent has these bytes; without this we would
                # stream the sparse holes (zeros) and corrupt playback.
                if not engine.wait_for_range_sync(movie_id, pos, chunk_end):
                    return
                f.seek(pos)
                data = f.read(chunk_end - pos + 1)
                if not data:
                    return
                pos += len(data)
                yield data

    return StreamingResponse(reader(), status_code=status, media_type=ctype, headers=headers)


def range_response(path: str, request: Request) -> Response:
    try:
        size = os.path.getsize(path)
    except OSError:
        return Response(status_code=404)

    ctype = _content_type(path)
    etag = _etag(path, size)
    common = {
        "Accept-Ranges": "bytes",
        "ETag": etag,
        "Cache-Control": "private, max-age=3600",
        "Last-Modified": formatdate(os.stat(path).st_mtime, usegmt=True),
    }

    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=common)

    range_header = request.headers.get("range")
    if not range_header:
        return StreamingResponse(
            _reader(path, 0, size - 1), media_type=ctype,
            headers={**common, "Content-Length": str(size)},
        )

    parsed = _parse_range(range_header, size)
    if parsed is None:
        return Response(
            status_code=416,
            headers={**common, "Content-Range": f"bytes */{size}"},
        )
    start, end = parsed
    return StreamingResponse(
        _reader(path, start, end),
        status_code=206,
        media_type=ctype,
        headers={
            **common,
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(end - start + 1),
        },
    )
