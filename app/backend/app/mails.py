from datetime import timedelta
from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

from model import EmailRequest
from database import Storage, get_storage
from utils import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

conf = ConnectionConfig(
	MAIL_USERNAME="test@example.com",
	MAIL_PASSWORD="password",
	MAIL_PORT=1025,
	MAIL_SERVER="mailpit",
	MAIL_FROM="test@example.com",
	MAIL_STARTTLS = False,
	MAIL_SSL_TLS = False,
	USE_CREDENTIALS=False,
)

@router.post("/api/reset-email")
async def send_email(
	data: EmailRequest,
	background_tasks: BackgroundTasks,
	storage: Storage = Depends(get_storage)
):
	access_token = None
	user_list = storage.get_all_users()
	for u in user_list:
		if u["email"] == data.email:
			access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
			access_token = create_access_token(data={"sub": str(u["id"])}, expires_delta=access_token_expires)
	if access_token == None:
		return {"returnValue": False}
	contenthtml = f"""<p>localhost:5173/reset/{access_token}</p> <button>Hello</button>"""
	message = MessageSchema(
		subject="Reset Password Mail",
		recipients=[data.email],
		body=contenthtml,
		subtype=MessageType.html
	)

	fm = FastMail(conf)
	background_tasks.add_task(fm.send_message, message)
	return {"returnValue": True}
