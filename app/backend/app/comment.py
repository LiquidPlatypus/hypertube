from fastapi import APIRouter
from .database import storage
from fastapi import HTTPException, Depends
from .utils import verif_access_token
from .model import CommentForm, CustomCommentForm
import datetime

router = APIRouter()

class ChunkComment:
	def __init__(self):
		self.current_comments = storage.get_comments()
		self.chunk = 0

	def _get_chunk(self, it):
		end = it + 10
		chunks = []
		while (self.current_comments[it] != None and it < end):
			chunks.append(self.current_comments[it])
			it += 1

		return chunks

	def get_next_chunk(self):
		chunks = self._get_chunk(self.chunk)
		self.chunk += 10
		return chunks


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

@router.get("/api/comments")
async def get_comments(current_user=Depends(verif_access_token)):
	comments = storage.get_comments()
	return {"comments": comments}