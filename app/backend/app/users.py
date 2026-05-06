from fastapi import APIRouter, Depends, File, UploadFile, Query
from model import ModifyFormRequest, PasswordForm, NewPasswordRequest
from database import Storage, get_storage
from utils import verif_access_token
from fastapi.responses import FileResponse, JSONResponse
import os

router = APIRouter()

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

@router.get("/api/profile", response_class=JSONResponse)
async def get_other_profile(username: str = Query(max_length=50), storage: Storage = Depends(get_storage)):
	return storage.get_user_by_id(username)

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
