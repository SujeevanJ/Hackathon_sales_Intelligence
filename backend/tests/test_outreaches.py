"""
Tests for outreach routes:
  GET /api/outreaches/
  GET /api/outreaches/stats
  GET /api/outreaches/trigger/{trigger_id}
"""
import pytest
from tests.conftest import auth_headers


class TestGetOutreaches:
    def test_requires_authentication(self, client):
        res = client.get("/api/outreaches/")
        assert res.status_code == 401

    def test_returns_empty_list_when_no_outreaches(self, client, admin_user, admin_token):
        res = client.get("/api/outreaches/", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert res.json() == []

    def test_returns_outreach_briefs(self, client, admin_user, admin_token, sample_outreach):
        res = client.get("/api/outreaches/", headers=auth_headers(admin_token))
        assert res.status_code == 200
        briefs = res.json()
        assert len(briefs) == 1
        assert briefs[0]["contact_name"] == "Jane Smith"
        assert briefs[0]["contact_role"] == "CTO"
        assert briefs[0]["persona"] == "CTO"

    def test_outreach_contains_expected_fields(self, client, admin_user, admin_token, sample_outreach):
        res = client.get("/api/outreaches/", headers=auth_headers(admin_token))
        brief = res.json()[0]
        for field in ("id", "company_id", "trigger_id", "contact_name", "contact_role",
                      "contact_email", "subject", "body", "persona", "created_at"):
            assert field in brief, f"Missing field: {field}"

    def test_sales_rep_can_access_outreaches(self, client, sales_rep_user, sales_rep_token, sample_outreach):
        res = client.get("/api/outreaches/", headers=auth_headers(sales_rep_token))
        assert res.status_code == 200

    def test_pagination_limit(self, client, admin_user, admin_token, sample_outreach):
        res = client.get("/api/outreaches/?limit=0", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert res.json() == []

    def test_pagination_skip(self, client, admin_user, admin_token, sample_outreach):
        res = client.get("/api/outreaches/?skip=1", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert res.json() == []  # Only 1 outreach, skip=1 means empty


class TestGetOutreachByTrigger:
    def test_returns_outreach_for_valid_trigger(
        self, client, admin_user, admin_token, sample_trigger, sample_outreach
    ):
        res = client.get(
            f"/api/outreaches/trigger/{sample_trigger.id}",
            headers=auth_headers(admin_token),
        )
        assert res.status_code == 200
        body = res.json()
        assert body["trigger_id"] == sample_trigger.id
        assert body["contact_name"] == "Jane Smith"
        assert body["subject"] != ""

    def test_returns_404_for_nonexistent_trigger(self, client, admin_user, admin_token):
        res = client.get("/api/outreaches/trigger/99999", headers=auth_headers(admin_token))
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_requires_authentication(self, client, sample_trigger):
        res = client.get(f"/api/outreaches/trigger/{sample_trigger.id}")
        assert res.status_code == 401

    def test_outreach_contains_multi_channel_drafts(
        self, client, admin_user, admin_token, sample_trigger, sample_outreach
    ):
        res = client.get(
            f"/api/outreaches/trigger/{sample_trigger.id}",
            headers=auth_headers(admin_token),
        )
        body = res.json()
        assert body["body"] is not None
        assert body["linkedin_draft"] is not None
        assert body["whatsapp_draft"] is not None


class TestOutreachStats:
    def test_requires_authentication(self, client):
        res = client.get("/api/outreaches/stats")
        assert res.status_code == 401

    def test_stats_when_no_outreaches(self, client, admin_user, admin_token):
        res = client.get("/api/outreaches/stats", headers=auth_headers(admin_token))
        assert res.status_code == 200
        body = res.json()
        assert body["total_outreaches"] == 0
        assert body["by_persona"] == []
        assert body["by_company"] == []

    def test_stats_counts_correctly(self, client, admin_user, admin_token, sample_outreach):
        res = client.get("/api/outreaches/stats", headers=auth_headers(admin_token))
        assert res.status_code == 200
        body = res.json()
        assert body["total_outreaches"] == 1

    def test_stats_groups_by_persona(self, client, admin_user, admin_token, sample_outreach):
        res = client.get("/api/outreaches/stats", headers=auth_headers(admin_token))
        body = res.json()
        personas = {p["name"]: p["value"] for p in body["by_persona"]}
        assert "CTO" in personas
        assert personas["CTO"] == 1

    def test_stats_groups_by_company(self, client, admin_user, admin_token, sample_outreach):
        res = client.get("/api/outreaches/stats", headers=auth_headers(admin_token))
        body = res.json()
        companies = {c["name"]: c["value"] for c in body["by_company"]}
        assert "Acme Corp" in companies
        assert companies["Acme Corp"] == 1

    def test_stats_response_structure(self, client, admin_user, admin_token):
        res = client.get("/api/outreaches/stats", headers=auth_headers(admin_token))
        assert res.status_code == 200
        body = res.json()
        assert "total_outreaches" in body
        assert "by_persona" in body
        assert "by_company" in body
