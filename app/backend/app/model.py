from pydantic import BaseModel, EmailStr
from fastapi import UploadFile, File

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
	file: UploadFile = File(...)

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

class GoogleToken(BaseModel):
	token: str

class SuccessException(Exception):
	def __init__(self, message):
		super().__init__(message)
		self.message = message

class CommentForm(BaseModel):
	content: str

class ChunkCommentForm(BaseModel):
	chunk: int

class CustomCommentForm(BaseModel):
	id: int
	new_content: str

class ChunkInfoForm(BaseModel):
	pos: int
