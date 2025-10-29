from pydantic import BaseModel, EmailStr

class RegisterRequest(BaseModel):
	username: str
	password: str
	email: EmailStr
	firstName: str
	lastName: str
	
class LoginRequest(BaseModel):
	username: str
	password: str
	
class ModifyFormRequest(BaseModel):
	username: str
	email: str
	firstname: str
	lastname: str