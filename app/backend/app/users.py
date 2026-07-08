from fastapi import APIRouter, Depends, File, UploadFile, Query, Form
from model import ModifyFormRequest, PasswordForm, NewPasswordRequest
from database import Storage, get_storage
from utils import verif_access_token
from fastapi.responses import FileResponse, JSONResponse
from pydantic import EmailStr
import os

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "../profile-pic")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.patch("/api/users")
async def modify_user(
    username: str = Form(),
    firstname: str = Form(),
    lastname: str = Form(),
    email: EmailStr = Form(),
    file: UploadFile | None = File(default=None),
    # data: ModifyFormRequest,
    current_user=Depends(verif_access_token),
    storage: Storage = Depends(get_storage)
):
    """
    Return Value :
    True if information was correct and changed or else False
    """
    file_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())
    storage.modify_user(username, email, firstname, lastname, file_path, current_user["id"])
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

# @router.post("/api/send-email")
# async def send_email(data: EmailRequest, storage: Storage = Depends(get_storage)):
#     access_token = None
#     user_list = storage.get_all_users()
#     for u in user_list:
#         if u["email"] == data.email:
#             access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
#             access_token = create_access_token(data={"sub": str(u["id"])}, expires_delta=access_token_expires)
#     if access_token == None:
#         return {"returnValue": False}
#     contenthtml = f"""<p>PAYLOAD: \n\n\nlocalhost:5173/reset/{access_token}\n\n\n:END PAYLOAD</p>"""
#     message = MessageSchema(
#         subject="Reset Password Mail",
#         recipients=[data.email],
#         body=contenthtml,
#         subtype="html"
#     )
#
#     print(message)
#     return {"returnValue": True}

@router.get("/api/users/{id}")
async def get_other_profile(id: str | int, storage: Storage = Depends(get_storage), current_user=Depends(verif_access_token)):
    if current_user["id"] == id:
        return {"user": current_user}
    return storage.get_user_by_id(id)

@router.get("/api/users/{user_id}/profile-pic")
async def get_user_profile_pic(user_id: int, current_user=Depends(verif_access_token)):
    u = storage.get_user_by_id(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    url = storage.get_profile_pic(user_id)
    if url and url[:4] == "http":
        return url
    if url is None:
        return None
    return FileResponse(url)
