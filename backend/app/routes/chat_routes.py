from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.services.chat_service import chat

router = APIRouter()


class Message(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]


class ChatResponse(BaseModel):
    response: str


@router.post("/", response_model=ChatResponse)
def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    response = chat(db, current_user, messages)
    return ChatResponse(response=response)
