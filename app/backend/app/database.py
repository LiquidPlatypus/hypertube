import datetime
from models_db import DB
from fastapi import Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import relationship, Session
from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime
from models_db import get_db

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

class Storage:

	def __init__(self, db):
		self.users = []
		self.password = []
		self.profile_pic = []
		self.comments = []
		self.movies = []
		self.session = db

	def add_user(self, username: str, email: str, password: str, firstname: str, lastname: str):
		"""
		DESK:
		Take all information and set in objet user before storaged in DB
		\n/!\\ PASSWORD NOT HASHED
		"""

		pwd = Password(hashed_password=password)
		user = User(
			username=username,
			email=email,
			firstname=firstname,
			lastname=lastname,
			password=pwd,
		)

		user = {"id": len(self.users) + 1, "username": username, "email": email, "firstname": firstname, "lastname": lastname}
		self.users.append(user)

		self.password.append({"user_id": user["id"], "password": password})
		# try:
		# 	self.session.add(user)
		# 	self.session.commit()
		# 	# self.refresh(user)
		# 	print(user.id)
		# except IntegrityError as Ie:
		# 	print(f"test :: {Ie}")

		return user

	def get_user_by_id(self, user_id: int):
		"""
		DESK:
		Get an user id and return corresponding objet
		"""
		for u in self.users:
			if u["id"] == user_id:
				return u
		return None

	def modify_user(self, username: str, email: str, firstname: str, lastname: str, user_id: int):
		"""
		DESK:
		Remove user corresponding of gived id, and recreate with new info + old id
		"""
		for u in self.users:
			if u["id"] == user_id:
				self.users.remove(u)
				break
		new_user = {"id": user_id, "username": username, "email": email, "firstname": firstname, "lastname": lastname}
		self.users.append(new_user)

	def get_user_password(self, user_id: int):
		"""
		DESK:
		Get an user id and return corresponding password
		\n/!\\ PASSWORD NOT HASHED
		"""
		for p in self.password:
			if p["user_id"] == user_id:
				return p["password"]
		return None

	def get_all_users(self):
		"""
		DESK:
		Return list of user (without password)
		"""
		return self.users
	

	def modify_password(self, new_password: str, user_id: int):
		"""
		DESK:
		Remove old password and replace it by the new
		"""
		for p in self.password:
			if p["user_id"] == user_id:
				self.password.remove(p)
				self.password.append({"user_id": user_id, "password": new_password})
		return None
	
	def add_profile_pic(self, user_id: int, image_url: str):
		"""
		DESK:
		Set in db new image profile and replace old by new
		"""
		for i in self.profile_pic:
			if i["user_id"] == user_id:
				self.profile_pic.remove(i)
		self.profile_pic.append({"user_id": user_id, "image_url": image_url})
	
	def get_profile_pic(self, user_id: int):
		"""
		DESK:
		Return URL of user image or None if he haven't
		"""
		for i in self.profile_pic:
			if i["user_id"] == user_id:
				return i["image_url"]
		return None
	
	# HERE
	def add_comment(self, content: str, author: str):
		"""
		DESK:
		Set in DB the comment and metadata of this
		date : mm/jj/aaaa : must be an array of int: 0[mm], 1[jj], 2[aaaa]
		author : author username
		"""
		date = datetime.datetime.now()
		comment = {"id": len(self.comments) + 1, "content": content, "author": author, "date": date}
		self.comments.append(comment)
		return comment
		
	def get_comment(self, id):
		for i in self.comments:
				if i["id"] == id:
						return i
		return None

	def custom_comment(self, id: int, new_content: str):
		for i in self.comments:
				if i["id"] == id:
						comment = {"id": i["id"], "content": new_content, "author": i["author"], "date": i["date"]}
						self.comments.remove(i)
						self.comments.append(comment)
						return comment
		return None

	def get_comments(self, chunk):
		chunk_comments = []
		len = sum([1 for c in self.comments]) - 1
		max = chunk + 9
		while (chunk <= max):
			try:
				chunk_comments.append(self.comments[len - chunk])
			except:
				break
			chunk += 1
		return chunk_comments

	def add_movie(self, title: str, release_date: str, mp4_path: str):
		"""
		DESK:
		Store movie in DB
		"""
		movie = {"title": title, "release_date": release_date, "mp4_path": mp4}
		self.movies.append(movie)
		return movie
	
	def get_movie(self, title: str, release_date: str):
		"""
		DESK:
		Get mp4_path from a move in DB with title and release_date
		"""
		for m in self.movies:
			if m["title"] == title and m["release_date"] == release_date:
				return m.mp4_path
		return None

	def remove_movie(self, title: str, release_date: str):
		"""
		DESK:
		Remove movie in DB with title and release_date
		"""
		for m in self.movies:
			if m["title"] == title and m["release_date"] == release_date:
				self.movies.remove(m)
				return True
		return False

def get_storage(db: Session = Depends(get_db)):
	return Storage(db)

storage = Storage(db = Depends(get_db))
