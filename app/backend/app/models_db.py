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


def get_movie_by_tmdb_id(session, tmdb_id):
    return session.query(Movie).filter(Movie.tmdb_id == tmdb_id).first()