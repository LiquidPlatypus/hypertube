import os
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from auth import router as auth_router
from utils import verif_access_token
from users import router as users_router
#from stream import router as stream_router
from movies import router as movies_router
from comment import router as comment_router
import shutil

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

# cleanup des dl incomplets au demarrage de l'app
def cleanup_incomplete_downloads():
	download_dir = "./downloads/"
	if not os.path.exists(download_dir):
		return

	db = get_db()
	try:
		# on liste les fichiers presents dans ./downloads
		for filename in os.listdir(download_dir):
			file_path = os.path.join(download_dir, filename)

			# si fichiers listés dans db, il est complet
			is_complete = db.query(Movie).filter(Movie.mp4_path == file_path).first()
			# si incomplet, on le supprime.
			if not is_complete:
				print(f"Suppression du fichier incomplet : {file_path}")
				if os.path.isfile(file_path):
					os.remove(file_path)
				elif os.path.isdir(file_path):
					shutil.rmtree(file_path)
	finally:
		db.close()

# Init
@app.on_event("startup")
def on_startup():
	DB.metadata.create_all(bind=engine)
	cleanup_incomplete_downloads()

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
#app.include_router(stream_router)
app.include_router(movies_router)
app.include_router(comment_router)

@app.get("/api/verify-token/{token}")
async def verify_user_token(token: str):
	res = verif_access_token(token)
	return {"message": "Token is valid"}

@app.get("/api/hello")
async def get_hello():
	return {"message": "Hello from FastAPI 👋"}

