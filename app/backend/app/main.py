import os
from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse, FileResponse
from datetime import datetime, timedelta
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from fastapi import UploadFile, File

# Models Pydantic
from model import RegisterRequest, LoginRequest, ModifyFormRequest, PasswordForm, EmailRequest, NewPasswordRequest
# Models SQLAlchemy et Repository
from models_db import User, Password
from repositories.user_repository import UserRepository
from database import get_db, DB, engine 

# INIT
app = FastAPI()
SECRET_KEY = os.getenv("SECRET_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES = 30
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="access_token")

conf = ConnectionConfig(
    MAIL_USERNAME="test@example.com",
    MAIL_PASSWORD="password",
    MAIL_PORT=1025,
    MAIL_SERVER="localhost",
    MAIL_FROM="test@example.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=False,
)

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

def verif_access_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
        repo = UserRepository(db)
        user = repo.get_user_by_id(user_id)
        if user is None:
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
async def register(data: RegisterRequest, db: Session = Depends(get_db)):
    repo = UserRepository(db)
    existing_user = repo.get_user_by_email(data.email)
    if existing_user:
        return {"returnValue": False}
    repo.add_user(data.username, data.email, data.password, data.firstName, data.lastName)
    return {"returnValue": True}

@app.post("/api/login")
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    repo = UserRepository(db)
    user = repo.get_user_by_username(data.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    password_hash = repo.get_user_password(user.id)
    if not password_hash or not repo.verify_password(data.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/verify-token/{token}")
async def verify_user_token(token: str, db: Session = Depends(get_db)):
    user = verif_access_token(token, db)
    return {"message": "Token is valid"}

@app.post("/api/modify-profile")
async def modify_user(
    data: ModifyFormRequest,
    current_user: User = Depends(verif_access_token),
    db: Session = Depends(get_db)
):
    repo = UserRepository(db)
    repo.modify_user(current_user.id, data.username, data.firstname, data.lastname)
    return {"returnValue": True}

@app.post("/api/reset-password")
async def reset_password(
    data: PasswordForm,
    current_user: User = Depends(verif_access_token),
    db: Session = Depends(get_db)
):
    repo = UserRepository(db)
    password_hash = repo.get_user_password(current_user.id)
    if not password_hash or not repo.verify_password(data.old_password, password_hash):
        return {"returnValue": False}
    repo.modify_password(current_user.id, data.new_password)
    return {"returnValue": True}

@app.post("/api/reset-forgot-password")
async def reset_forgot_password(
    data: NewPasswordRequest,
    current_user: User = Depends(verif_access_token),
    db: Session = Depends(get_db)
):
    repo = UserRepository(db)
    repo.modify_password(current_user.id, data.newpassword)
    return {"returnValue": True}

@app.post("/api/forgot-password")
async def forgot_password(current_user: User = Depends(verif_access_token)):
    print(f"{current_user.username} loaded forgot password form")
    return {"returnValue": True}

@app.post("/api/send-email")
async def send_email(data: EmailRequest, db: Session = Depends(get_db)):
    repo = UserRepository(db)
    user = repo.get_user_by_email(data.email)
    if not user:
        return {"returnValue": False}
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=access_token_expires)
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
async def read_user_me(current_user: User = Depends(verif_access_token)):
    return {"user": current_user}

@app.get("/api/hello")
async def get_hello():
    return {"message": "Hello from FastAPI 👋"}

# Route de debug
@app.post("/api/auto-log")
async def auto_log(db: Session = Depends(get_db)):
    repo = UserRepository(db)
    username = "debug"
    password = "debug"
    email = "email@debug.com"
    firstName = "debug"
    lastName = "debug"
    user = repo.add_user(username, email, password, firstName, lastName)
    print(f"username: {username}\npassword: {password}\nemail: {email}\nfirstname: {firstName}\nlastname: {lastName}")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

