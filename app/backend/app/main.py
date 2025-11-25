import os
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .auth import router as auth_router
from .utils import verif_access_token
from .users import router as users_router

# Models Pydantic
from model import RegisterRequest, LoginRequest, ModifyFormRequest, PasswordForm, EmailRequest, NewPasswordRequest
# Models SQLAlchemy et Repository
from models_db import User, Password
from repositories.user_repository import UserRepository
from database import get_db, DB, engine 

# INIT
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Init DB
@app.on_event("startup")
def on_startup():
    DB.metadata.create_all(bind=engine)

# Middleware
@app.middleware("http")
async def verif_header(request: Request, call_next):
	headers = request.scope['headers']
	element = request.headers.get('sec-fetch-user')
	if element is not None:
		return JSONResponse(status_code=403, content={'reason': "Forbidden"})
	response = await call_next(request)
	return response

# @app.websocket("/ws")
# async def websocket_endpoint(ws: WebSocket):
#     await ws.accept()
#     try:
#         while True:
#             data = await ws.receive_text()
#             await ws.send_text(f"Message Receive : {data}")
#     except WebSocketDisconnect:
#         print(f"❌ Client left")


# ROUTER

app.include_router(auth_router)
app.include_router(users_router)

@app.get("/api/verify-token/{token}")
async def verify_user_token(token: str, db: Session = Depends(get_db)):
    user = verif_access_token(token, db)
    return {"message": "Token is valid"}

@app.get("/api/hello")
async def get_hello():
	return {"message": "Hello from FastAPI 👋"}
