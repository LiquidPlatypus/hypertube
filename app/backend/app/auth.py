from model import RegisterRequest, LoginRequest, GoogleToken, SuccessException, UnifiedAuthRequest
from database import get_storage, Storage
from fastapi import APIRouter, HTTPException, Depends, Body
from google.oauth2 import id_token
from google.auth.transport import requests
from fastapi.responses import JSONResponse
from oauthlib.oauth2 import WebApplicationClient
from requests_oauthlib import OAuth2Session
from datetime import timedelta
from utils import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, GOOGLE_CLIENT_ID
import tmdbsimple as tmdb
import os
import secrets

router = APIRouter()

tmdb.API_KEY = os.getenv("TMDB_API_KEY")
tmdb.REQUESTS_TIMEOUT = 5

FT_UID=os.getenv("FT_UID")
FT_SECRET=os.getenv("FT_SECRET")
FT_REDIRECT_URI=os.getenv("FT_REDIRECT_URI")

@router.post("/api/oauth/token")
async def oauth_token(data: UnifiedAuthRequest, storage: Storage = Depends(get_storage)):

    if data.provider == "42":
        if not data.token:
            raise HTTPException(status_code=406, detail="No code received")
        return await ft_login(code=data.token, storage=storage)

    elif data.provider == "google":
        if not data.token:
            raise HTTPException(status_code=400, detail="Invalid Google Token")
        google_data = GoogleToken(token=data.token)
        return await google_login(data=google_data, storage=storage)

    elif data.provider == "register":
        register_data = RegisterRequest(
            username=data.username,
            password=data.password,
            email=data.email,
            firstName=data.firstName,
            lastName=data.lastName
        )
        return await register(data=register_data, storage=storage)

    else:
        raise HTTPException(status_code=400, detail="Unknown provider strategy")

async def register(data: RegisterRequest, storage: Storage = Depends(get_storage)):
	"""
	Return Value : \n
	True if account was be created or else False
	"""
	users_list = storage.get_all_users()
	for user in users_list:
		if user["email"] == data.email:
			return {"returnValue": False}
	
	user = storage.add_user(data.username, data.email, data.password, data.firstName, data.lastName)
	access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
	access_token = create_access_token(data={"sub": str(user["id"])}, expires_delta=access_token_expires)
	return {"access_token": access_token, "token_type": "bearer"}

@router.post("/api/login")
async def login(data: LoginRequest, storage: Storage = Depends(get_storage)):
	"""
	Return Value : \n
	The access token and token type or raise 401 error
	"""
	users_list = storage.get_all_users()
	for user in users_list:
		# Verify against the stored bcrypt hash — never an equality test, which
		# would only work if the password were stored in clear text.
		if user["username"] == data.username and storage.verify_user_password(user["id"], data.password):
			access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
			access_token = create_access_token(data={"sub": str(user["id"])}, expires_delta=access_token_expires)
			return {"access_token": access_token, "token_type": "bearer"}

	raise HTTPException(
		status_code=401,
		detail="Invalid username or password",
	)

async def ft_login(code: str = Body(embed=True), storage: Storage = Depends(get_storage)):
	if not code:
		raise HTTPException(
			status_code=406,
			detail="No code received"
		)
	current_user = None
	try:
		client = WebApplicationClient(client_id=FT_UID)
		oauth = OAuth2Session(client=client, redirect_uri=FT_REDIRECT_URI)
		token = oauth.fetch_token(
			token_url="https://api.intra.42.fr/oauth/token",
			code=code,
			client_secret=FT_SECRET,
		)
		response = oauth.get("https://api.intra.42.fr/v2/me")
		user_data = response.json()
		username = user_data.get("login")
		email = user_data.get("email")
		first_name = user_data.get("first_name")
		last_name = user_data.get("last_name")
		image_url = user_data.get("image", {}).get("link")
		ft_id = user_data.get("id")
		users = storage.get_all_users()
		for user in users:
			if user["email"] == email:
				current_user = user
				raise SuccessException("Profile already create")
		current_user = storage.add_user(username, email, ft_id, first_name, last_name)
		storage.add_profile_pic(current_user["id"], image_url)
		raise SuccessException("Profile create now")
	except SuccessException:
		access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
		access_token = create_access_token(data={"sub": str(current_user["id"])}, expires_delta=access_token_expires)
		return {"access_token": access_token, "token_type": "bearer"}
	except Exception as e:
		print(e)
		raise HTTPException(
			status_code=400,
			detail=f"{e}"
		)

async def google_login(data: GoogleToken, storage: Storage = Depends(get_storage)):
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
		# Never store the Google subject id as the password: it is a public
		# identifier, so it would become a valid login credential. The account
		# authenticates through Google only.
		user = storage.add_user(username, email, secrets.token_urlsafe(48), firstname, lastname)
		storage.set_unusable_password(user["id"])
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
				status_code=406,
				detail="Missing information in google account"
			)
		raise HTTPException(
			status_code=400,
			detail="Invalid Google Token"
		)

# NOTE: the former POST /api/auto-log has been removed. It was an unauthenticated
# endpoint that created (or reused) a "debug" account and handed a valid bearer
# token to any caller, and printed the credentials to the logs — a complete
# authentication bypass.
