from pydantic import BaseModel, EmailStr

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
	ARG: username, email, firstname, lastname
	"""
	username: str
	email: str
	firstname: str
	lastname: str