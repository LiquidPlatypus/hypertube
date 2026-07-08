import asyncio
import logging
import logging.handlers
import os
import sys

# ---------------------------------------------------------------------------
# Logging setup — write to file AND keep console output
# ---------------------------------------------------------------------------

_LOG_FILE = os.getenv("LOG_FILE", "/data/logs/backend.log")
os.makedirs(os.path.dirname(_LOG_FILE), exist_ok=True)

_file_handler = logging.handlers.RotatingFileHandler(
    _LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=3, encoding="utf-8"
)
_file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-8s %(name)s: %(message)s"))

logging.getLogger().addHandler(_file_handler)
logging.getLogger().setLevel(logging.INFO)


class _Tee:
    """Write to both the original stdout and the log file."""
    def __init__(self, original, log_path: str):
        self._orig = original
        self._f = open(log_path, "a", encoding="utf-8", buffering=1)

    def write(self, data: str):
        self._orig.write(data)
        try:
            self._f.write(data)
        except Exception:
            pass

    def flush(self):
        self._orig.flush()
        try:
            self._f.flush()
        except Exception:
            pass

    def isatty(self):
        return False


sys.stdout = _Tee(sys.__stdout__, _LOG_FILE)
sys.stderr = _Tee(sys.__stderr__, _LOG_FILE)

# ---------------------------------------------------------------------------

from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from auth import router as auth_router
from utils import verif_access_token
from users import router as users_router
# from .stream import router as stream_router
from movies import router as movies_router
from comment import router as comment_router
from mails import router as mails_router
import shutil

# Models Pydantic
from model import RegisterRequest, LoginRequest, ModifyFormRequest, PasswordForm, EmailRequest, NewPasswordRequest
# Models SQLAlchemy et Repository
from database import User, Password, Storage, get_storage
from repositories.user_repository import UserRepository
from models_db import get_db, DB, engine, SessionLocal
from database import get_storage, Storage
from jose import JWTError, jwt

ALGORITHM = "HS256"
SECRET_KEY = os.getenv("SECRET_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    DB.metadata.create_all(bind=engine)
    from services.cleanup_scheduler import start_scheduler
    from movies import reap_orphan_transcodes
    reap_orphan_transcodes()
    start_scheduler()
    asyncio.create_task(_seed_movies())


@app.on_event("shutdown")
async def on_shutdown():
    from services.cleanup_scheduler import stop_scheduler
    stop_scheduler()


async def _seed_movies():
    import httpx
    from services.archive_client import seed_popular_movies
    from movies import enrich_movies_background

    for attempt in range(1, 6):
        try:
            movies = await seed_popular_movies(100)
            break
        except (httpx.ConnectError, httpx.TimeoutException, Exception) as e:
            wait = attempt * 5
            print(f"[Startup] Seeding attempt {attempt}/5 failed ({e!r}) — retrying in {wait}s")
            await asyncio.sleep(wait)
    else:
        print("[Startup] Movie seeding gave up after 5 attempts — DB will be populated on first search")
        return

    db = SessionLocal()
    seeded = []
    try:
        for m in movies:
            row = create_or_get_movie(db, m.identifier, m.title, m.year)
            if not row.poster_url and not row.tmdb_id:
                seeded.append((row.id, row.title, row.year))
    finally:
        db.close()
    print(f"[Startup] Seeded {len(movies)} movies from Archive.org")
    if seeded:
        asyncio.create_task(enrich_movies_background(seeded))


# Middleware
@app.middleware("http")
async def verif_header(request: Request, call_next):
    element = request.headers.get("sec-fetch-user")
    if element is not None:
        return JSONResponse(status_code=403, content={"reason": "Forbidden"})
    response = await call_next(request)
    return response

# @app.websocket("/ws")
# async def websocket_endpoint(ws: WebSocket):
#     await ws.accept()
#     try:
#         while True:
#             data = await ws.receive_text()
#             await ws.send_text(f"Message Receive : {data}")
#     except WebSocketDisconnect:
#         print(f"❌ Client left")


# ROUTER

app.include_router(auth_router)
app.include_router(users_router)
# app.include_router(stream_router)
app.include_router(movies_router)
app.include_router(comment_router)
app.include_router(mails_router)

@app.get("/api/verify-token/{token}")
async def verify_user_token(token: str, storage: Storage = Depends(get_storage)):
    # res = verif_access_token(token)
    # token: str = Depends(oauth2_scheme)
    # storage: Storage = Depends(get_storage)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=ALGORITHM)
        user = storage.get_user_by_id(int(payload["sub"]))
        if user is None:
            raise HTTPException(status_code=410, detail="Account not exist")
        return {"message": "Token is valid"}
    except JWTError:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/api/hello")
async def get_hello():
    return {"message": "Hello from FastAPI 👋"}
