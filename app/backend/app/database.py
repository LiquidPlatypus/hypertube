from sqlalchemy import create_engine, text
from os import getenv
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import time
from sqlalchemy.exc import OperationalError


MARIADB_USER = getenv("MARIADB_USER")
MARIADB_PASSWORD = getenv("MARIADB_PASSWORD")
MARIADB_HOST = getenv("MARIADB_HOST")
MARIADB_DATABASE = getenv("MARIADB_DATABASE")

SQLALCHEMY_DATABASE_URL = f"mariadb+pymysql://{MARIADB_USER}:{MARIADB_PASSWORD}@{MARIADB_HOST}:3306/{MARIADB_DATABASE}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True, #verifie la connexion avant de l'utiliser
    pool_recycle=3600,  #recycle les connexions toutes les heures
    echo=True           #affiche les requetes sql (debug)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

DB = declarative_base()


def init_db():
    max_attempts = 10
    attempt = 0
    while attempt < max_attempts:
        try:
            # Teste la connexion
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            # Si la connexion réussit, crée les tables
            DB.metadata.create_all(bind=engine)
            print("Database tables created.")
            break
        except OperationalError:
            attempt += 1
            print(f"MariaDB not ready, retrying in 5 seconds... (attempt {attempt}/{max_attempts})")
            time.sleep(5)
    else:
        print("Failed to connect to MariaDB after several attempts.")

init_db()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



class Storage:
	def __init__(self):
		self.users = []
		self.password = []

	def add_user(self, username: str, email: str, password: str, firstname: str, lastname: str):
		"""
		DESK:
		Take all information and set in objet user before storaged in DB
		\n/!\\ PASSWORD NOT HASHED
		"""
		user = {"id": len(self.users) + 1, "username": username, "email": email, "firstname": firstname, "lastname": lastname}
		self.users.append(user)

		self.password.append({"user_id": user["id"], "password": password})
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