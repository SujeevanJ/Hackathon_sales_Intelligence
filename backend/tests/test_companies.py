"""
Tests for company routes:
  GET  /api/companies/
  GET  /api/companies/{id}
  GET  /api/companies/{id}/triggers
"""
import pytest
from app.models import Company
from tests.conftest import auth_headers


class TestListCompanies:
    def test_returns_empty_list_when_no_companies(self, client):
        res = client.get("/api/companies/")
        assert res.status_code == 200
        assert res.json() == []

    def test_returns_all_companies(self, client, sample_company, sample_company2):
        res = client.get("/api/companies/")
        assert res.status_code == 200
        names = [c["name"] for c in res.json()]
        assert "Acme Corp" in names
        assert "Beta Ltd" in names

    def test_returns_correct_company_fields(self, client, sample_company):
        res = client.get("/api/companies/")
        assert res.status_code == 200
        company = res.json()[0]
        assert "id" in company
        assert "name" in company
        assert "industry" in company
        assert "website" in company
        assert "hq_location" in company
        assert "priority" in company
        assert "slm_score" in company

    def test_pagination_skip(self, client, sample_company, sample_company2):
        res = client.get("/api/companies/?skip=1&limit=10")
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_pagination_limit(self, client, sample_company, sample_company2):
        res = client.get("/api/companies/?skip=0&limit=1")
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_no_auth_required(self, client, sample_company):
        # Company list is publicly accessible (no auth in route)
        res = client.get("/api/companies/")
        assert res.status_code == 200


class TestGetCompanyById:
    def test_get_existing_company(self, client, sample_company):
        res = client.get(f"/api/companies/{sample_company.id}")
        assert res.status_code == 200
        body = res.json()
        assert body["id"] == sample_company.id
        assert body["name"] == "Acme Corp"
        assert body["industry"] == "Technology"
        assert body["website"] == "https://acme.com"

    def test_get_nonexistent_company_returns_404(self, client):
        res = client.get("/api/companies/99999")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_get_company_id_zero_returns_404(self, client):
        res = client.get("/api/companies/0")
        assert res.status_code == 404

    def test_get_company_with_string_id_returns_422(self, client):
        res = client.get("/api/companies/abc")
        assert res.status_code == 422


class TestGetCompanyTriggers:
    def test_returns_empty_list_when_no_triggers(self, client, sample_company):
        res = client.get(f"/api/companies/{sample_company.id}/triggers")
        assert res.status_code == 200
        assert res.json() == []

    def test_returns_triggers_for_company(self, client, sample_company, sample_trigger):
        res = client.get(f"/api/companies/{sample_company.id}/triggers")
        assert res.status_code == 200
        triggers = res.json()
        assert len(triggers) == 1
        assert triggers[0]["event_type"] == "Funding"
        assert triggers[0]["company_id"] == sample_company.id

    def test_does_not_return_triggers_from_other_company(
        self, client, sample_company, sample_company2, sample_trigger, db
    ):
        from app.models import ScrapedArticle, TriggerEvent
        # Create a trigger for company2
        article2 = ScrapedArticle(
            company_id=sample_company2.id,
            title="Beta Ltd acquires startup",
            url="https://news.com/beta-acquires",
            content="Beta Ltd acquired a fintech startup.",
            source_type="Google News RSS",
        )
        db.add(article2)
        db.commit()
        db.refresh(article2)
        trigger2 = TriggerEvent(
            company_id=sample_company2.id,
            article_id=article2.id,
            event_type="Acquisition",
            summary="Beta acquired a fintech firm.",
            business_impact="Integration challenges expected.",
            recommended_service="Enterprise Integration",
            confidence_score=0.88,
            status="New",
        )
        db.add(trigger2)
        db.commit()

        res = client.get(f"/api/companies/{sample_company.id}/triggers")
        assert res.status_code == 200
        for t in res.json():
            assert t["company_id"] == sample_company.id

    def test_company_not_found_returns_404(self, client):
        res = client.get("/api/companies/99999/triggers")
        assert res.status_code == 404

    def test_triggers_ordered_newest_first(self, client, sample_company, sample_article, db):
        from app.models import TriggerEvent
        from datetime import datetime, timedelta
        # SQLite server_default=func.now() resolves at the same second for rapid inserts,
        # so we set explicit created_at values that are clearly different.
        t1 = TriggerEvent(
            company_id=sample_company.id, article_id=sample_article.id,
            event_type="Funding", summary="Old trigger", business_impact="Impact",
            recommended_service="Cloud Modernization", confidence_score=0.7, status="New",
            created_at=datetime(2025, 1, 1, 10, 0, 0),
        )
        db.add(t1)
        db.commit()
        t2 = TriggerEvent(
            company_id=sample_company.id, article_id=sample_article.id,
            event_type="AI Adoption", summary="New trigger", business_impact="Impact",
            recommended_service="AI Automation", confidence_score=0.8, status="New",
            created_at=datetime(2025, 1, 2, 10, 0, 0),
        )
        db.add(t2)
        db.commit()

        res = client.get(f"/api/companies/{sample_company.id}/triggers")
        assert res.status_code == 200
        events = res.json()
        # Most recently created should be first
        assert events[0]["event_type"] == "AI Adoption"
