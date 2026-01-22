from .model import RegisterRequest, LoginRequest, GoogleToken, SuccessException
from .database import storage
from fastapi import APIRouter, HTTPException
from google.oauth2 import id_token
from google.auth.transport import requests
from datetime import timedelta
from .utils import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, GOOGLE_CLIENT_ID
# import tmdbsimple as tmdb
import os
import httpx
from pydantic import BaseModel


router = APIRouter()

# === 42 OAuth config ===
FORTYTWO_CLIENT_ID = os.getenv("FORTYTWO_CLIENT_ID")
FORTYTWO_CLIENT_SECRET = os.getenv("FORTYTWO_CLIENT_SECRET")
FORTYTWO_REDIRECT_URI = os.getenv("FORTYTWO_REDIRECT_URI")

FT_TOKEN_URL = "https://api.intra.42.fr/oauth/token"
FT_ME_URL = "https://api.intra.42.fr/v2/me"

# tmdb.API_KEY = os.getenv("TMDB_API_KEY")
# tmdb.REQUESTS_TIMEOUT = 5

# === Pydantic model for 42 callback ===
class FortyTwoCode(BaseModel):
	code: str
	state: str | None = None


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

@router.post("/api/42-auth")
async def intra42_login(data: FortyTwoCode):
	if not (FORTYTWO_CLIENT_ID and FORTYTWO_CLIENT_SECRET and FORTYTWO_REDIRECT_URI):
		raise HTTPException(status_code=500, detail="42 OAuth env vars missing")

	try:
		async with httpx.AsyncClient(timeout=10) as client:
			# 1) Exchange code -> access token
			token_resp = await client.post(
				FT_TOKEN_URL,
				data={
					"grant_type": "authorization_code",
					"client_id": FORTYTWO_CLIENT_ID,
					"client_secret": FORTYTWO_CLIENT_SECRET,
					"code": data.code,
					"redirect_uri": FORTYTWO_REDIRECT_URI,
				},
			)

			if token_resp.status_code != 200:
				raise HTTPException(status_code=400, detail=f"42 token exchange failed: {token_resp.text}")

			access_token_42 = token_resp.json().get("access_token")
			if not access_token_42:
				raise HTTPException(status_code=400, detail="42 access_token missing")

			# 2) Fetch user profile
			me_resp = await client.get(
				FT_ME_URL,
				headers={"Authorization": f"Bearer {access_token_42}"},
			)
			if me_resp.status_code != 200:
				raise HTTPException(status_code=400, detail=f"42 /v2/me failed: {me_resp.text}")

			me = me_resp.json()

		# 3) Extract fields
		email = me.get("email")
		username = me.get("login")
		firstname = me.get("first_name") or me.get("usual_first_name")
		lastname = me.get("last_name")

		profile_pic = None
		if isinstance(me.get("image"), dict):
			profile_pic = me["image"].get("link")

		if not (email and username and firstname and lastname):
			raise HTTPException(status_code=418, detail="Missing information in 42 account")

		# 4) Find-or-create user (temp: by email)
		user = None
		for u in storage.get_all_users():
			if u["email"] == email:
				user = u
				break

		if user is None:
			# NOTE: dummy password because current storage requires one
			user = storage.add_user(username, email, "oauth42", firstname, lastname)
			if profile_pic:
				storage.add_profile_pic(user["id"], profile_pic)

		# 5) Issue your JWT
		access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
		access_token = create_access_token(data={"sub": str(user["id"])}, expires_delta=access_token_expires)
		return {"access_token": access_token, "token_type": "bearer"}

	except HTTPException:
		raise

	except Exception as e:
		print(f"42 auth error: {e}")
		raise HTTPException(status_code=400, detail="Invalid 42 code")



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