from sqlalchemy.orm import Session
from app.models import ScrapedArticle

def is_duplicate_article(db: Session, url: str) -> bool:
    return db.query(ScrapedArticle).filter(ScrapedArticle.url == url).first() is not None
