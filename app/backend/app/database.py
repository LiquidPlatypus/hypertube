import datetime
from datetime import timezone
import enum
import json
from typing import Optional, List
from models_db import DB
from fastapi import Depends
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import relationship, Session
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Float, Text, func, UniqueConstraint, update as sql_update
from models_db import get_db


class MovieStatus(str, enum.Enum):
    pending     = "pending"
    downloading = "downloading"
    ready       = "ready"
    failed      = "failed"


class User(DB):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    email = Column(String(100), unique=True, index=True)
    firstname = Column(String(50))
    lastname = Column(String(50))
    # Preferred subtitle/UI language (ISO-639-1). Defaults to English (subject
    # III.1). Feeds the OpenSubtitles fetch (EN + this) and the TMDb locale.
    preferred_language = Column(String(8), default="en", nullable=False, server_default="en")
    password = relationship("Password", uselist=False)


class Password(DB):
    __tablename__ = "passwords"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    hashed_password = Column(String(255))


class Movie(DB):
    __tablename__ = "movies"
    id = Column(Integer, primary_key=True, index=True)
    # ``archive_id`` is the legacy unique key (Archive.org slug). Kept for the
    # existing rows/UI. Multi-source identity is carried by (source, source_id):
    # for archive.org source_id == archive_id; for academic_torrents it's the
    # infohash. archive_id is derived from source_id so the old code path and the
    # subtitle/thumbnail helpers keep working during and after the migration.
    archive_id    = Column(String(255), unique=True, index=True, nullable=False)
    source        = Column(String(32), default="archive_org", nullable=False, server_default="archive_org")
    source_id     = Column(String(255), nullable=True, index=True)
    media_kind    = Column(String(16), default="film", nullable=False, server_default="film")  # film | video
    tmdb_id       = Column(Integer, nullable=True, index=True)
    title = Column(String(255), nullable=False)
    year          = Column(Integer, nullable=True)
    mp4_path      = Column(String(512), nullable=True)
    # For multi-file torrents (e.g. an academic course = N videos), the file the
    # user chose to stream. Null for single-file items (archive.org films).
    file_index    = Column(Integer, nullable=True)
    torrent_url   = Column(String(512), nullable=True)
    status        = Column(Enum(MovieStatus), default=MovieStatus.pending, nullable=False)
    watch_count   = Column(Integer, default=0, nullable=False)
    last_watched  = Column(DateTime, nullable=True)
    # Last time ANY user streamed this movie — drives the 30-day retention purge
    # (subject III.3) independently of the per-user watched badge (watch_history).
    last_streamed_at = Column(DateTime, nullable=True)
    download_date = Column(DateTime, nullable=True)
    poster_url    = Column(String(512), nullable=True)
    overview      = Column(Text, nullable=True)
    runtime       = Column(Integer, nullable=True)
    rating        = Column(Float, nullable=True)
    genres_json   = Column(String(512), nullable=True)
    cast_json     = Column(Text, nullable=True)


class WatchHistory(DB):
    """Per-user watched state (subject III.2.2: differentiate watched/unwatched
    per user). One row per (user, movie); ``watched_at`` refreshed on each view."""
    __tablename__ = "watch_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id  = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    movie_id = Column(Integer, ForeignKey("movies.id"), index=True, nullable=False)
    watched_at = Column(DateTime, nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "movie_id", name="uq_watch_user_movie"),)


class ProfilePic(DB):
    __tablename__ = "picture"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    url = Column(String(255))


class Comment(DB):
    __tablename__ = "comment"
    id = Column(Integer, primary_key=True, index=True)
    # author = Column(String(255))
    author_id = Column(Integer, ForeignKey("users.id"))
    movie_id = Column(Integer, ForeignKey("movies.id"), index=True, nullable=True)
    date = Column(String(255))
    content = Column(String(255))


# ---------------------------------------------------------------------------
# Movie helpers
# ---------------------------------------------------------------------------

