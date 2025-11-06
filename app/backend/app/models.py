from sqlalchemy import Column, Integer, String
from database import DB

class User(DB):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(15))
    email = Column(String(100), unique=True, index=True)
    password = Column(String(100))