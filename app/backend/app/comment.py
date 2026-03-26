from fastapi import APIRouter, Query
from database import storage
from fastapi import HTTPException, Depends
from fastapi.responses import JSONResponse
from utils import verif_access_token
from model import CommentForm, CustomCommentForm
import datetime

router = APIRouter()

@router.get("/api/comments/{id}")
async def get_comment_byid(id: int, current_user=Depends(verif_access_token)):
    comment = storage.get_comment(id)
    if not id or comment == None:
        raise HTTPException(
            status_code=404,
            detail="Comment not found"
        )
    print(comment)
    return {"comment": comment}

@router.post("/api/comments")
async def post_comment(data: CommentForm, current_user=Depends(verif_access_token)):
    comment = storage.add_comment(data.content, current_user["username"])
    print(comment)
    return {"comment": comment}

@router.patch("/api/comments/{id}")
async def modif_comment_byid(data: CustomCommentForm, current_user=Depends(verif_access_token)):
    comment = storage.custom_comment(id, data.new_content)
    if not id or comment == None:
        raise HTTPException(
            status_code=404,
            detail="Comment not found"
        )
    print(comment)
    return {"comment": comment}

@router.get("/api/comments", response_class=JSONResponse)
async def get_comments(pos: int = Query(0, ge=0), current_user=Depends(verif_access_token)):
    comments = storage.get_comments(pos)
    return {"comments": comments}
