from fastapi import APIRouter
from .database import storage

router = APIRouter()

@router.get("/")