def get_movie_by_archive_id(session: Session, archive_id: str) -> Optional[Movie]:
    return session.query(Movie).filter(Movie.archive_id == archive_id).first()


def get_movie_by_id(session: Session, movie_id: int) -> Optional[Movie]:
    return session.query(Movie).filter(Movie.id == movie_id).first()


def create_or_get_movie(session: Session, archive_id: str, title: str, year: Optional[int]) -> Movie:
    existing = get_movie_by_archive_id(session, archive_id)
    if existing:
        return existing
    movie = Movie(archive_id=archive_id, title=title, year=year)
    session.add(movie)
    try:
        session.commit()
        session.refresh(movie)
    except IntegrityError:
        session.rollback()
        return get_movie_by_archive_id(session, archive_id)
    return movie


def create_or_get_source_movie(
    session: Session,
    source: str,
    source_id: str,
    title: str,
    year: Optional[int],
    media_kind: str = "film",
) -> Movie:
    """Multi-source upsert keyed on (source, source_id).

    ``archive_id`` stays the DB-wide unique key: for archive.org it equals the
    slug; for other sources we namespace it (``<source>:<source_id>``) so the
    unique constraint never collides across sources.
    """
    # archive_id must stay filesystem/URL/subtitle-safe (matches ^[A-Za-z0-9._-]+$).
    # Namespace non-archive sources with "__" (not ":") so it passes that charset.
    if source == "archive_org":
        archive_id = source_id
    else:
        archive_id = f"{source}__{source_id}"
    existing = get_movie_by_archive_id(session, archive_id)
    if existing:
        return existing
    movie = Movie(
        archive_id=archive_id, source=source, source_id=source_id,
        title=title, year=year, media_kind=media_kind,
    )
    session.add(movie)
    try:
        session.commit()
        session.refresh(movie)
    except IntegrityError:
        session.rollback()
        return get_movie_by_archive_id(session, archive_id)
    return movie


def _commit_with_retry(session: Session, stmt, attempts: int = 3) -> None:
    """Execute + commit, retrying MariaDB error 1020 ("Record has changed since
    last read") which the Aria/MyISAM engine raises under concurrent updates of
    the same row (the SSE progress loop and the stream endpoint both touch a
    movie row at once). Rolls back and retries; gives up quietly after `attempts`
    so a cosmetic status write never crashes a request."""
    import time as _t
    for i in range(attempts):
        try:
            session.execute(stmt)
            session.commit()
            return
        except OperationalError as e:
            session.rollback()
            if getattr(e.orig, "args", [None])[0] != 1020 or i == attempts - 1:
                import logging
                logging.getLogger(__name__).warning("DB update skipped: %s", e)
                return
            _t.sleep(0.05 * (i + 1))
        except Exception as e:
            session.rollback()
            import logging
            logging.getLogger(__name__).warning("DB update skipped: %s", e)
            return


def update_movie_status(session: Session, movie_id: int, status: MovieStatus) -> None:
    _commit_with_retry(session, sql_update(Movie).where(Movie.id == movie_id).values(status=status))


def set_movie_file_index(session: Session, movie_id: int, file_index: Optional[int]) -> None:
    _commit_with_retry(session, sql_update(Movie).where(Movie.id == movie_id).values(file_index=file_index))


def touch_last_streamed(session: Session, movie_id: int) -> None:
    """Bump ``last_streamed_at`` (retention clock). Swallow concurrent-update
    errors — this is a cosmetic timestamp, never worth failing a stream over."""
    try:
        session.execute(
            sql_update(Movie).where(Movie.id == movie_id).values(
                last_streamed_at=datetime.datetime.now(timezone.utc)
            )
        )
        session.commit()
    except Exception:
        session.rollback()


# ---------------------------------------------------------------------------
# Per-user watched state (subject III.2.2)
# ---------------------------------------------------------------------------

