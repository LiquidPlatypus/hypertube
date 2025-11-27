from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
import os

router = APIRouter()

VIDEO_FILE="mp4/video.mp4"
CHUNK_SIZE=1024*1024 

def generate_video_stream(start: int, end: int):
    with open(VIDEO_FILE, "rb") as video:
        video.seek(start) # Deplace le curseur au debut de la plage demandé
        bytes_to_read = end - start + 1
        counter = 0
        while bytes_to_read > 0:
            read_size = min(CHUNK_SIZE, bytes_to_read)
            chunk = video.read(read_size)
            if not chunk: # ne devrait pas arriver, mais securité
                print("End of video stream")
                break
            counter += 1
            print(f"Sending chunk {counter}")
            yield chunk
            bytes_to_read -= len(chunk)


@router.get("/api/stream/video")
async def stream_video(request: Request):
    file_size = os.stat(VIDEO_FILE).st_size
    range_header = request.headers.get("range")
    if range_header:
        try:
            range_value = range_header.strip().lower().replace("bytes=", "")
            start_str, end_str = range_value.split("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Range header")
        content_length = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": "video/mp4",
        }
        return StreamingResponse(
            content=generate_video_stream(start, end),
            headers=headers,
            status_code=206,
            media_type="video/mp4")
    else:
        headers = {
            "Content-Length": str(file_size),
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
        }
        return StreamingResponse(
            content=generate_video_stream(0, file_size - 1),
            headers=headers,
            status_code=200,
            media_type="video/mp4")