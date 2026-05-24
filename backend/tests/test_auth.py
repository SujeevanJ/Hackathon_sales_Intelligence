"""
Tests for authentication routes:
  POST /api/auth/login
  GET  /api/auth/me
"""
import pytest
from tests.conftest import auth_headers


# ── Login ─────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_login_valid_admin_credentials(self, client, admin_user):
        res = client.post("/api/auth/login", data={
            "username": "test_admin",
            "password": "AdminPass123!",
        })
        assert res.status_code == 200
        body = res.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert len(body["access_token"]) > 10

    def test_login_valid_sales_rep_credentials(self, client, sales_rep_user):
        res = client.post("/api/auth/login", data={
            "username": "test_rep",
            "password": "RepPass123!",
        })
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_login_wrong_password(self, client, admin_user):
        res = client.post("/api/auth/login", data={
            "username": "test_admin",
            "password": "WrongPassword!",
        })
        assert res.status_code == 401
        assert "Incorrect" in res.json()["detail"]

    def test_login_nonexistent_user(self, client):
        res = client.post("/api/auth/login", data={
            "username": "ghost_user",
            "password": "any_password",
        })
        assert res.status_code == 401

    def test_login_missing_username(self, client):
        res = client.post("/api/auth/login", data={"password": "AdminPass123!"})
        assert res.status_code == 422  # validation error

    def test_login_missing_password(self, client, admin_user):
        res = client.post("/api/auth/login", data={"username": "test_admin"})
        assert res.status_code == 422

    def test_login_empty_credentials(self, client):
        # FastAPI's OAuth2PasswordRequestForm rejects empty strings at the form-validation
        # layer (422) before auth logic is reached — both 401 and 422 mean "not authenticated"
        res = client.post("/api/auth/login", data={"username": "", "password": ""})
        assert res.status_code in (401, 422)


# ── Get current user ──────────────────────────────────────────────────────────

class TestGetMe:
    def test_get_me_as_admin(self, client, admin_user, admin_token):
        res = client.get("/api/auth/me", headers=auth_headers(admin_token))
        assert res.status_code == 200
        body = res.json()
        assert body["username"] == "test_admin"
        assert body["role"] == "admin"
        assert body["is_active"] is True

    def test_get_me_as_sales_rep(self, client, sales_rep_user, sales_rep_token):
        res = client.get("/api/auth/me", headers=auth_headers(sales_rep_token))
        assert res.status_code == 200
        body = res.json()
        assert body["username"] == "test_rep"
        assert body["role"] == "sales_rep"

    def test_get_me_without_token(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401

    def test_get_me_with_invalid_token(self, client):
        res = client.get("/api/auth/me", headers={"Authorization": "Bearer not_a_real_token"})
        assert res.status_code == 401

    def test_get_me_with_malformed_header(self, client):
        res = client.get("/api/auth/me", headers={"Authorization": "NotBearer sometoken"})
        assert res.status_code == 401

    def test_token_does_not_expose_password_hash(self, client, admin_user, admin_token):
        res = client.get("/api/auth/me", headers=auth_headers(admin_token))
        body = res.json()
        assert "password" not in body
        assert "password_hash" not in body

    def test_get_me_response_contains_id(self, client, admin_user, admin_token):
        res = client.get("/api/auth/me", headers=auth_headers(admin_token))
        assert "id" in res.json()
