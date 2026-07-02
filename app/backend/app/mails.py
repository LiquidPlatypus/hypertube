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
	# contenthtml = f"""<p>localhost/reset/{access_token}</p> <button>Hello</button>"""
	contenthtml = f"""
		<div style="background-color: #ffffff; padding: 50px 0; text-align: center;">
			<table width="100%" border="0" cellspacing="0" cellpadding="0">
				<tr>
					<td align="center">
						<a href="https://localhost/reset/{access_token}" 
						style="display: inline-block;
								padding: 25px 50px;           /* Augmenté (Haut/Bas Gauche/Droite) */
								background-color: #f4ecd8;
								color: #5d4037;
								text-decoration: none;
								font-family: 'Times New Roman', Times, serif;
								font-size: 24px;              /* Texte plus grand */
								text-transform: uppercase;
								letter-spacing: 2px;          /* Espacement des lettres */
								font-weight: bold;
								border: 4px double #5d4037;   /* Bordure plus épaisse */
								border-radius: 2px;
								box-shadow: 8px 8px 0px #bcaaa4;">
						Reset Password
						</a>
					</td>
				</tr>
			</table>
		</div>
	"""
	message = MessageSchema(
		subject="Reset Password Mail",
		recipients=[data.email],
		body=contenthtml,
		subtype=MessageType.html
	)

	fm = FastMail(conf)
	background_tasks.add_task(fm.send_message, message)
	return {"returnValue": True}
