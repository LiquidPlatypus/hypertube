from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from database import DB
import datetime

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
    tmdb_id = Column(Integer, unique=True, index=False)
    title = Column(String(255), nullable=False)
    release_date = Column(Date, nullable=False)
    mp4_path = Column(String(255))
    download_date = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)


def add_movie(session, tmdb_id, title, release_date, mp4_path):
    new_movie = Movie(
        tmdb_id=tmdb_id,
        title=title,
        release_date=release_date,
        mp4_path=mp4_path
    )
    session.add(new_movie)
    session.commit()
    session.refresh(new_movie)
    return new_movie

def get_movie_by_tmdb_id(session, tmdb_id):
    return session.query(Movie).filter(Movie.tmdb_id == tmdb_id).first()

def get_movie_by_title_and_date(session, title, release_date):
    return session.query(Movie).filter(
        Movie.title == title,
        Movie.release_date == release_date
    ).first()

def list_movies(session, limit=50):
    return session.query(Movie).limit(limit).all()