import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from jose import JWTError, jwt
from .model import RegisterRequest, LoginRequest, ModifyFormRequest, PasswordForm
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from .database import Storage

# INIT

app = FastAPI()

SECRET_KEY = "super_secret_key" # Ben faut proteger sa niveau sécurité sinon t'es pas gentil
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="access_token")

conf = ConnectionConfig(
	MAIL_USERNAME="test@example.com",
	MAIL_PASSWORD="password",
	MAIL_PORT=1025,
	MAIL_SERVER="localhost",
	MAIL_TLS=False,
	MAIL_SSL=False,
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
		return Response(status_code=403) # , content={'reason': "Forbidden"}
	response = await call_next(request)
	return response

storage = Storage()


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
	user = storage.modify_user(data.username, current_user["email"], data.firstname, data.lastname, current_user["id"])
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

@app.get("/api/me")
async def read_user_me(current_user=Depends(verif_access_token)):
	return {"user": current_user}

@app.get("/api/hello")
async def get_hello():
	return {"message": "Hello from FastAPI 👋"}
