from database import Storage, get_storage, get_comments_for_movie
from fastapi import HTTPException, Depends, APIRouter, Query
from fastapi.responses import JSONResponse
from models_db import get_db
from sqlalchemy.orm import Session
from utils import verif_access_token
import datetime
from model import CommentForm, CustomCommentForm, ChunkCommentForm
from typing import Optional
import string, random

router = APIRouter()

@router.get("/api/comments/{id}")
async def get_comment_byid(id: int, current_user=Depends(verif_access_token), storage: Storage = Depends(get_storage)):
	comment = storage.get_comment(id)
	if not id or comment == None:
		raise HTTPException(
			status_code=404,
			detail="Comment not found"
		)
	return {"comment": comment}

@router.post("/api/comments")
async def post_comment(data: CommentForm, current_user=Depends(verif_access_token), storage: Storage = Depends(get_storage)):
	comment = storage.add_comment(data.content, current_user["id"], data.movie_id)
	return {"comment": comment}

@router.post("/api/movies/{movie_id}/comments")
async def post_movie_comment(movie_id: int, data: CommentForm, current_user=Depends(verif_access_token), storage: Storage = Depends(get_storage)):
	comment = storage.add_comment(data.content, current_user["id"], movie_id)
	return {"comment": comment}

@router.get("/api/movies/{movie_id}/comments", response_class=JSONResponse)
async def get_movie_comments(movie_id: int, pos: int = Query(0, ge=0), current_user=Depends(verif_access_token), db: Session = Depends(get_db)):
	return {"comments": get_comments_for_movie(db, movie_id, pos)}

@router.patch("/api/comments")
async def modif_comment_byid(data: CustomCommentForm, current_user=Depends(verif_access_token), storage: Storage = Depends(get_storage)):
	comment = storage.custom_comment(data.id, data.new_content, current_user["id"])
	if comment == "forbidden":
		raise HTTPException(status_code=403, detail="Not your comment")
	if not data.id or comment is None:
		raise HTTPException(
			status_code=404,
			detail="Comment not found"
		)
	return {"comment": comment}

@router.get("/api/comments", response_class=JSONResponse)
async def get_comments(pos: int = Query(0, ge=0), storage: Storage = Depends(get_storage), current_user=Depends(verif_access_token)):
	comments = storage.get_comments(pos)
	return {"comments": comments}

@router.delete("/api/comments/{id}")
async def delete_comments(id: int, storage: Storage = Depends(get_storage), current_user=Depends(verif_access_token)):
	result = storage.delete_comments(id, current_user["id"])
	if result == "forbidden":
		raise HTTPException(status_code=403, detail="Not your comment")
	if result is None:
		raise HTTPException(status_code=404, detail="Comment not found")
	return {"ReturnValue": True}
