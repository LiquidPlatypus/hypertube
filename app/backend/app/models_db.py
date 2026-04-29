from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from os import getenv
import time

MARIADB_USER = getenv("MARIADB_USER")
MARIADB_PASSWORD = getenv("MARIADB_PASSWORD")
MARIADB_HOST = getenv("MARIADB_HOST")
MARIADB_DATABASE = getenv("MARIADB_DATABASE")

SQLALCHEMY_DATABASE_URL = f"mariadb+pymysql://{MARIADB_USER}:{MARIADB_PASSWORD}@{MARIADB_HOST}:3306/{MARIADB_DATABASE}"

engine = create_engine(
	SQLALCHEMY_DATABASE_URL,
	pool_pre_ping=True, #verifie la connexion avant de l'utiliser
	pool_recycle=3600,  #recycle les connexions toutes les heures
	echo=True		   #affiche les requetes sql (debug)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

DB = declarative_base()


def init_db():
	max_attempts = 5
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