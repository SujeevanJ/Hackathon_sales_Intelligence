from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, Response
from datetime import datetime
from pydantic import BaseModel
from typing import List

app = FastAPI(title="Mock Target Company Website")

# In-memory database of mock news
class NewsItem(BaseModel):
    title: str
    content: str
    published_at: str = datetime.now().isoformat()
    source_type: str = "news" # "news" or "careers"

mock_articles: List[NewsItem] = [
    NewsItem(title="Welcome to Demo Corp", content="We are a placeholder company for testing the Relanto Intelligence Pipeline.", source_type="news")
]

@app.post("/publish")
def publish_news(item: NewsItem):
    """
    Webhook to inject fake news/triggers during a live demo.
    """
    # Prepend to make it the most recent
    mock_articles.insert(0, item)
    return {"message": "News published successfully", "article": item}

@app.get("/rss")
def get_rss_feed(request: Request):
    """
    Simulates a Google News RSS feed for Demo Corp.
    """
    base_url = str(request.base_url).rstrip("/")
    rss_items = ""
    for article in [a for a in mock_articles if a.source_type == "news"]:
        rss_items += f"""
        <item>
            <title>{article.title}</title>
            <link>{base_url}/news/{hash(article.title)}</link>
            <description>{article.content}</description>
            <pubDate>{article.published_at}</pubDate>
        </item>
        """
        
    rss_xml = f"""<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
        <channel>
            <title>Demo Corp - Google News Search</title>
            <link>{base_url}</link>
            <description>Latest news about Demo Corp</description>
            {rss_items}
        </channel>
    </rss>
    """
    return Response(content=rss_xml, media_type="application/xml")

@app.get("/careers", response_class=HTMLResponse)
def get_careers_page():
    """
    Simulates the Careers page HTML for Demo Corp.
    """
    career_items = ""
    for job in [a for a in mock_articles if a.source_type == "careers"]:
        career_items += f"""
        <div class="job-listing">
            <h2>{job.title}</h2>
            <p>{job.content}</p>
            <small>Posted: {job.published_at}</small>
        </div>
        """
        
    if not career_items:
        career_items = "<p>No open positions at this time. Check back later!</p>"
        
    html = f"""
    <html>
        <head><title>Careers | Demo Corp</title></head>
        <body>
            <h1>Welcome to Demo Corp Careers</h1>
            <p>Join our fast growing team!</p>
            <hr>
            {career_items}
        </body>
    </html>
    """
    return HTMLResponse(content=html)

@app.get("/")
def read_root():
    return {"message": "Demo Corp Mock Website Running on Port 8001"}
