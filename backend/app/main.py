from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import engine, Base
from app.routes import seed_routes, company_routes, scraper_routes, trigger_routes, auth_routes, outreach_routes, chat_routes
from app.workers.monitor_worker import start_scheduler
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables if they don't exist
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the background scheduler
    logger.info("Starting up Sales Intelligence Pipeline backend...")
    # start_scheduler() # Uncomment to run scheduler automatically
    yield
    # Shutdown
    logger.info("Shutting down...")

app = FastAPI(
    title="Sales Intelligence Pipeline API",
    description="Backend for monitoring corporate news and identifying trigger events mapped to Relanto services.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For hackathon MVP
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_routes.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(seed_routes.router, prefix="/api", tags=["Seed Data"])
app.include_router(company_routes.router, prefix="/api/companies", tags=["Companies"])
app.include_router(scraper_routes.router, prefix="/api/scraper", tags=["Scraper"])
app.include_router(trigger_routes.router, prefix="/api/triggers", tags=["Triggers"])
app.include_router(outreach_routes.router, prefix="/api/outreaches", tags=["Outreaches"])
app.include_router(chat_routes.router, prefix="/api/chat", tags=["Chat"])

@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "Sales Intelligence Pipeline API is running."}
