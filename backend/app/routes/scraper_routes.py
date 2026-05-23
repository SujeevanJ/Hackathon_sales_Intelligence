from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.scraper_service import run_company_scraper
from app.services.trigger_service import process_unprocessed_articles

router = APIRouter()

@router.post("/run", summary="Manually trigger the scraper for all active companies")
def run_scraper(db: Session = Depends(get_db)):
    # 1. Scrape new articles
    scrape_result = run_company_scraper(db)
    # 2. Process articles for triggers
    process_result = process_unprocessed_articles(db)
    
    return {
        "scraper": scrape_result,
        "processor": process_result
    }
