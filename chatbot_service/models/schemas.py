from pydantic import BaseModel
from typing import List, Optional

class ChatMessageRequest(BaseModel):
    session_id: str
    message: str
    user_id: Optional[str] = None

class ChatMessageResponse(BaseModel):
    session_id: str
    response: str
    intent: str
    data_source: Optional[str] = None
    suggested_actions: List[str] = []
    clarification_needed: bool = False

class ChatMessageHistoryItem(BaseModel):
    role: str
    content: str
    timestamp: str

class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessageHistoryItem]

class SessionClearResponse(BaseModel):
    cleared: bool