def mark_watched_by_user(session: Session, user_id: int, movie_id: int) -> None:
    """Upsert a (user, movie) watch row. Idempotent — refreshes watched_at."""
    now = datetime.datetime.now(timezone.utc)
    try:
        row = (
            session.query(WatchHistory)
            .filter(WatchHistory.user_id == user_id, WatchHistory.movie_id == movie_id)
            .first()
        )
        if row:
            row.watched_at = now
        else:
            session.add(WatchHistory(user_id=user_id, movie_id=movie_id, watched_at=now))
        session.commit()
    except IntegrityError:
        session.rollback()
    except Exception:
        session.rollback()


def get_watched_movie_ids(session: Session, user_id: int) -> set:
    rows = session.query(WatchHistory.movie_id).filter(WatchHistory.user_id == user_id).all()
    return {r[0] for r in rows}


def is_watched_by_user(session: Session, user_id: int, movie_id: int) -> bool:
    return (
        session.query(WatchHistory.id)
        .filter(WatchHistory.user_id == user_id, WatchHistory.movie_id == movie_id)
        .first()
        is not None
    )


def update_movie_path(session: Session, movie_id: int, path: Optional[str]) -> None:
    values = {"mp4_path": path}
    if path:
        values["download_date"] = datetime.datetime.now(timezone.utc)
    _commit_with_retry(session, sql_update(Movie).where(Movie.id == movie_id).values(**values))


def update_movie_tmdb(session: Session, movie_id: int, data: dict) -> None:
    genres = data.get("genres", [])
    cast   = data.get("cast", [])
    _commit_with_retry(
        session,
        sql_update(Movie).where(Movie.id == movie_id).values(
            tmdb_id    = data.get("tmdb_id"),
            poster_url = data.get("poster_url"),
            overview   = data.get("overview"),
            rating     = data.get("rating"),
            runtime    = data.get("runtime"),
            genres_json = json.dumps(genres) if genres else None,
            cast_json   = json.dumps(cast)   if cast   else None,
        ),
    )


_last_watched_call: dict[int, float] = {}
_WATCH_DEDUP_SECONDS = 60.0


def mark_movie_watched(session: Session, movie_id: int) -> None:
    # In-memory dedup: ignore repeated calls within 60s. Browser <video> can
    # fire many requests for one viewing (preflight, Range probes, retries) —
    # only one of those should bump watch_count.
    import time as _time
    now = _time.monotonic()
    last = _last_watched_call.get(movie_id, 0.0)
    if now - last < _WATCH_DEDUP_SECONDS:
        return
    _last_watched_call[movie_id] = now

    # MariaDB MyISAM/Aria can raise (1020, "Record has changed since last read")
    # under concurrent updates. Watch count is cosmetic — swallow and rollback.
    try:
        session.execute(
            sql_update(Movie).where(Movie.id == movie_id).values(
                watch_count  = Movie.watch_count + 1,
                last_watched = datetime.datetime.now(timezone.utc),
            )
        )
        session.commit()
    except Exception as e:
        session.rollback()
        import logging
        logging.getLogger(__name__).warning(
            "mark_movie_watched skipped for movie_id=%s (%s)", movie_id, e
        )


def get_movies_unwatched_since(session: Session, cutoff: datetime.datetime) -> List[Movie]:
    """Movies with a file on disk that no user has streamed/watched since
    ``cutoff`` (subject III.3: purge after a month unwatched). Retention clock =
    the most recent of last_streamed_at / last_watched; NULL on both means it was
    downloaded but never viewed → eligible."""
    return (
        session.query(Movie)
        .filter(Movie.mp4_path != None)
        .filter(
            ((Movie.last_streamed_at == None) | (Movie.last_streamed_at < cutoff))
            & ((Movie.last_watched == None) | (Movie.last_watched < cutoff))
        )
        .all()
    )


def get_popular_movies(session: Session, limit: int = 100) -> List[Movie]:
    return session.query(Movie).order_by(Movie.id).limit(limit).all()


