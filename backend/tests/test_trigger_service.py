"""
Unit tests for trigger_service:
- has_strategic_keywords()
- analyze_article()
- process_unprocessed_articles()
"""
import json
import pytest
from unittest.mock import patch, MagicMock
from app.services.trigger_service import has_strategic_keywords, analyze_article, process_unprocessed_articles
from app.models import ScrapedArticle, TriggerEvent, RelantoService, User


# ── has_strategic_keywords ────────────────────────────────────────────────────

class TestHasStrategicKeywords:
    def test_detects_funding_keyword(self):
        assert has_strategic_keywords("Company raises Series B funding") is True

    def test_detects_acquisition_keyword(self):
        assert has_strategic_keywords("Tech giant acquires startup") is True

    def test_detects_leadership_change_ceo(self):
        assert has_strategic_keywords("Board appoints new CEO") is True

    def test_detects_leadership_change_cto(self):
        assert has_strategic_keywords("New CTO joins engineering team") is True

    def test_detects_layoff_keyword(self):
        assert has_strategic_keywords("Company announces layoffs of 500 staff") is True

    def test_detects_cloud_keyword(self):
        assert has_strategic_keywords("Migrating all workloads to cloud infrastructure") is True

    def test_detects_ai_keyword(self):
        assert has_strategic_keywords("Investing heavily in AI capabilities") is True

    def test_detects_expansion_keyword(self):
        assert has_strategic_keywords("Company to expand operations in APAC") is True

    def test_detects_merger_keyword(self):
        assert has_strategic_keywords("Two companies announce merger agreement") is True

    def test_detects_partner_keyword(self):
        assert has_strategic_keywords("Strategic partner announced today") is True

    def test_returns_false_for_irrelevant_text(self):
        assert has_strategic_keywords("The weather today is sunny and warm") is False

    def test_returns_false_for_empty_string(self):
        assert has_strategic_keywords("") is False

    def test_returns_false_for_none(self):
        assert has_strategic_keywords(None) is False

    def test_case_insensitive_uppercase(self):
        assert has_strategic_keywords("RAISES FUND FOR CLOUD") is True

    def test_case_insensitive_mixed(self):
        assert has_strategic_keywords("Company Acquires Major Competitor") is True

    def test_partial_keyword_match(self):
        # "acquir" matches "acquired" (a-c-q-u-i-r-e-d) ✓
        # NOTE: "acquisition" = a-c-q-u-i-s-i-t-i-o-n — "acquis", NOT "acquir" — no match
        assert has_strategic_keywords("the company was acquired") is True
        assert has_strategic_keywords("acquires rival firm") is True

    def test_moderniz_partial_match(self):
        assert has_strategic_keywords("modernization of legacy systems") is True
        assert has_strategic_keywords("modernizing the tech stack") is True


# ── analyze_article ───────────────────────────────────────────────────────────

