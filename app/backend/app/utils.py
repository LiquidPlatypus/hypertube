from fastapi import HTTPException, Depends
from datetime import datetime, timedelta
from jose import JWTError, jwt
from database import storage
from fastapi.security import OAuth2PasswordBearer
import os

ALGORITHM = "HS256"
SECRET_KEY = os.getenv("SECRET_KEY")  # Ben faut proteger sa niveau sécurité sinon t'es pas gentil
ACCESS_TOKEN_EXPIRE_MINUTES = 30
GOOGLE_CLIENT_ID = "504765868462-ssreveurjgq1i8tuoinem6fcp0g8kv90.apps.googleusercontent.com"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="access_token")

def create_access_token(data: dict, expires_delta: timedelta | None = None):
	to_encode = data.copy()
	if expires_delta:
		expire = datetime.utcnow() + expires_delta
	else:
		expire = datetime.utcnow() + timedelta(minutes=15)
	to_encode.update({"exp": expire})
	encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
	return encoded_jwt

def verif_access_token(token: str = Depends(oauth2_scheme)):
	try:
		payload = jwt.decode(token, SECRET_KEY, algorithms=ALGORITHM)
		user = storage.get_user_by_id(int(payload["sub"]))
		if user == None:
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
