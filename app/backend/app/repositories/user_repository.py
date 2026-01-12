from sqlalchemy.orm import Session
from ..models_db import User, Password
from passlib.context import CryptContext
from typing import Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def add_user(self, username: str, email: str, password: str, firstname: str, lastname: str) -> User:
        hashed_password = self.hash_password(password)
        user = User(username=username, email=email, firstname=firstname, lastname=lastname)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        password_entry = Password(user_id=user.id, hashed_password=hashed_password)
        self.db.add(password_entry)
        self.db.commit()
        return user

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_user_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def get_user_password(self, user_id: int) -> Optional[str]:
        password_entry = self.db.query(Password).filter(Password.user_id == user_id).first()
        return password_entry.hashed_password if password_entry else None

    def modify_user(self, user_id: int, username: str, firstname: str, lastname: str) -> Optional[User]:
        user = self.get_user_by_id(user_id)
        if user:
            user.username = username
            user.firstname = firstname
            user.lastname = lastname
            self.db.commit()
            self.db.refresh(user)
        return user

    def modify_password(self, user_id: int, new_password: str) -> bool:
        password_entry = self.db.query(Password).filter(Password.user_id == user_id).first()
        if password_entry:
            password_entry.hashed_password = self.hash_password(new_password)
            self.db.commit()
            return True
        return False

    def get_all_users(self) -> list[User]:
        return self.db.query(User).all()