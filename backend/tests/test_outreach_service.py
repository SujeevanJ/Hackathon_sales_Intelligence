"""
Unit tests for outreach_service:
- enrich_contact()
- discover_contact()
- process_outreach_pipeline()
- send_cold_email()
"""
import json
import pytest
from unittest.mock import patch, MagicMock
from app.services.outreach_service import (
    enrich_contact,
    discover_contact,
    process_outreach_pipeline,
    send_cold_email,
)
from app.models import OutreachBrief


# ── enrich_contact ────────────────────────────────────────────────────────────

class TestEnrichContact:
    def test_returns_none_when_no_domain(self):
        contact = {"name": "Jane Smith", "role": "CTO"}
        result = enrich_contact(contact, None, "Acme Corp")
        assert result is None

    def test_returns_generic_email_for_placeholder_name(self):
        contact = {"name": "John Doe (Placeholder)", "role": "CTO"}
        result = enrich_contact(contact, "https://acme.com", "Acme Corp")
        assert result == "contact@acme.com"

    def test_heuristic_fallback_formats_email_correctly(self):
        contact = {"name": "Jane Smith", "role": "CTO"}
        result = enrich_contact(contact, "https://acme.com", "Acme Corp")
        assert result == "jane.smith@acme.com"

    def test_strips_www_from_domain(self):
        contact = {"name": "Bob Jones", "role": "VP Engineering"}
        result = enrich_contact(contact, "https://www.acme.com", "Acme Corp")
        assert "@acme.com" in result

    def test_strips_http_prefix(self):
        contact = {"name": "Alice Brown", "role": "CIO"}
        result = enrich_contact(contact, "http://acme.com", "Acme Corp")
        assert "@acme.com" in result

    def test_handles_single_name_part(self):
        contact = {"name": "Madonna", "role": "CEO"}
        result = enrich_contact(contact, "acme.com", "Acme Corp")
        # Should not crash, returns some email
        assert "@acme.com" in result

    def test_empty_name_returns_contact_at_domain(self):
        contact = {"name": "", "role": "CTO"}
        result = enrich_contact(contact, "acme.com", "Acme Corp")
        assert result is not None


# ── discover_contact ──────────────────────────────────────────────────────────

class TestDiscoverContact:
    @patch("app.services.outreach_service.search")
    def test_extracts_linkedin_url(self, mock_search):
        mock_search.return_value = iter(["https://linkedin.com/in/jane-smith-1234"])

        result = discover_contact("Acme Corp", "CTO")

        assert result["linkedin_url"] == "https://linkedin.com/in/jane-smith-1234"
        assert result["role"] == "CTO"

    @patch("app.services.outreach_service.search")
    def test_extracts_name_from_linkedin_slug(self, mock_search):
        mock_search.return_value = iter(["https://linkedin.com/in/jane-smith-456"])

        result = discover_contact("Acme Corp", "CTO")

        # Name extracted from slug: "Jane Smith"
        assert result["name"] is not None
        assert "Jane" in result["name"] or "Smith" in result["name"]

    @patch("app.services.outreach_service.search")
    def test_uses_placeholder_when_no_linkedin_found(self, mock_search):
        mock_search.return_value = iter(["https://google.com/search?q=acme+cto"])

        result = discover_contact("Acme Corp", "CTO")

        assert result["name"] == "John Doe (Placeholder)"

    @patch("app.services.outreach_service.search")
    def test_handles_search_exception_gracefully(self, mock_search):
        mock_search.side_effect = Exception("Rate limited")

        result = discover_contact("Acme Corp", "CTO")

        assert result["role"] == "CTO"
        assert result["name"] == "John Doe (Placeholder)"

    @patch("app.services.outreach_service.search")
    def test_always_includes_phone(self, mock_search):
        mock_search.return_value = iter([])

        result = discover_contact("Acme Corp", "CTO")

        assert "phone" in result
        assert result["phone"].startswith("+1-555")


# ── process_outreach_pipeline ─────────────────────────────────────────────────

