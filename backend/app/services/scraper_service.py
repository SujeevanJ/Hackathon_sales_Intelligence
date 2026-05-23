import feedparser
import requests
import concurrent.futures
from sqlalchemy.orm import Session
from app.models import Company, ScrapedArticle
from app.utils.text_cleaner import clean_html_text
from app.utils.duplicate_checker import is_duplicate_article
from app.database import SessionLocal
import logging
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

def fetch_rss_feed(db: Session, company: Company, rss_url: str, source_type: str = "Google News RSS"):
    if not rss_url:
        return
    
    try:
        feed = feedparser.parse(rss_url)
        for entry in feed.entries[:5]:  # Fetch top 5 recent articles
            url = entry.link
            if is_duplicate_article(db, url):
                continue
                
            title = entry.title
            summary = getattr(entry, 'summary', '')
            
            article = ScrapedArticle(
                company_id=company.id,
                title=title,
                url=url,
                content=clean_html_text(summary),
                source_type=source_type
            )
            db.add(article)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                logger.warning(f"Duplicate article URL avoided during concurrent insert: {url}")
    except Exception as e:
        logger.error(f"Error parsing RSS for {company.name}: {e}")

def fetch_careers_page(db: Session, company: Company, careers_url: str = None):
    url_to_use = careers_url or company.careers_url
    if not url_to_use:
        return
        
    try:
        # Prevent duplicate career page scrapes on the same day if desired, but for hackathon just replace or ignore
        # Here we just treat the URL as unique
        if is_duplicate_article(db, url_to_use):
            return
            
        # Optional: Add headers to pretend to be a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url_to_use, headers=headers, timeout=10)
        
        if response.status_code == 200:
            content = clean_html_text(response.text)
            if len(content) > 100:
                article = ScrapedArticle(
                    company_id=company.id,
                    title=f"{company.name} Careers Page",
                    url=url_to_use,
                    content=content[:5000],  # Limit length for SLM processing
                    source_type="Careers Page"
                )
                db.add(article)
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()
                    logger.warning(f"Duplicate careers URL avoided during concurrent insert: {url_to_use}")
    except Exception as e:
        logger.error(f"Error scraping careers for {company.name}: {e}")

def _scrape_single_company(company_id: int):
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.id == company_id).first()
        if company:
            if company.public_sources:
                for source in company.public_sources:
                    if source.get('source_type') == 'google_news_rss':
                        fetch_rss_feed(db, company, source.get('url'), source.get('source_name', 'Google News RSS'))
                    elif source.get('source_type') == 'careers':
                        fetch_careers_page(db, company, source.get('url'))
            else:
                # Fallback to old behavior
                fetch_rss_feed(db, company, company.news_rss)
                fetch_careers_page(db, company, company.careers_url)
    except Exception as e:
        logger.error(f"Error in concurrent scrape for company {company_id}: {e}")
    finally:
        db.close()

def run_company_scraper(db: Session, company_id: int = None):
    companies_query = db.query(Company).filter(Company.is_active == True)
    if company_id:
        companies_query = companies_query.filter(Company.id == company_id)
        
    companies = companies_query.all()
    company_ids = [c.id for c in companies]
    
    # Use ThreadPoolExecutor to scrape multiple companies concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        executor.map(_scrape_single_company, company_ids)
        
    return {"message": f"Scraping completed for {len(companies)} active companies concurrently."}
