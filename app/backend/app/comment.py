from database import Storage, get_storage, get_comments_for_movie
from fastapi import HTTPException, Depends, APIRouter, Query
from fastapi.responses import JSONResponse
from models_db import get_db
from sqlalchemy.orm import Session
from utils import verif_access_token
import datetime
from model import CommentForm, ChunkCommentForm
from typing import Optional
import string, random

router = APIRouter()

@router.get("/api/comments/{id}")
async def get_comment_byid(id: int, storage: Storage = Depends(get_storage)):
	comment = storage.get_comment(id)
	if not id or comment == None:
		raise HTTPException(
			status_code=404,
			detail="Comment not found"
		)
	return {"comment": comment}

@router.post("/api/comments")
async def post_comment(data: CommentForm, current_user=Depends(verif_access_token), storage: Storage = Depends(get_storage)):
	if data.movie_id == None:
		raise HTTPException(
			status_code=400,
			detail="Movie id is missing"
		)
	comment = storage.add_comment(data.content, current_user["id"], data.movie_id)
	return {"comment": comment}
	
@router.patch("/api/comments/{id}")
async def modif_comment_byid(id: int, new_content: str, current_user=Depends(verif_access_token), storage: Storage = Depends(get_storage)):
	comment = storage.custom_comment(id, new_content)
	if not id or comment == None:
		raise HTTPException(
			status_code=404,
			detail="Comment not found"
		)
	return {"comment": comment}

@router.get("/api/comments")
async def get_comment(storage: Storage = Depends(get_storage)):
	list_comments = storage.get_last_comments()
	return {"list_comments": list_comments}

@router.get("/api/comment", response_class=JSONResponse)
async def get_comments(pos: int = Query(0, ge=0), movie_id: int = Query(None), storage: Storage = Depends(get_storage), current_user=Depends(verif_access_token)):
	if movie_id == None:
		raise HTTPException(
			status_code=400,
			detail="Movie id is missing"
		)
	comments = storage.get_comments(pos, movie_id)
	return {"comments": comments}

@router.delete("/api/comments/{id}")
async def delete_comments(id: int, storage: Storage = Depends(get_storage), current_user=Depends(verif_access_token)):
	result = storage.delete_comments(id, current_user["id"])
	if result == "forbidden":
		raise HTTPException(status_code=403, detail="Not your comment")
	if result is None:
		raise HTTPException(status_code=404, detail="Comment not found")
	return {"ReturnValue": True}
