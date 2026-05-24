import os
from dotenv import load_dotenv

# Load from main backend .env if possible, otherwise local
# Let's search in parent directories for .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../backend/sales_intel.db")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")

# The main FastAPI backend endpoint
INTERNAL_API_URL = os.getenv("INTERNAL_API_URL", "http://localhost:8000")

# Redis configuration (if any, otherwise we fall back to in-memory)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
USE_REDIS = os.getenv("USE_REDIS", "false").lower() == "true"
