from apscheduler.schedulers.background import BackgroundScheduler
import logging
from app.database import SessionLocal
from app.services.scraper_service import run_company_scraper
from app.services.trigger_service import process_unprocessed_articles

logger = logging.getLogger(__name__)

def monitor_job():
    logger.info("Starting scheduled monitor job...")
    db = SessionLocal()
    try:
        run_company_scraper(db)
        process_unprocessed_articles(db)
        logger.info("Monitor job completed.")
    except Exception as e:
        logger.error(f"Error in monitor job: {e}")
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Run every 30 minutes
    scheduler.add_job(monitor_job, 'interval', minutes=30)
    scheduler.start()
    logger.info("Background scheduler started. Monitoring every 30 minutes.")
