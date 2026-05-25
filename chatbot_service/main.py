import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from chatbot_service.routers import chat

app = FastAPI(
    title="Relanto Conversational Chatbot Microservice",
    description="Microservice providing natural language search and guardrails for Sales Intelligence",
    version="1.0.0"
)

import os

# Get allowed origins from environment variable, fallback to "*" if not set
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
