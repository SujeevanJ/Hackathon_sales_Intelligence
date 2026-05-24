"""
Unit tests for utility functions:
- duplicate_checker.is_duplicate_article()
- text_cleaner.clean_html_text()
"""
import pytest
from app.utils.duplicate_checker import is_duplicate_article
from app.utils.text_cleaner import clean_html_text
from app.models import ScrapedArticle


# ── is_duplicate_article ──────────────────────────────────────────────────────

class TestIsDuplicateArticle:
    def test_returns_false_for_new_url(self, db, sample_company):
        result = is_duplicate_article(db, "https://brand-new-url.com/article")
        assert result is False

    def test_returns_true_for_existing_url(self, db, sample_article):
        result = is_duplicate_article(db, sample_article.url)
        assert result is True

    def test_returns_false_for_empty_string_url(self, db):
        result = is_duplicate_article(db, "")
        assert result is False

    def test_case_sensitive_url_matching(self, db, sample_company):
        article = ScrapedArticle(
            company_id=sample_company.id,
            title="Test article",
            url="https://news.com/Article",
            content="Content.",
            source_type="Google News RSS",
        )
        db.add(article)
        db.commit()

        # Different casing → not a duplicate
        assert is_duplicate_article(db, "https://news.com/article") is False
        # Exact match → duplicate
        assert is_duplicate_article(db, "https://news.com/Article") is True

    def test_returns_false_on_empty_database(self, db):
        result = is_duplicate_article(db, "https://any-url.com/story")
        assert result is False

    def test_returns_true_only_for_exact_match(self, db, sample_company):
        article = ScrapedArticle(
            company_id=sample_company.id,
            title="Exact match test",
            url="https://news.com/exact",
            content="Content.",
            source_type="Google News RSS",
        )
        db.add(article)
        db.commit()

        assert is_duplicate_article(db, "https://news.com/exact") is True
        assert is_duplicate_article(db, "https://news.com/exact-other") is False
        assert is_duplicate_article(db, "https://news.com/") is False


# ── clean_html_text ───────────────────────────────────────────────────────────

class TestCleanHtmlText:
    def test_strips_basic_html_tags(self):
        html = "<h1>Hello</h1><p>World</p>"
        result = clean_html_text(html)
        assert "<h1>" not in result
        assert "<p>" not in result
        assert "Hello" in result
        assert "World" in result

    def test_removes_script_tags_and_content(self):
        html = "<p>Article</p><script>alert('xss')</script>"
        result = clean_html_text(html)
        assert "alert" not in result
        assert "xss" not in result
        assert "Article" in result

    def test_removes_style_tags_and_content(self):
        html = "<p>Content</p><style>body { color: red; }</style>"
        result = clean_html_text(html)
        assert "color" not in result
        assert "Content" in result

    def test_collapses_multiple_whitespace(self):
        html = "<p>Word1   Word2\n\n\nWord3</p>"
        result = clean_html_text(html)
        assert "  " not in result  # No double spaces
        assert "Word1" in result
        assert "Word2" in result
        assert "Word3" in result

    def test_strips_leading_and_trailing_whitespace(self):
        html = "   <p>Content</p>   "
        result = clean_html_text(html)
        assert result == result.strip()

    def test_returns_empty_string_for_empty_input(self):
        assert clean_html_text("") == ""

    def test_returns_empty_string_for_none(self):
        assert clean_html_text(None) == ""

    def test_handles_plain_text_without_html(self):
        text = "This is plain text without any HTML tags."
        result = clean_html_text(text)
        assert result == text

    def test_handles_nested_tags(self):
        html = "<div><ul><li><strong>Bold item</strong></li></ul></div>"
        result = clean_html_text(html)
        assert "Bold item" in result
        assert "<" not in result

    def test_handles_html_entities(self):
        html = "<p>Company &amp; Partners raised &gt;$50M</p>"
        result = clean_html_text(html)
        assert "Company" in result
        assert "Partners" in result

    def test_preserves_meaningful_text_content(self):
        html = """
        <html>
          <head><title>Page Title</title></head>
          <body>
            <h1>Acme Corp raises $50M Series B</h1>
            <p>The company will use funds for cloud infrastructure expansion.</p>
          </body>
        </html>
        """
        result = clean_html_text(html)
        assert "Acme Corp raises" in result
        assert "cloud infrastructure" in result
