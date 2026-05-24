import json
import asyncio
from fastapi import APIRouter, Header, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Optional
from chatbot_service.models.schemas import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatHistoryResponse,
    SessionClearResponse,
    ChatMessageHistoryItem
)
from chatbot_service.services.guardrails import llm_guardrail, fast_guardrail
from chatbot_service.services.session_manager import SessionManager
from chatbot_service.services.intent_classifier import classify_intent
from chatbot_service.services.query_builder import build_and_execute_query
from chatbot_service.services.response_formatter import format_response_stream

router = APIRouter(prefix="/api/chat", tags=["chat"])
session_manager = SessionManager()

@router.post("/message")
async def chat_message(
    req: ChatMessageRequest,
    authorization: Optional[str] = Header(None)
):
    """
    POST /api/chat/message
    Handles a user's natural language message.
    Returns a streamed SSE response (text/event-stream) which yields text tokens,
    followed by metadata like intent, sources, and suggested actions.
    """
    session_id = req.session_id
    message = req.message
    user_id = req.user_id

    # 1. Run Guardrails (First keyword, then LLM intent safety check)
    guard_res = llm_guardrail(message, session_id, user_id)
    if not guard_res.safe:
        # If guardrail fails, we stream the denial explanation
        async def denied_stream():
            denial_msg = guard_res.reason or "Access Denied. Your query violates platform safety policy."
            yield f"data: {json.dumps({'token': denial_msg})}\n\n"
            yield f"data: {json.dumps({'intent': guard_res.intent, 'clarification_needed': False, 'suggested_actions': []})}\n\n"
            yield "event: end\ndata: end\n\n"
        
        # Save to session history so user sees their failure too
        session_manager.append(session_id, "user", message)
        session_manager.append(session_id, "assistant", guard_res.reason or "Access Denied.")
        return StreamingResponse(denied_stream(), media_type="text/event-stream")

    # 2. Get history context window for LLM calls (limit to last 6 turns)
    history = session_manager.get_context_window(session_id)

    # 3. Classify intent (LLM call to extract intent, entities)
    classified = classify_intent(message, history)

    # 4. Handle Clarification
    if classified.needs_clarification:
        clarification_msg = classified.clarification_question or "Could you please clarify your question?"
        async def clarification_stream():
            yield f"data: {json.dumps({'token': clarification_msg})}\n\n"
            yield f"data: {json.dumps({'intent': 'unknown', 'clarification_needed': True, 'suggested_actions': []})}\n\n"
            yield "event: end\ndata: end\n\n"
            
        session_manager.append(session_id, "user", message)
        session_manager.append(session_id, "assistant", clarification_msg)
        return StreamingResponse(clarification_stream(), media_type="text/event-stream")

    # 5. Build and execute query against backend REST endpoints
    # Passing the auth authorization token from frontend so main backend RBAC remains intact!
    query_res = await build_and_execute_query(
        intent_type=classified.intent_type,
        entities=classified.entities,
        filters=classified.filters,
        token=authorization
    )

    data_source = query_res.get("data_source", "Database query")
    api_error = query_res.get("error")

    # If the query builder returned a specific user-friendly error (e.g. company not found)
    if api_error:
        async def error_stream():
            yield f"data: {json.dumps({'token': api_error})}\n\n"
            yield f"data: {json.dumps({'intent': classified.intent_type, 'data_source': data_source, 'clarification_needed': False, 'suggested_actions': []})}\n\n"
            yield "event: end\ndata: end\n\n"
        session_manager.append(session_id, "user", message)
        session_manager.append(session_id, "assistant", api_error)
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    # 6. Stream formatted response using response_formatter
    async def response_stream():
        full_text = ""
        # Yield the tokens chunk by chunk
        async for token in format_response_stream(message, history, query_res):
            full_text += token
            yield f"data: {json.dumps({'token': token})}\n\n"

        # Determine smart suggested action chips based on intent
        suggested_actions = ["Show this week's triggers", "Who to contact at Infosys?"]
        if "get_triggers" in classified.intent_type:
            suggested_actions = ["Who should I contact?", "Best outreach time?", "Create outreach brief"]
        elif "get_contacts" in classified.intent_type:
            suggested_actions = ["Best outreach time?", "Show recent triggers"]
        elif "get_company" in classified.intent_type:
            suggested_actions = ["Show contacts", "Show recent triggers", "Best outreach time"]

        # Yield metadata at the end of the stream
        metadata = {
            "intent": classified.intent_type,
            "data_source": data_source,
            "clarification_needed": False,
            "suggested_actions": suggested_actions
        }
        yield f"data: {json.dumps(metadata)}\n\n"
        yield "event: end\ndata: end\n\n"

        # 7. Persist complete assistant answer to session history
        session_manager.append(session_id, "user", message)
        session_manager.append(session_id, "assistant", full_text)

    return StreamingResponse(response_stream(), media_type="text/event-stream")

@router.get("/history/{session_id}", response_model=ChatHistoryResponse)
def get_chat_history(session_id: str):
    """
    GET /api/chat/history/{session_id}
    Returns full list of user and assistant messages for a session.
    """
    history = session_manager.get_history(session_id)
    messages = [
        ChatMessageHistoryItem(
            role=h["role"],
            content=h["content"],
            timestamp=h.get("timestamp", "")
        ) for h in history
    ]
    return ChatHistoryResponse(messages=messages)

@router.delete("/session/{session_id}", response_model=SessionClearResponse)
def clear_chat_session(session_id: str):
    """
    DELETE /api/chat/session/{session_id}
    Clears session history.
    """
    session_manager.clear(session_id)
    return SessionClearResponse(cleared=True)
