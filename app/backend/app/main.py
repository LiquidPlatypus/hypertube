from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from jose import JWTError, jwt
import os

# INIT

app = FastAPI()

SECRET_KEY = "super_secret_key" # Ben faut proteger sa niveau sécurité sinon t'es pas gentil
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="access_token")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:5173"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

class Storage:
	def __init__(self):
		self.users = []
		self.password = []

	def add_user(self, username: str, email: str, password: str):

		user = {"id": len(self.users) + 1, "username": username, "email": email}
		self.users.append(user)

		self.password.append({"user_id": user["id"], "password": password})
		return user

	def get_user_password(self, user_id: int):
		for p in self.password:
			if p["user_id"] == user_id:
				return p["password"]
		return None

	def get_all_users(self):
		return self.users

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

class RegisterRequest(BaseModel):
	username: str
	password: str
	email: EmailStr

@app.post("/api/register")
async def register(data: RegisterRequest):
	users_list = storage.get_all_users()
	for user in users_list:
		if user["email"] == data.email:
			return {"returnValue": False}
	user = storage.add_user(data.username, data.email, data.password)
	return {"returnValue": True}

class LoginRequest(BaseModel):
	username: str
	password: str

@app.post("/api/login")
async def login(data: LoginRequest):
	users_list = storage.get_all_users()
	for user in users_list:
		if user["username"] == data.username and storage.get_user_password(user["id"]) == data.password:
			access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
			access_token = create_access_token(data={"sub": user["username"]}, expires_delta=access_token_expires)
			return {"access_token": access_token, "token_type": "bearer"}

	raise HTTPException(
		status_code=401,
		detail="Invalid username or password",
	)
	
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
		return payload
	except JWTError:
		return None

@app.get("/api/verify-token/{token}")
async def verify_user_token(token: str):
	res = verif_access_token(token)
	if res == None:
		raise HTTPException(
			status_code=401,
			detail="Unauthorized"
		)
	return {"message": "Token is valid"}

@app.get("/api/hello")
async def get_hello(current_user=Depends(verif_access_token)):
	return {"message": "Hello from FastAPI 👋"}
