import sys
import os
# Allow importing chatbot_service when running from within the chatbot_service directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from chatbot_service.routers import chat

app = FastAPI(
    title="Relanto Conversational Chatbot Microservice",
    description="Microservice providing natural language search and guardrails for Sales Intelligence",
    version="1.0.0"
)

# Configure CORS so React frontend at localhost:5173 can talk directly to it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In prod, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount chatbot routers
app.include_router(chat.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Relanto Chatbot Microservice",
        "port": 8002
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
