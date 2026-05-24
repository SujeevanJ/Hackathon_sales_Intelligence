"""
Tests for trigger routes:
  GET /api/triggers/

Focus: RBAC filtering — admins see all, sales reps see only their own.
"""
import pytest
from app.models import ScrapedArticle, TriggerEvent
from tests.conftest import auth_headers


def _make_trigger(db, company, article, assigned_to_id=None, event_type="Funding"):
    t = TriggerEvent(
        company_id=company.id,
        article_id=article.id,
        event_type=event_type,
        summary=f"{event_type} event summary",
        business_impact="Significant operational impact.",
        recommended_service="Cloud Modernization",
        confidence_score=0.85,
        assigned_to_id=assigned_to_id,
        status="Assigned" if assigned_to_id else "New",
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


class TestTriggerRBAC:
    def test_requires_authentication(self, client):
        res = client.get("/api/triggers/")
        assert res.status_code == 401

    def test_invalid_token_rejected(self, client):
        res = client.get("/api/triggers/", headers={"Authorization": "Bearer fake"})
        assert res.status_code == 401

    def test_admin_sees_all_triggers(
        self, client, db, admin_user, admin_token, sales_rep_user, sales_rep_user2,
        sample_company, sample_article
    ):
        t1 = _make_trigger(db, sample_company, sample_article, assigned_to_id=sales_rep_user.id)
        t2 = _make_trigger(db, sample_company, sample_article, assigned_to_id=sales_rep_user2.id, event_type="AI Adoption")
        t3 = _make_trigger(db, sample_company, sample_article, assigned_to_id=None, event_type="Expansion")

        res = client.get("/api/triggers/", headers=auth_headers(admin_token))
        assert res.status_code == 200
        ids = [t["id"] for t in res.json()]
        assert t1.id in ids
        assert t2.id in ids
        assert t3.id in ids

    def test_sales_rep_sees_only_assigned_triggers(
        self, client, db, sales_rep_user, sales_rep_token, sales_rep_user2,
        sample_company, sample_article
    ):
        t_mine = _make_trigger(db, sample_company, sample_article, assigned_to_id=sales_rep_user.id)
        t_other = _make_trigger(db, sample_company, sample_article, assigned_to_id=sales_rep_user2.id, event_type="Acquisition")

        res = client.get("/api/triggers/", headers=auth_headers(sales_rep_token))
        assert res.status_code == 200
        ids = [t["id"] for t in res.json()]
        assert t_mine.id in ids
        assert t_other.id not in ids

    def test_sales_rep_cannot_see_unassigned_triggers(
        self, client, db, sales_rep_user, sales_rep_token, sample_company, sample_article
    ):
        unassigned = _make_trigger(db, sample_company, sample_article, assigned_to_id=None)
        res = client.get("/api/triggers/", headers=auth_headers(sales_rep_token))
        assert res.status_code == 200
        ids = [t["id"] for t in res.json()]
        assert unassigned.id not in ids

    def test_sales_rep_returns_empty_when_no_assigned_triggers(
        self, client, db, sales_rep_user, sales_rep_token, sales_rep_user2,
        sample_company, sample_article
    ):
        # Only assign to rep2, rep1 should see nothing
        _make_trigger(db, sample_company, sample_article, assigned_to_id=sales_rep_user2.id)
        res = client.get("/api/triggers/", headers=auth_headers(sales_rep_token))
        assert res.status_code == 200
        assert res.json() == []


class TestTriggerFields:
    def test_trigger_response_contains_expected_fields(
        self, client, admin_user, admin_token, sample_trigger
    ):
        res = client.get("/api/triggers/", headers=auth_headers(admin_token))
        assert res.status_code == 200
        t = res.json()[0]
        for field in ("id", "company_id", "article_id", "event_type", "summary",
                      "business_impact", "recommended_service", "confidence_score",
                      "status", "created_at"):
            assert field in t, f"Missing field: {field}"

    def test_triggers_ordered_newest_first(
        self, client, db, admin_user, admin_token, sample_company, sample_article
    ):
        from datetime import datetime
        # Set explicit timestamps so SQLite doesn't collapse both to the same second
        t1 = TriggerEvent(
            company_id=sample_company.id, article_id=sample_article.id,
            event_type="Funding", summary="Older event", business_impact="Impact",
            recommended_service="Cloud Modernization", confidence_score=0.8, status="New",
            created_at=datetime(2025, 1, 1, 9, 0, 0),
        )
        db.add(t1)
        db.commit()
        db.refresh(t1)
        t2 = TriggerEvent(
            company_id=sample_company.id, article_id=sample_article.id,
            event_type="AI Adoption", summary="Newer event", business_impact="Impact",
            recommended_service="AI Automation", confidence_score=0.9, status="New",
            created_at=datetime(2025, 1, 2, 9, 0, 0),
        )
        db.add(t2)
        db.commit()
        db.refresh(t2)

        res = client.get("/api/triggers/", headers=auth_headers(admin_token))
        assert res.status_code == 200
        events = res.json()
        # t2 was created after t1, should be first
        assert events[0]["id"] == t2.id


class TestTriggerPagination:
    def test_limit_parameter(
        self, client, db, admin_user, admin_token, sample_company, sample_article
    ):
        for i in range(5):
            _make_trigger(db, sample_company, sample_article, event_type=f"Event{i}")

        res = client.get("/api/triggers/?limit=3", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert len(res.json()) == 3

    def test_skip_parameter(
        self, client, db, admin_user, admin_token, sample_company, sample_article
    ):
        for i in range(5):
            _make_trigger(db, sample_company, sample_article, event_type=f"Event{i}")

        res_all = client.get("/api/triggers/?limit=100", headers=auth_headers(admin_token))
        res_skipped = client.get("/api/triggers/?skip=3&limit=100", headers=auth_headers(admin_token))
        assert len(res_all.json()) == 5
        assert len(res_skipped.json()) == 2