def query_movies_db(
    session: Session,
    *,
    genre: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    min_rating: Optional[float] = None,
    sort: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> List[Movie]:
    """Filter + sort + paginate the movie library at the SQL layer.

    Filtering and ordering must happen in the query (not on an already-sliced
    page) so the criteria apply across the whole library and pagination stays
    correct for the frontend's infinite scroll.

    ``genre`` matches a name against the JSON array stored in ``genres_json``
    (e.g. ``["Action","Drama"]``) via a lowercased LIKE on the quoted element,
    so ``"comedy"`` matches ``"Comedy"`` but not ``"Romantic Comedy"`` as a
    substring accident.
    """
    q = session.query(Movie)
    if year_from is not None:
        q = q.filter(Movie.year.isnot(None), Movie.year >= year_from)
    if year_to is not None:
        q = q.filter(Movie.year.isnot(None), Movie.year <= year_to)
    if min_rating is not None:
        q = q.filter(Movie.rating.isnot(None), Movie.rating >= min_rating)
    if genre:
        q = q.filter(func.lower(Movie.genres_json).like(f'%"{genre.lower()}"%'))

    if sort == "rating_desc":
        q = q.order_by(Movie.rating.is_(None), Movie.rating.desc())
    elif sort == "rating_asc":
        q = q.order_by(Movie.rating.asc())
    elif sort == "year_desc":
        q = q.order_by(Movie.year.is_(None), Movie.year.desc())
    elif sort == "year_asc":
        q = q.order_by(Movie.year.asc())
    elif sort == "title_asc":
        q = q.order_by(func.lower(Movie.title).asc())
    else:  # relevance / default → seeding order (≈ popularity)
        q = q.order_by(Movie.id)

    return q.offset(page_size * (page - 1)).limit(page_size).all()


def count_movies_db(session: Session) -> int:
    return session.query(Movie).count()


def get_movie_by_tmdb_id(session: Session, tmdb_id: int) -> Optional[Movie]:
    return session.query(Movie).filter(Movie.tmdb_id == tmdb_id).first()


# ---------------------------------------------------------------------------
# Misc converters
# ---------------------------------------------------------------------------

def convert_user_format(user: User):
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "firstname": user.firstname,
        "lastname": user.lastname,
    }


def convert_comment_format(comment: Comment, session: Session):
    if not comment:
        return None
    author = session.query(User).filter(User.id == comment.author_id).first()
    author_username = author.username if author else None
    res = {
        "id": comment.id,
        "author": author_username,
        "author_id": comment.author_id,
        "movie_id": comment.movie_id,
        "date": comment.date,
        "content": comment.content,
    }
    return res


def get_comments_for_movie(session: Session, movie_id: int, chunk: int = 0) -> list:
    """Return a page of 10 comments for one movie, newest first."""
    rows = (
        session.query(Comment)
        .filter(Comment.movie_id == movie_id)
        .order_by(Comment.id.desc())
        .offset(chunk)
        .limit(10)
        .all()
    )
    return [convert_comment_format(c, session) for c in rows]


def count_comments_for_movie(session: Session, movie_id: int) -> int:
    return session.query(Comment).filter(Comment.movie_id == movie_id).count()

# ---------------------------------------------------------------------------
# Storage class (legacy — kept for auth/users/comment routes)
# ---------------------------------------------------------------------------

