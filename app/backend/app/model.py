from pydantic import BaseModel, EmailStr
from fastapi import UploadFile, File
from typing import Optional

class UnifiedAuthRequest(BaseModel):
    provider: str  # "42", "google", ou "register"
    token: Optional[str] = None  # Contient le code 42 ou le jeton Google
    username: Optional[str] = None
    password: Optional[str] = None
    email: Optional[EmailStr] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None

class RegisterRequest(BaseModel):
	"""
	DESK: Parse Register Form Argument \n
	ARG: username, password, email, firstname, lastname
	"""
	username: str
	password: str
	email: EmailStr
	firstName: str
	lastName: str
	
class LoginRequest(BaseModel):
	"""
	DESK: Parse Login Form Argument \n
	ARG: username, password
	"""
	username: str
	password: str
	
class ModifyFormRequest(BaseModel):
	"""
	DESK: Parse Modify Form Argument \n
	ARG: username, firstname, lastname
	"""
	username: str
	firstname: str
	lastname: str
	email: EmailStr
	file: UploadFile | None = File(default=None)

class PasswordForm(BaseModel):
	"""
	DESK: Parse Password Form argument \n
	ARG: new_password, old_password
	"""
	new_password: str
	old_password: str


class EmailRequest(BaseModel):
    email: EmailStr

class NewPasswordRequest(BaseModel):
	newpassword: str

class FortyTwoCode(BaseModel):
	code: str
	state: str | None = None

class GoogleToken(BaseModel):
	token: str

class SuccessException(Exception):
	def __init__(self, message):
		super().__init__(message)
		self.message = message

class CommentForm(BaseModel):
	content: str
	movie_id: int

class ChunkCommentForm(BaseModel):
	chunk: int

class ChunkInfoForm(BaseModel):
	pos: int
