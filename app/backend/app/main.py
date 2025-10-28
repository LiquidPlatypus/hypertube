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

	def add_user(self, username: str, email: str, password: str, firstname: str, lastname: str, id: int | None = None):
		if id = None:
			len(self.users) + 1

		user = {"id": id, "username": username, "email": email, "firstname": firstname, "lastname": lastname}
		self.users.append(user)

		self.password.append({"user_id": user["id"], "password": password})
		return user

	def get_user_by_id(self, user_id: int):
		for u in self.users:
			if u["id"] == user_id:
				return u
		return None

	def remove_user(self, user_id: int):
		for u in self.users:
			if u["id"] == user_id:
				self.users.remove(u)
				break

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
	firstName: str
	lastName: str

@app.post("/api/remove-user")
async def remove_user_db(current_user=Depends(verif_access_token)):
	storage.remove_user(current_user["id"])

@app.post("/api/modify-profile")
async def modify_user(current_user=Depends(verif_access_token), data: RegisterRequest):
	storage.remove_user(current_user["id"])
	users_list = storage.get_all_users()
	for user in users_list:
		if user["email"] == data.email:
			return {"returnValue": False}
	user = storage.add_user(data.username, data.email, data.password, data.firstName, data.lastName, current_user["id"])
	return {"returnValue": True}

@app.post("/api/register")
async def register(data: RegisterRequest):
	users_list = storage.get_all_users()
	for user in users_list:
		if user["email"] == data.email:
			return {"returnValue": False}
	user = storage.add_user(data.username, data.email, data.password, data.firstName, data.lastName)
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
			access_token = create_access_token(data={"sub": str(user["id"])}, expires_delta=access_token_expires)
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
		user = storage.get_user_by_id(int(payload["sub"]))
		return user
	except JWTError:
		raise HTTPException(
			status_code=401,
			detail="Unauthorized"
		)

@app.get("/api/verify-token/{token}")
async def verify_user_token(token: str):
	res = verif_access_token(token)
	return {"message": "Token is valid"}

@app.get("/api/me")
async def read_user_me(current_user=Depends(verif_access_token)):
    return {"user": current_user}

@app.get("/api/hello")
async def get_hello(current_user=Depends(verif_access_token)):
	return {"message": "Hello from FastAPI 👋"}
