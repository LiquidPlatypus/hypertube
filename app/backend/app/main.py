import asyncio
import logging
import logging.handlers
import os
import sys
from fastapi.staticfiles import StaticFiles

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
from contextlib import asynccontextmanager
from auth import router as auth_router
from utils import verif_access_token
from users import router as users_router
from streaming.api import router as streaming_router, seed_popular
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

def _run_migrations() -> None:
    """Idempotent in-place schema migrations. create_all() creates NEW tables
    (watch_history) but never ALTERs existing ones, so add the streaming columns
    here. Each ALTER is wrapped independently — a duplicate-column error just
    means it already ran."""
    from sqlalchemy import text
    statements = [
        "ALTER TABLE comment ADD COLUMN movie_id INT NULL",
        "ALTER TABLE users ADD COLUMN preferred_language VARCHAR(8) NOT NULL DEFAULT 'en'",
        "ALTER TABLE movies ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'archive_org'",
        "ALTER TABLE movies ADD COLUMN source_id VARCHAR(255) NULL",
        "ALTER TABLE movies ADD COLUMN media_kind VARCHAR(16) NOT NULL DEFAULT 'film'",
        "ALTER TABLE movies ADD COLUMN file_index INT NULL",
        "ALTER TABLE movies ADD COLUMN last_streamed_at DATETIME NULL",
        # Backfill source_id for legacy archive.org rows.
        "UPDATE movies SET source_id = archive_id WHERE source_id IS NULL AND source = 'archive_org'",
        # Root fix for MariaDB error 1020 ("Record has changed since last read"):
        # ensure row-level locking (InnoDB), not Aria/MyISAM. The player hits the
        # stream + SSE endpoints together → concurrent UPDATEs on one movie row,
        # which Aria rejects. InnoDB handles it. Idempotent (no-op if already
        # InnoDB). Convert PARENT tables before children so cross-engine foreign
        # keys don't block the ALTER.
        "ALTER TABLE users ENGINE=InnoDB",
        "ALTER TABLE movies ENGINE=InnoDB",
        "ALTER TABLE passwords ENGINE=InnoDB",
        "ALTER TABLE picture ENGINE=InnoDB",
        "ALTER TABLE comment ENGINE=InnoDB",
        "ALTER TABLE watch_history ENGINE=InnoDB",
    ]
    for stmt in statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception:
            pass  # already applied / harmless


def _hash_legacy_passwords() -> None:
    """Upgrade any password still stored in clear text to a bcrypt hash.

    Storing a plain-text password is an automatic fail (subject chap. II). This
    runs once at startup so existing accounts keep working while nothing
    readable remains in the database. A row with no usable value gets a random
    secret, making password login impossible for it rather than trivial.
    """
    import secrets
    from database import Password
    from security import hash_password, is_hashed

    db = SessionLocal()
    try:
        changed = 0
        for row in db.query(Password).all():
            if is_hashed(row.hashed_password):
                continue
            row.hashed_password = hash_password(row.hashed_password or secrets.token_urlsafe(48))
            changed += 1
        if changed:
            db.commit()
            print(f"[migration] hashed {changed} plain-text password(s)")
    except Exception as e:
        db.rollback()
        print(f"[migration] password hashing skipped: {e!r}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    DB.metadata.create_all(bind=engine)
    _run_migrations()
    _hash_legacy_passwords()
    from streaming.transcode import reap_orphans, DIRECT_EXTS  # noqa: F401
    from streaming.torrent_engine import DOWNLOAD_DIR
    from streaming.retention import start_scheduler, stop_scheduler
    reap_orphans(DOWNLOAD_DIR)
    start_scheduler()
    asyncio.create_task(_seed())
    try:
        yield
    finally:
        stop_scheduler()


async def _seed():
    """Populate the front page from the sources on startup (retry a few times —
    the network/DB may not be ready immediately)."""
    for attempt in range(1, 6):
        try:
            await seed_popular(60)
            return
        except Exception as e:
            wait = attempt * 5
            print(f"[Startup] seeding attempt {attempt}/5 failed ({e!r}) — retry in {wait}s")
            await asyncio.sleep(wait)
    print("[Startup] seeding gave up — DB fills on first search")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.mount("/api/profile-pic", StaticFiles(directory="/profile-pic"), name="profile-pic")

# Middleware
@app.middleware("http")
async def verif_header(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and "localhost" not in origin:
        return JSONResponse(status_code=403, content={"reason": "Forbidden: Invalid Origin"})
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
app.include_router(streaming_router)
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
