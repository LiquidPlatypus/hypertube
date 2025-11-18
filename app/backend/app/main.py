import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse, FileResponse
from datetime import datetime, timedelta
from jose import JWTError, jwt
from .model import RegisterRequest, LoginRequest, ModifyFormRequest, PasswordForm, EmailRequest, NewPasswordRequest
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from .database import Storage
from fastapi import UploadFile, File
from google.oauth2 import id_token
from google.auth.transport import requests
import jwt

# INIT

app = FastAPI()

SECRET_KEY = "super_secret_key" # Ben faut proteger sa niveau sécurité sinon t'es pas gentil
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

GOOGLE_CLIENT_ID = "504765868462-ssreveurjgq1i8tuoinem6fcp0g8kv90.apps.googleusercontent.com"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="access_token")

conf = ConnectionConfig(
	MAIL_USERNAME="test@example.com",
	MAIL_PASSWORD="password",
	MAIL_PORT=1025,
	MAIL_SERVER="localhost",
	MAIL_FROM="test@example.com",
	MAIL_STARTTLS = True,
	MAIL_SSL_TLS = False,
	USE_CREDENTIALS=False,
)

app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:5173"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

@app.middleware("http")
async def verif_header(request: Request, call_next):
	headers = request.scope['headers']
	element = request.headers.get('sec-fetch-user')
	if element is not None:
		return JSONResponse(status_code=403, content={'reason': "Forbidden"})
	response = await call_next(request)
	return response

storage = Storage()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "../profile-pic")

os.makedirs(UPLOAD_DIR, exist_ok=True)

# CODE


# @app.websocket("/ws")
# async def websocket_endpoint(ws: WebSocket):
#     await ws.accept()
#     try:
#         while True:
#             data = await ws.receive_text()
#             await ws.send_text(f"Message Receive : {data}")
#     except WebSocketDisconnect:
#         print(f"❌ Client left")

def create_access_token(data: dict, expires_delta: timedelta | None = None):
	to_encode = data.copy()
	if expires_delta:
		expire = datetime.utcnow() + expires_delta
	else:
		expire = datetime.utcnow() + timedelta(minutes=15)
	to_encode.update({"exp": expire})
	encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
	return encoded_jwt

def verif_access_token(token: str = Depends(oauth2_scheme)):
	try:
		payload = jwt.decode(token, SECRET_KEY, algorithms=ALGORITHM)
		user = storage.get_user_by_id(int(payload["sub"]))
		if user == None:
			raise HTTPException(
				status_code=410,
				detail="Account not exist"
			)
		return user
	except JWTError:
		raise HTTPException(
			status_code=401,
			detail="Unauthorized"
		)


# ROUTER

@app.post("/api/register")
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

@app.post("/api/login")
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

@app.post("/api/google-auth")
async def google_login(token: str):
	try:
		idinfo = id_token.verify_oauth2_token(token, requests.Request(), GOOGLE_CLIENT_ID)
		google_id = idinfo["sub"]
		username = idinfo["name"]
		lastname = idinfo["family_name"]
		firstname = idinfo["given_name"]
		email = idinfo["email"]
		users = storage.get_all_users()

		print(idinfo["picture"])

		for user in users:
			if user["email"] == email:
				access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
				access_token = create_access_token(data={"sub": str(user["id"])}, expires_delta=access_token_expires)
				return {"access_token": access_token, "token_type": "bearer"}
		user = storage.add_user(username, email, google_id, firstname, lastname)
		access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
		access_token = create_access_token(data={"sub": str(user["id"])}, expires_delta=access_token_expires)
		return {"access_token": access_token, "token_type": "bearer"}
	except Exception:
		raise HTTPException(
			status_code=400,
			detail="Invalid Google Token"
		)

@app.get("/api/verify-token/{token}")
async def verify_user_token(token: str):
	res = verif_access_token(token)
	return {"message": "Token is valid"}

@app.post("/api/modify-profile")
async def modify_user(data: ModifyFormRequest, current_user=Depends(verif_access_token)):
	"""
	Return Value :
	True if information was correct and changed or else False
	"""
	user = storage.modify_user(data.username, data.email, data.firstname, data.lastname, current_user["id"])
	return {"returnValue": True}

@app.post("/api/reset-password")
async def reset_password(data: PasswordForm, current_user=Depends(verif_access_token)):
	"""
	Return Value :
	True if information was correct and changed or else False
	"""
	if storage.get_user_password(current_user["id"]) == data.old_password:
		storage.modify_password(data.new_password, current_user["id"])
		return {"returnValue": True}
	return {"returnValue": False}

@app.post("/api/reset-forgot-password")
async def reset_forgot_password(data: NewPasswordRequest, current_user=Depends(verif_access_token)):
	storage.modify_password(data.newpassword, current_user["id"])
	return {"returnValue": True}

@app.post("/api/forgot-password")
async def forgot_password(current_user=Depends(verif_access_token)):
	username = current_user["username"]
	print(f"{username} load forgot password form\n")
	return {"returnValue": True}

@app.post("/api/send-email")
async def send_email(data: EmailRequest):
	access_token = None
	user_list = storage.get_all_users()
	for u in user_list:
		if u["email"] == data.email:
			access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
			access_token = create_access_token(data={"sub": str(u["id"])}, expires_delta=access_token_expires)
	if access_token == None:
		return {"returnValue": False}
	contenthtml = f"""<p>PAYLOAD: \n\n\nlocalhost:5173/reset/{access_token}\n\n\n:END PAYLOAD</p>"""
	message = MessageSchema(
		subject="Reset Password Mail",
		recipients=[data.email],
		body=contenthtml,
		subtype="html"
	)

	print(message)
	return {"returnValue": True}

@app.post("/api/upload-picture")
async def upload_picture(
	file: UploadFile = File(...),
	current_user=Depends(verif_access_token)
):
	file_path = os.path.join(UPLOAD_DIR, file.filename)

	with open(file_path, "wb") as buffer:
		buffer.write(file.file.read())
	storage.add_profile_pic(current_user["id"], file_path)
	return {"returnValue": True}

@app.get("/api/me/profile-pic")
async def get_current_profile_pic(current_user=Depends(verif_access_token)):
	url = storage.get_profile_pic(current_user["id"])
	if url == None:
		return None
	return FileResponse(url)

@app.get("/api/me")
async def read_user_me(current_user=Depends(verif_access_token)):
	return {"user": current_user}

@app.get("/api/hello")
async def get_hello():
	return {"message": "Hello from FastAPI 👋"}

# DEV/DEBUG REQUEST

@app.post("/api/auto-log")
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

# OFFICIAL PUBLIC REQUEST