class TestAnalyzeArticle:
    def _make_article(self, db, company):
        article = ScrapedArticle(
            company_id=company.id,
            title="Acme raises $100M Series C",
            url="https://news.com/acme-series-c",
            content="Acme Corp announced $100M to fund cloud infrastructure buildout.",
            source_type="Google News RSS",
            is_processed=False,
        )
        db.add(article)
        db.commit()
        db.refresh(article)
        return article

    @patch("app.services.trigger_service.call_llm")
    def test_creates_trigger_on_high_confidence(
        self, mock_llm, db, sample_company, sales_rep_user, relanto_services
    ):
        mock_llm.return_value = json.dumps({
            "has_trigger": True,
            "event_type": "Funding",
            "summary": "Acme raised $100M Series C.",
            "business_impact": "Will need cloud scaling support.",
            "recommended_service": "Cloud Modernization",
            "confidence_score": 0.91,
        })

        article = self._make_article(db, sample_company)
        result = analyze_article(db, article)

        assert result is not None
        assert result.event_type == "Funding"
        assert result.confidence_score == pytest.approx(0.91)
        assert result.company_id == sample_company.id

    @patch("app.services.trigger_service.call_llm")
    def test_rejects_low_confidence_trigger(
        self, mock_llm, db, sample_company, sales_rep_user, relanto_services
    ):
        mock_llm.return_value = json.dumps({
            "has_trigger": True,
            "event_type": "Funding",
            "summary": "Vague funding rumour.",
            "business_impact": "Unclear.",
            "recommended_service": "Cloud Modernization",
            "confidence_score": 0.45,  # Below 0.6 threshold
        })

        article = self._make_article(db, sample_company)
        result = analyze_article(db, article)

        assert result is None
        count = db.query(TriggerEvent).count()
        assert count == 0

    @patch("app.services.trigger_service.call_llm")
    def test_no_trigger_flag_returns_none(
        self, mock_llm, db, sample_company, sales_rep_user, relanto_services
    ):
        mock_llm.return_value = json.dumps({"has_trigger": False})

        article = self._make_article(db, sample_company)
        result = analyze_article(db, article)

        assert result is None
        assert db.query(TriggerEvent).count() == 0

    @patch("app.services.trigger_service.call_llm")
    def test_does_not_create_duplicate_trigger(
        self, mock_llm, db, sample_company, sample_article, sample_trigger, relanto_services
    ):
        # sample_trigger already exists for sample_article
        mock_llm.return_value = json.dumps({
            "has_trigger": True,
            "event_type": "Funding",
            "summary": "Duplicate funding news.",
            "business_impact": "Impact.",
            "recommended_service": "Cloud Modernization",
            "confidence_score": 0.95,
        })

        result = analyze_article(db, sample_article)
        assert result is None
        # Count should still be 1 (only sample_trigger)
        assert db.query(TriggerEvent).count() == 1

    @patch("app.services.trigger_service.call_llm")
    def test_assigns_to_sales_rep_when_available(
        self, mock_llm, db, sample_company, sales_rep_user, relanto_services
    ):
        mock_llm.return_value = json.dumps({
            "has_trigger": True,
            "event_type": "AI Adoption",
            "summary": "Acme adopts AI.",
            "business_impact": "Needs AI automation.",
            "recommended_service": "AI Automation",
            "confidence_score": 0.88,
        })

        article = ScrapedArticle(
            company_id=sample_company.id,
            title="Acme AI news",
            url="https://news.com/acme-ai",
            content="Acme goes all-in on AI.",
            source_type="Google News RSS",
            is_processed=False,
        )
        db.add(article)
        db.commit()

        result = analyze_article(db, article)
        assert result is not None
        assert result.assigned_to_id == sales_rep_user.id

    @patch("app.services.trigger_service.call_llm")
    def test_invalid_json_from_llm_returns_none(self, mock_llm, db, sample_company, relanto_services):
        mock_llm.return_value = "not valid json {{{"

        article = ScrapedArticle(
            company_id=sample_company.id,
            title="Bad LLM response",
            url="https://news.com/bad-llm",
            content="Content.",
            source_type="Google News RSS",
        )
        db.add(article)
        db.commit()

        result = analyze_article(db, article)
        assert result is None


# ── process_unprocessed_articles ──────────────────────────────────────────────

class TestProcessUnprocessedArticles:
    @patch("app.services.trigger_service.analyze_article")
    def test_skips_articles_with_no_strategic_keywords(
        self, mock_analyze, db, sample_company
    ):
        article = ScrapedArticle(
            company_id=sample_company.id,
            title="The weather is lovely today",
            url="https://news.com/weather",
            content="Sunny skies expected all week.",
            source_type="Google News RSS",
            is_processed=False,
        )
        db.add(article)
        db.commit()

        process_unprocessed_articles(db)

        # LLM should not have been called
        mock_analyze.assert_not_called()
        # Article should be marked processed
        db.refresh(article)
        assert article.is_processed is True

    @patch("app.services.trigger_service.analyze_article", return_value=None)
    def test_calls_llm_for_articles_with_keywords(
        self, mock_analyze, db, sample_company
    ):
        article = ScrapedArticle(
            company_id=sample_company.id,
            title="Company raises $50M Series B funding",
            url="https://news.com/funding-news",
            content="The company announced a new funding round.",
            source_type="Google News RSS",
            is_processed=False,
        )
        db.add(article)
        db.commit()

        process_unprocessed_articles(db)

        mock_analyze.assert_called_once()

    @patch("app.services.trigger_service.analyze_article", return_value=None)
    def test_marks_all_articles_as_processed(
        self, mock_analyze, db, sample_company
    ):
        articles = []
        for i in range(3):
            a = ScrapedArticle(
                company_id=sample_company.id,
                title=f"Company raises funding round {i}",
                url=f"https://news.com/funding-{i}",
                content="Funding news.",
                source_type="Google News RSS",
                is_processed=False,
            )
            db.add(a)
            articles.append(a)
        db.commit()

        process_unprocessed_articles(db)

        for a in articles:
            db.refresh(a)
            assert a.is_processed is True

    @patch("app.services.trigger_service.analyze_article", return_value=None)
    def test_skips_already_processed_articles(
        self, mock_analyze, db, sample_company
    ):
        article = ScrapedArticle(
            company_id=sample_company.id,
            title="Company raises funds",
            url="https://news.com/already-done",
            content="Funding news.",
            source_type="Google News RSS",
            is_processed=True,  # Already processed
        )
        db.add(article)
        db.commit()

        process_unprocessed_articles(db)
        mock_analyze.assert_not_called()

    def test_returns_summary_dict(self, db, sample_company):
        result = process_unprocessed_articles(db)
        assert "message" in result
        assert isinstance(result["message"], str)
