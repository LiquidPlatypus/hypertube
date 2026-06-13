import datetime
from datetime import timezone
import enum
import json
from typing import Optional, List
from models_db import DB
from fastapi import Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import relationship, Session
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Float, Text, update as sql_update
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
    password = relationship("Password", uselist=False)


class Password(DB):
    __tablename__ = "passwords"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    hashed_password = Column(String(255))


class Movie(DB):
    __tablename__ = "movies"
    id            = Column(Integer, primary_key=True, index=True)
    archive_id    = Column(String(255), unique=True, index=True, nullable=False)
    tmdb_id       = Column(Integer, nullable=True, index=True)
    title         = Column(String(255), nullable=False)
    year          = Column(Integer, nullable=True)
    mp4_path      = Column(String(512), nullable=True)
    torrent_url   = Column(String(512), nullable=True)
    status        = Column(Enum(MovieStatus), default=MovieStatus.pending, nullable=False)
    watch_count   = Column(Integer, default=0, nullable=False)
    last_watched  = Column(DateTime, nullable=True)
    download_date = Column(DateTime, nullable=True)
    poster_url    = Column(String(512), nullable=True)
    overview      = Column(Text, nullable=True)
    runtime       = Column(Integer, nullable=True)
    rating        = Column(Float, nullable=True)
    genres_json   = Column(String(512), nullable=True)
    cast_json     = Column(Text, nullable=True)


class ProfilePic(DB):
    __tablename__ = "picture"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    url = Column(String(255))


class Comment(DB):
    __tablename__ = "comment"
    id       = Column(Integer, primary_key=True, index=True)
    movie_id = Column(Integer, ForeignKey("movies.id"), nullable=True)
    author   = Column(String(255))
    date     = Column(String(255))
    content  = Column(String(255))


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


def update_movie_status(session: Session, movie_id: int, status: MovieStatus) -> None:
    session.execute(sql_update(Movie).where(Movie.id == movie_id).values(status=status))
    session.commit()


def update_movie_path(session: Session, movie_id: int, path: Optional[str]) -> None:
    values = {"mp4_path": path}
    if path:
        values["download_date"] = datetime.datetime.now(timezone.utc)
    session.execute(sql_update(Movie).where(Movie.id == movie_id).values(**values))
    session.commit()


def update_movie_tmdb(session: Session, movie_id: int, data: dict) -> None:
    genres = data.get("genres", [])
    cast   = data.get("cast", [])
    session.execute(
        sql_update(Movie).where(Movie.id == movie_id).values(
            tmdb_id    = data.get("tmdb_id"),
            poster_url = data.get("poster_url"),
            overview   = data.get("overview"),
            rating     = data.get("rating"),
            runtime    = data.get("runtime"),
            genres_json = json.dumps(genres) if genres else None,
            cast_json   = json.dumps(cast)   if cast   else None,
        )
    )
    session.commit()


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
    return (
        session.query(Movie)
        .filter(Movie.mp4_path != None)
        .filter(
            (Movie.last_watched == None) | (Movie.last_watched < cutoff)
        )
        .all()
    )


def get_popular_movies(session: Session, limit: int = 100) -> List[Movie]:
    return session.query(Movie).order_by(Movie.id).limit(limit).all()


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


def convert_comment_format(comment: Comment):
    if not comment:
        return None
    return {"id": comment.id, "author": comment.author, "date": comment.date, "content": comment.content}


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

    def get_user_by_id(self, user_id: int):
        return convert_user_format(self.session.query(User).filter(User.id == user_id).first())

    def modify_user(self, username: str, email: str, firstname: str, lastname: str, user_id: int):
        target = self.session.query(User).filter(User.id == user_id).first()
        if target:
            target.username  = username
            target.email     = email
            target.firstname = firstname
            target.lastname  = lastname
        self.session.commit()

    def get_user_password(self, user_id: int):
        user: User = self.session.query(User).filter(User.id == user_id).first()
        if not user:
            return None
        return user.password.hashed_password

    def get_all_users(self):
        return [convert_user_format(u) for u in self.session.query(User).all()]

    def modify_password(self, new_password: str, user_id: int):
        target: Password = self.session.query(Password).filter(Password.user_id == user_id).first()
        if not target:
            return None
        target.hashed_password = new_password
        self.session.commit()

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

    def add_comment(self, content: str, author: str):
        date = datetime.datetime.now()
        comment = Comment(content=content, author=author, date=date)
        self.session.add(comment)
        self.session.commit()
        return convert_comment_format(comment)

    def get_comment(self, id):
        return convert_comment_format(self.session.query(Comment).filter(Comment.id == id).first())

    def custom_comment(self, id: int, new_content: str):
        comment: Comment = self.session.query(Comment).filter(Comment.id == id).first()
        if not comment:
            return None
        comment.content = new_content
        self.session.commit()
        return convert_comment_format(comment)

    def get_comments(self, chunk):
        comments_list = self.session.query(Comment).all()
        comments = [{"id": c.id, "content": c.content, "author": c.author, "date": c.date}
                    for c in comments_list]
        chunk_comments = []
        total = len(comments) - 1
        max_pos = chunk + 9
        while chunk <= max_pos:
            try:
                chunk_comments.append(comments[total - chunk])
            except IndexError:
                break
            chunk += 1
        return chunk_comments


def get_storage(db: Session = Depends(get_db)):
    return Storage(db)
