"""
Unit tests for scraper_service:
- fetch_rss_feed()
- fetch_careers_page()
- run_company_scraper()

All network calls are mocked.
"""
import pytest
from unittest.mock import patch, MagicMock
from app.services.scraper_service import fetch_rss_feed, fetch_careers_page
from app.models import ScrapedArticle


def _make_mock_feed(entries):
    """Build a minimal feedparser result object."""
    mock_feed = MagicMock()
    mock_feed.entries = entries
    return mock_feed


def _make_entry(title: str, link: str, summary: str = ""):
    entry = MagicMock()
    entry.title = title
    entry.link = link
    entry.summary = summary
    return entry


class TestFetchRssFeed:
    @patch("app.services.scraper_service.feedparser.parse")
    def test_saves_new_articles_from_feed(self, mock_parse, db, sample_company):
        mock_parse.return_value = _make_mock_feed([
            _make_entry("Company raises $50M", "https://news.com/raise", "Funding round announced."),
            _make_entry("New product launch", "https://news.com/launch", "New SaaS product."),
        ])

        fetch_rss_feed(db, sample_company, "https://example.com/rss")

        articles = db.query(ScrapedArticle).all()
        assert len(articles) == 2
        urls = [a.url for a in articles]
        assert "https://news.com/raise" in urls
        assert "https://news.com/launch" in urls

    @patch("app.services.scraper_service.feedparser.parse")
    def test_sets_correct_company_id(self, mock_parse, db, sample_company):
        mock_parse.return_value = _make_mock_feed([
            _make_entry("Some news", "https://news.com/story1", "Content here."),
        ])

        fetch_rss_feed(db, sample_company, "https://example.com/rss")

        article = db.query(ScrapedArticle).first()
        assert article.company_id == sample_company.id

    @patch("app.services.scraper_service.feedparser.parse")
    def test_skips_duplicate_urls(self, mock_parse, db, sample_company, sample_article):
        # sample_article URL already exists in DB
        mock_parse.return_value = _make_mock_feed([
            _make_entry("Duplicate", sample_article.url, "Same URL as existing article."),
        ])

        fetch_rss_feed(db, sample_company, "https://example.com/rss")

        # Only sample_article should exist (no new ones)
        assert db.query(ScrapedArticle).count() == 1

    @patch("app.services.scraper_service.feedparser.parse")
    def test_does_nothing_when_empty_url(self, mock_parse, db, sample_company):
        fetch_rss_feed(db, sample_company, None)
        fetch_rss_feed(db, sample_company, "")
        mock_parse.assert_not_called()
        assert db.query(ScrapedArticle).count() == 0

    @patch("app.services.scraper_service.feedparser.parse")
    def test_handles_feed_with_no_entries(self, mock_parse, db, sample_company):
        mock_parse.return_value = _make_mock_feed([])
        fetch_rss_feed(db, sample_company, "https://example.com/rss")
        assert db.query(ScrapedArticle).count() == 0

    @patch("app.services.scraper_service.feedparser.parse")
    def test_respects_top_5_limit(self, mock_parse, db, sample_company):
        entries = [_make_entry(f"News {i}", f"https://news.com/{i}") for i in range(10)]
        mock_parse.return_value = _make_mock_feed(entries)

        fetch_rss_feed(db, sample_company, "https://example.com/rss")

        assert db.query(ScrapedArticle).count() == 5

    @patch("app.services.scraper_service.feedparser.parse")
    def test_stores_correct_source_type(self, mock_parse, db, sample_company):
        mock_parse.return_value = _make_mock_feed([
            _make_entry("News", "https://news.com/article", "Content."),
        ])

        fetch_rss_feed(db, sample_company, "https://example.com/rss", source_type="TechCrunch RSS")

        article = db.query(ScrapedArticle).first()
        assert article.source_type == "TechCrunch RSS"

    @patch("app.services.scraper_service.feedparser.parse")
    def test_handles_feedparser_exception_gracefully(self, mock_parse, db, sample_company):
        mock_parse.side_effect = Exception("Network error")
        # Should not raise
        fetch_rss_feed(db, sample_company, "https://example.com/rss")
        assert db.query(ScrapedArticle).count() == 0


class TestFetchCareersPage:
    @patch("app.services.scraper_service.requests.get")
    def test_saves_careers_article_on_200(self, mock_get, db, sample_company):
        # Content must exceed 100 chars after HTML cleaning (scraper minimum)
        long_text = "We are actively hiring cloud engineers, AI developers, and DevOps specialists to join our fast-growing platform engineering team and help modernize our infrastructure."
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = f"<html><body><h1>Join Our Team</h1><p>{long_text}</p></body></html>"
        mock_get.return_value = mock_resp

        fetch_careers_page(db, sample_company, "https://acme.com/careers")

        article = db.query(ScrapedArticle).first()
        assert article is not None
        assert article.source_type == "Careers Page"
        assert article.company_id == sample_company.id

    @patch("app.services.scraper_service.requests.get")
    def test_skips_on_non_200_response(self, mock_get, db, sample_company):
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        mock_get.return_value = mock_resp

        fetch_careers_page(db, sample_company, "https://acme.com/careers")
        assert db.query(ScrapedArticle).count() == 0

    @patch("app.services.scraper_service.requests.get")
    def test_skips_duplicate_careers_url(self, mock_get, db, sample_company):
        # First call saves the article
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body><p>" + "We are hiring engineers. " * 20 + "</p></body></html>"
        mock_get.return_value = mock_resp

        fetch_careers_page(db, sample_company, "https://acme.com/careers")
        assert db.query(ScrapedArticle).count() == 1

        # Second call with same URL should skip
        fetch_careers_page(db, sample_company, "https://acme.com/careers")
        assert db.query(ScrapedArticle).count() == 1

    def test_does_nothing_when_no_url(self, db, sample_company):
        sample_company.careers_url = None
        fetch_careers_page(db, sample_company, None)
        assert db.query(ScrapedArticle).count() == 0

    @patch("app.services.scraper_service.requests.get")
    def test_skips_content_shorter_than_100_chars(self, mock_get, db, sample_company):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body>Short</body></html>"
        mock_get.return_value = mock_resp

        fetch_careers_page(db, sample_company, "https://acme.com/careers")
        assert db.query(ScrapedArticle).count() == 0

    @patch("app.services.scraper_service.requests.get")
    def test_truncates_content_to_5000_chars(self, mock_get, db, sample_company):
        long_content = "A" * 10000
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = f"<html><body><p>{long_content}</p></body></html>"
        mock_get.return_value = mock_resp

        fetch_careers_page(db, sample_company, "https://acme.com/careers")
        article = db.query(ScrapedArticle).first()
        assert article is not None
        assert len(article.content) <= 5000

    @patch("app.services.scraper_service.requests.get")
    def test_handles_request_exception_gracefully(self, mock_get, db, sample_company):
        mock_get.side_effect = Exception("Connection timeout")
        # Should not raise
        fetch_careers_page(db, sample_company, "https://acme.com/careers")
        assert db.query(ScrapedArticle).count() == 0
