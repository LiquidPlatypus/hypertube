from .model import RegisterRequest, LoginRequest, GoogleToken, SuccessException
from .database import storage
from fastapi import APIRouter, HTTPException
from google.oauth2 import id_token
from google.auth.transport import requests
from datetime import timedelta
from .utils import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, GOOGLE_CLIENT_ID

router = APIRouter()

@router.post("/api/register")
async def register(data: RegisterRequest):
	"""
	Return Value : \n
	True if account was be created or else False
	"""
	users_list = storage.get_all_users()
	for user in users_list:
		if user["email"] == data.email:
			return {"returnValue": False}
	
	user = storage.add_user(data.username, data.email, data.password, data.firstName, data.lastName)
	return {"returnValue": True}

@router.post("/api/login")
async def login(data: LoginRequest):
	"""
	Return Value : \n
	The access token and token type or raise 401 error
	"""
	users_list = storage.get_all_users()
	for user in users_list:
		if user["username"] == data.username and storage.get_user_password(user["id"]) == data.password:
			access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
			access_token = create_access_token(data={"sub": str(user["id"])}, expires_delta=access_token_expires)
			return {"access_token": access_token, "token_type": "bearer"}

	raise HTTPException(
		status_code=401,
		detail="Invalid username or password",
	)

@router.post("/api/google-auth")
async def google_login(data: GoogleToken):
	user = None
	try:
		idinfo = id_token.verify_oauth2_token(data.token, requests.Request(), GOOGLE_CLIENT_ID)
		google_id = idinfo["sub"]
		username = idinfo["name"]
		lastname = idinfo["family_name"]
		firstname = idinfo["given_name"]
		email = idinfo["email"]
		profile_pic = idinfo["picture"]
		users = storage.get_all_users()

		for user in users:
			if user["email"] == email:
				raise SuccessException("Profile already create")
		user = storage.add_user(username, email, google_id, firstname, lastname)
		storage.add_profile_pic(user["id"], profile_pic)
		raise SuccessException("Profile create now")
	except SuccessException as e:
		access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
		access_token = create_access_token(data={"sub": str(user["id"])}, expires_delta=access_token_expires)
		return {"access_token": access_token, "token_type": "bearer"}
	except Exception as e:
		print(f"Google error expection: {e.args[0]}")
		if e.args[0] == "family_name":
			raise HTTPException(
				status_code=418,
				detail="Missing information in google account"
			)
		raise HTTPException(
			status_code=400,
			detail="Invalid Google Token"
		)

@router.post("/api/auto-log")
async def auto_log():
	"""
	Print all profile value and return Login token
	"""
	username = "debug"
	password = "debug"
	email = "email@debug.com"
	firstName = "debug"
	lastName = "debug"
	Ulist = storage.get_all_users()
	for u in Ulist:
		if u["email"] == email:
			access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
			access_token = create_access_token(data={"sub": str(u["id"])}, expires_delta=access_token_expires)
			return {"access_token": access_token, "token_type": "bearer"}			
	user = storage.add_user(username, email, password, firstName, lastName)
	print(f"username: {username}\npassword: {password}\nemail: {email}\nfirstname: {firstName}\nlastname: {lastName}")
	access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
	access_token = create_access_token(data={"sub": str(user["id"])}, expires_delta=access_token_expires)
	return {"access_token": access_token, "token_type": "bearer"}
