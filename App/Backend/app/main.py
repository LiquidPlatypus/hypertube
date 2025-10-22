from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
import os

# INIT

app = FastAPI()

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
        if any(u["username"] == username for u in self.users):
            raise HTTPException(status_code=400, detail="Username already exists")

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

@app.get("/api/hello")
async def get_hello():
    return {"message": "Hello from FastAPI 👋"}

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: EmailStr

@app.post("/api/register")
async def register(data: RegisterRequest):
    user = storage.add_user(data.username, data.email, data.password)
    return {"message": f"{user['username']} has been created!", "user": user}

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def login(data: LoginRequest):
    users_list = storage.get_all_users()
    for user in users_list:
        if user["username"] == data.username and storage.get_user_password(user["id"]) == data.password:
            return {"returnValue": True}
    return {"returnValue": False}
    
