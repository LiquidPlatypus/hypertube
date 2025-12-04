from fastapi import APIRouter
from .database import storage
from fastapi import HTTPException, Depends
from .utils import verif_access_token
from .model import CommentForm
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
    return comment

@router.post("/api/comments")
async def post_comment(data: CommentForm, current_user=Depends(verif_access_token)):
    storage.add_comment(data.content, current_user["username"])
    return {"returnValue": True}
    
