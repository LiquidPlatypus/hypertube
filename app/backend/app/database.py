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

class ProfilePic(DB):
	__tablename__ = "picture"
	id = Column(Integer, primary_key=True, index=True)
	user_id = Column(Integer, ForeignKey("users.id"), unique=True)
	url = Column(String(255))

class Comment(DB):
	__tablename__ = "comment"
	id = Column(Integer, primary_key=True, index=True)
	author = Column(String(255))
	date = Column(String(255))
	content = Column(String(255))

def get_movie_by_tmdb_id(session, tmdb_id):
    return session.query(Movie).filter(Movie.tmdb_id == tmdb_id).first()

def convert_user_format(user: User):
	if not user:
		return None
	res = {"id": user.id, "username": user.username, "email": user.email, "firstname": user.firstname, "lastname": user.lastname}
	return res

def convert_comment_format(comment: Comment):
	if not comment:
		return None
	res = {"id": comment.id, "author": comment.author, "date": comment.date, "content": comment.content}
	return res

class Storage:

	def __init__(self, db):
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

		# self.password.append({"user_id": user["id"], "password": password})
		try:
			self.session.add(user)
			self.session.commit()
			print(user.id)
		except IntegrityError as Ie:
			print(f"test :: {Ie}")

		return convert_user_format(user)

	def get_user_by_id(self, user_id: int):
		"""
		DESK:
		Get an user id and return corresponding objet
		"""
		return convert_user_format(self.session.query(User).filter(User.id == user_id).first())

	def modify_user(self, username: str, email: str, firstname: str, lastname: str, user_id: int):
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
			target.commit()

	def get_user_password(self, user_id: int):
		"""
		DESK:
		Get an user id and return corresponding password
		\n/!\\ PASSWORD NOT HASHED
		"""
		user: User = self.session.query(User).filter(User.id == user_id).first()
		if not user:
			return None
		return user.password.hashed_password

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

	def modify_password(self, new_password: str, user_id: int):
		"""
		DESK:
		Remove old password and replace it by the new
		"""
		target: Password = self.session.query(Password).filter(Password.user_id == user_id).first()
		if not target:
			return None
		target.hashed_password = new_password
		self.session.commit()

	def add_profile_pic(self, user_id: int, image_url: str):
		"""
		DESK:
		Set in db new image profile and replace old by new
		"""
		profilepic = ProfilePic(
			user_id=user_id,
			url=image_url
		)
		self.session.add(profilepic)
		self.commit()

	def get_profile_pic(self, user_id: int):
		"""
		DESK:
		Return URL of user image or None if he haven't
		"""
		instance: ProfilePic = self.session.query(ProfilePic).filter(ProfilePic.user_id == user_id).first()
		return instance.url

	def add_comment(self, content: str, author: str):
		"""
		DESK:
		Set in DB the comment and metadata of this
		date : mm/jj/aaaa : must be an array of int: 0[mm], 1[jj], 2[aaaa]
		author : author username
		"""
		date = datetime.datetime.now()
		comment = Comment(
			content=content,
			author=author,
			date=date
		)
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
		comments = []
		for it in comments_list:
			comment = {"id": it.id, "content": it.content, "author": it.author, "date": it.date}
			comments.append(comment)
		chunk_comments = []
		len = sum([1 for c in comments]) - 1
		max = chunk + 9
		while (chunk <= max):
			try:
				chunk_comments.append(comments[len - chunk])
			except:
				break
			chunk += 1
		return chunk_comments

	# def add_movie(self, title: str, release_date: str, mp4_path: str):
	# 	"""
	# 	DESK:
	# 	Store movie in DB
	# 	"""
	# 	movie = {"title": title, "release_date": release_date, "mp4_path": mp4}
	# 	self.movies.append(movie)
	# 	return movie
	
	# def get_movie(self, title: str, release_date: str):
	# 	"""
	# 	DESK:
	# 	Get mp4_path from a move in DB with title and release_date
	# 	"""
	# 	for m in self.movies:
	# 		if m["title"] == title and m["release_date"] == release_date:
	# 			return m.mp4_path
	# 	return None

	# def remove_movie(self, title: str, release_date: str):
	# 	"""
	# 	DESK:
	# 	Remove movie in DB with title and release_date
	# 	"""
	# 	for m in self.movies:
	# 		if m["title"] == title and m["release_date"] == release_date:
	# 			self.movies.remove(m)
	# 			return True
	# 	return False

def get_storage(db: Session = Depends(get_db)):
	return Storage(db)