class TestProcessOutreachPipeline:
    def test_returns_none_when_trigger_not_found(self, db):
        result = process_outreach_pipeline(db, trigger_id=99999)
        assert result is None

    def test_returns_none_when_company_not_found(self, db, sample_article):
        from app.models import TriggerEvent
        # Trigger with invalid company_id
        trigger = TriggerEvent(
            company_id=99999,
            article_id=sample_article.id,
            event_type="Funding",
            summary="Some summary",
            business_impact="Impact",
            recommended_service="Cloud Modernization",
            confidence_score=0.9,
            status="New",
        )
        db.add(trigger)
        db.commit()

        result = process_outreach_pipeline(db, trigger_id=trigger.id)
        assert result is None

    def test_returns_existing_brief_without_reprocessing(
        self, db, sample_trigger, sample_outreach
    ):
        # sample_outreach already tied to sample_trigger
        with patch("app.services.outreach_service.infer_persona") as mock_persona:
            result = process_outreach_pipeline(db, trigger_id=sample_trigger.id)

        # Should return the existing brief without calling infer_persona
        mock_persona.assert_not_called()
        assert result.id == sample_outreach.id

    @patch("app.services.outreach_service.send_cold_email", return_value=True)
    @patch("app.services.outreach_service.generate_multi_channel_content")
    @patch("app.services.outreach_service.enrich_contact", return_value="jane@acme.com")
    @patch("app.services.outreach_service.discover_contact")
    @patch("app.services.outreach_service.infer_persona", return_value="CTO")
    def test_creates_outreach_brief_end_to_end(
        self, mock_persona, mock_discover, mock_enrich, mock_content, mock_email,
        db, sample_trigger, sample_company, relanto_services
    ):
        mock_discover.return_value = {
            "name": "Jane Smith",
            "role": "CTO",
            "linkedin_url": "https://linkedin.com/in/jane",
            "phone": "+1-555-019-42",
        }
        mock_content.return_value = {
            "email_subject": "Congrats on the Series B",
            "email_body": "Hi Jane, saw the news...",
            "linkedin_draft": "Hi Jane, let's connect!",
            "whatsapp_draft": "Hi Jane, sent you an email.",
        }

        result = process_outreach_pipeline(db, trigger_id=sample_trigger.id)

        assert result is not None
        assert result.contact_name == "Jane Smith"
        assert result.contact_role == "CTO"
        assert result.subject == "Congrats on the Series B"
        assert result.persona == "CTO"
        assert result.trigger_id == sample_trigger.id
        assert result.company_id == sample_company.id

    @patch("app.services.outreach_service.send_cold_email", return_value=True)
    @patch("app.services.outreach_service.generate_multi_channel_content")
    @patch("app.services.outreach_service.enrich_contact", return_value="jane@acme.com")
    @patch("app.services.outreach_service.discover_contact")
    @patch("app.services.outreach_service.infer_persona", return_value="CTO")
    def test_updates_trigger_status_after_outreach(
        self, mock_persona, mock_discover, mock_enrich, mock_content, mock_email,
        db, sample_trigger, sample_company, relanto_services
    ):
        mock_discover.return_value = {
            "name": "Jane Smith", "role": "CTO",
            "linkedin_url": None, "phone": "+1-555-019",
        }
        mock_content.return_value = {
            "email_subject": "Subject", "email_body": "Body",
            "linkedin_draft": "LinkedIn", "whatsapp_draft": "WA",
        }

        process_outreach_pipeline(db, trigger_id=sample_trigger.id)

        db.refresh(sample_trigger)
        assert sample_trigger.status in ("Outreach Drafted", "Outreach Sent")


# ── send_cold_email ───────────────────────────────────────────────────────────

class TestSendColdEmail:
    def test_returns_true_in_mock_mode_no_smtp(self):
        # Default settings have no SMTP credentials
        result = send_cold_email("test@example.com", "Test Subject", "Test body content")
        assert result is True

    def test_does_not_raise_with_empty_body(self):
        result = send_cold_email("test@example.com", "Subject", "")
        assert result is True
