from fastapi import APIRouter, Depends, File, UploadFile
from model import ModifyFormRequest, PasswordForm, NewPasswordRequest, EmailRequest
from database import Storage, get_storage
from utils import create_access_token, verif_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from fastapi.responses import FileResponse
from datetime import timedelta
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
import os

router = APIRouter()
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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "../profile-pic")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/api/modify-profile")
async def modify_user(data: ModifyFormRequest, current_user=Depends(verif_access_token), storage: Storage = Depends(get_storage)):
	"""
	Return Value :
	True if information was correct and changed or else False
	"""
	user = storage.modify_user(data.username, data.email, data.firstname, data.lastname, current_user["id"])
	return {"returnValue": True}

@router.post("/api/upload-picture")
async def upload_picture(
	file: UploadFile = File(...),
	current_user=Depends(verif_access_token),
	storage: Storage=Depends(get_storage)
):
	file_path = os.path.join(UPLOAD_DIR, file.filename)

	with open(file_path, "wb") as buffer:
		buffer.write(file.file.read())
	storage.add_profile_pic(current_user["id"], file_path)
	return {"returnValue": True}

@router.get("/api/me/profile-pic")
async def get_current_profile_pic(current_user=Depends(verif_access_token), storage: Storage = Depends(get_storage)):
	url = storage.get_profile_pic(current_user["id"])
	if url and url[:4] == "http":
		return url
	if url == None:
		return None
	return FileResponse(url)

@router.get("/api/me")
async def read_user_me(current_user=Depends(verif_access_token)):
	return {"user": current_user}

@router.post("/api/reset-password")
async def reset_password(data: PasswordForm, current_user=Depends(verif_access_token), storage: Storage = Depends(get_storage)):
	"""
	Return Value :
	True if information was correct and changed or else False
	"""
	if storage.get_user_password(current_user["id"]) == data.old_password:
		storage.modify_password(data.new_password, current_user["id"])
		return {"returnValue": True}
	return {"returnValue": False}

@router.post("/api/reset-forgot-password")
async def reset_forgot_password(data: NewPasswordRequest, current_user=Depends(verif_access_token), storage: Storage = Depends(get_storage)):
	storage.modify_password(data.newpassword, current_user["id"])
	return {"returnValue": True}

@router.post("/api/forgot-password")
async def forgot_password(current_user=Depends(verif_access_token)):
	username = current_user["username"]
	print(f"{username} load forgot password form\n")
	return {"returnValue": True}

@router.post("/api/send-email")
async def send_email(data: EmailRequest, storage: Storage = Depends(get_storage)):
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

