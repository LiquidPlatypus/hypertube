import os
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from auth import router as auth_router
from utils import verif_access_token
from users import router as users_router
# from .stream import router as stream_router
from movies import router as movies_router
from comment import router as comment_router
from mails import router as mails_router
import shutil

# Models Pydantic
from model import RegisterRequest, LoginRequest, ModifyFormRequest, PasswordForm, EmailRequest, NewPasswordRequest
# Models SQLAlchemy et Repository
from database import User, Password, Storage, get_storage
from repositories.user_repository import UserRepository
from models_db import get_db, DB, engine
from jose import JWTError, jwt

# INIT
ALGORITHM = "HS256"
SECRET_KEY = os.getenv("SECRET_KEY")

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
# app.include_router(stream_router)
app.include_router(movies_router)
app.include_router(comment_router)
app.include_router(mails_router)

@app.get("/api/verify-token/{token}")
async def verify_user_token(token: str, storage: Storage = Depends(get_storage)):
	# res = verif_access_token(token)
	# token: str = Depends(oauth2_scheme)
	# storage: Storage = Depends(get_storage)
	try:
		payload = jwt.decode(token, SECRET_KEY, algorithms=ALGORITHM)
		user = storage.get_user_by_id(int(payload["sub"]))
		if user == None:
			raise HTTPException(
				status_code=410,
				detail="Account not exist"
			)
		return {"message": "Token is valid"}
	except JWTError:
		raise HTTPException(
			status_code=401,
			detail="Unauthorized"
		)

@app.get("/api/hello")
async def get_hello():
	return {"message": "Hello from FastAPI 👋"}