class Storage:

    def __init__(self, db):
        self.session = db

    def add_user(self, username: str, email: str, password: str, firstname: str, lastname: str):
        pwd = Password(hashed_password=password)
        user = User(
            username=username,
            email=email,
            firstname=firstname,
            lastname=lastname,
            password=pwd,
        )
        try:
            self.session.add(user)
            self.session.commit()
        except IntegrityError as ie:
            print(f"add_user error: {ie}")
        return convert_user_format(user)

    def get_user_by_id(self, element: int | str, iscurrent: bool = False):
        if iscurrent == True:
            return convert_user_format(self.session.query(User).filter(User.id == element).first())
        if isinstance(element, str):
            user = convert_user_format(self.session.query(User).filter(User.username == element).first())
            if not user:
                return {'error': 'No user found'}
            pic = self.session.query(ProfilePic).filter(ProfilePic.user_id == user["id"]).first()
        else:
            user =  convert_user_format(self.session.query(User).filter(User.id == element).first())
            if not user:
                return {'error': 'No user found'}
            pic: ProfilePic = self.session.query(ProfilePic).filter(ProfilePic.user_id == user['id']).first()
        if not pic:
            return {'user_id': user['id'], 'username': user['username'], 'pic_url': None}
        elif pic.url[:4] != "http":
            with open(pic.url, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                data_url = f"data:image/jpeg;base64,{encoded_string}"
                return {'user_id': user['id'], 'username': user['username'], 'pic_url': data_url}
        return {'user_id': user['id'], 'username': user['username'], 'pic_url': pic.url}

    def modify_user(self, username: str, email: str, firstname: str, lastname: str, image_url: str, user_id: int):
        """
        DESK:
        Remove user corresponding of gived id, and recreate with new info + old id
        """
        target = self.session.query(User).filter(User.id == user_id).first()
        if target:
            target.username = username
            target.email = email
            target.firstname = firstname
            target.lastname = lastname
            pic: ProfilePic = self.session.query(ProfilePic).filter(ProfilePic.user_id == user_id).first()
            if pic:
                pic.url = image_url
                self.session.commit()
            else:
                profilepic = ProfilePic(
                    user_id=user_id,
                    url=image_url
                )
                self.session.add(profilepic)
                self.session.commit()

    def get_user_password(self, user_id: int):
        user: User = self.session.query(User).filter(User.id == user_id).first()
        if not user:
            return None
        return user.password.hashed_password

    def modify_password(self, new_password: str, user_id: int):
        target: Password = self.session.query(Password).filter(Password.user_id == user_id).first()
        if not target:
            return None
        target.hashed_password = new_password
        self.session.commit()

    def get_all_users(self):
        """
        DESK:
        Return list of user (without password)
        """
        users_list = self.session.query(User).all()
        users = []
        for it in users_list:
            user = convert_user_format(it)
            users.append(user)
        return users

    def add_profile_pic(self, user_id: int, image_url: str):
        img: ProfilePic = self.session.query(ProfilePic).filter(ProfilePic.user_id == user_id).first()
        if not img:
            self.session.add(ProfilePic(user_id=user_id, url=image_url))
        else:
            img.url = image_url
        self.session.commit()

    def get_profile_pic(self, user_id: int):
        instance: ProfilePic = self.session.query(ProfilePic).filter(ProfilePic.user_id == user_id).first()
        return instance.url if instance else None

    def add_comment(self, content: str, author_id: int, movie_id: int = None):
        date = datetime.datetime.now()
        comment = Comment(content=content, author_id=author_id, movie_id=movie_id, date=date)
        self.session.add(comment)
        self.session.commit()
        return convert_comment_format(comment, self.session)

    def get_comment(self, id):
        return convert_comment_format(self.session.query(Comment).filter(Comment.id == id).first(), self.session)

    def custom_comment(self, id: int, new_content: str, user_id: int):
        comment: Comment = self.session.query(Comment).filter(Comment.id == id).first()
        if not comment:
            return None
        if comment.author_id != user_id:
            return "forbidden"
        comment.content = new_content
        self.session.commit()
        return convert_comment_format(comment, self.session)

    def delete_comments(self, comment_id: int, user_id: int):
        comment: Comment = self.session.query(Comment).filter(Comment.id == comment_id).first()
        if not comment:
            return None
        if comment.author_id != user_id:
            return "forbidden"
        self.session.delete(comment)
        self.session.commit()
        return True

    def get_comments(self, chunk):
        comments_list = self.session.query(Comment).all()
        comments = [
            {"id": it.id, "content": it.content, "author": self.session.query(User).filter(User.id == it.author_id).first().username, "date": it.date}
            for it in comments_list
        ]
        comments_reversed = comments[::-1]
        return comments_reversed[chunk : chunk + 10]


def get_storage(db: Session = Depends(get_db)):
    return Storage(db)
