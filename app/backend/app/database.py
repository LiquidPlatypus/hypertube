from sqlalchemy import create_engine, inspect
from os import getenv
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


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

SessionLocal = sessionmaker(autocomit=False, autoflush=False, bind=engine)

DB = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    inspector = inspect(engine)
    tables_exists = inspector.get_table_names()

    if not tables_exists:
        print("Creating database tables...")
        DB.metadata.create_all(bind=engine)
        print("Database tables created.")
    else:
        print("Database tables already exist.")