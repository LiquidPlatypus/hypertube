import datetime
from datetime import timezone
import enum
import json
from typing import Optional, List
from models_db import DB
from fastapi import Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import relationship, Session
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Float, Text, func, update as sql_update
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
    id = Column(Integer, primary_key=True, index=True)
    archive_id    = Column(String(255), unique=True, index=True, nullable=False)
    tmdb_id       = Column(Integer, nullable=True, index=True)
    title = Column(String(255), nullable=False)
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
            pic = self.session.query(ProfilePic).filter(ProfilePic.user_id == element).first()
        else:
            user =  convert_user_format(self.session.query(User).filter(User.id == element).first())
            pic: ProfilePic = self.session.query(ProfilePic).filter(ProfilePic.user_id == user['id']).first()
        if not pic:
            return {'user_id': user['id'], 'username': user['username'], 'pic_url': None}
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
