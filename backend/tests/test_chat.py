"""
Tests for the chat route:
  POST /api/chat/

LLM calls are mocked to keep tests fast and offline.
"""
import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import auth_headers

MOCK_LLM_RESPONSE = "Based on the platform data, Acme Corp is your top priority. They just raised $50M and are likely scaling cloud infrastructure — a perfect fit for Cloud Modernization."


def _mock_groq_response(content: str = MOCK_LLM_RESPONSE):
    """Helper to build a mock Groq response object."""
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = content
    return mock_resp


class TestChatAuth:
    def test_chat_requires_authentication(self, client):
        res = client.post("/api/chat/", json={"messages": [{"role": "user", "content": "Hello"}]})
        assert res.status_code == 401

    def test_chat_rejects_invalid_token(self, client):
        res = client.post(
            "/api/chat/",
            json={"messages": [{"role": "user", "content": "Hello"}]},
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert res.status_code == 401


class TestChatAdminUser:
    @patch("app.services.chat_service.Groq")
    def test_admin_gets_response(self, mock_groq_cls, client, admin_user, admin_token):
        mock_groq_cls.return_value.chat.completions.create.return_value = _mock_groq_response()

        res = client.post(
            "/api/chat/",
            json={"messages": [{"role": "user", "content": "Which companies should I prioritize?"}]},
            headers=auth_headers(admin_token),
        )
        assert res.status_code == 200
        body = res.json()
        assert "response" in body
        assert len(body["response"]) > 0

    @patch("app.services.chat_service.Groq")
    def test_response_is_string(self, mock_groq_cls, client, admin_user, admin_token):
        mock_groq_cls.return_value.chat.completions.create.return_value = _mock_groq_response("Some response text.")

        res = client.post(
            "/api/chat/",
            json={"messages": [{"role": "user", "content": "Hello"}]},
            headers=auth_headers(admin_token),
        )
        assert isinstance(res.json()["response"], str)

    @patch("app.services.chat_service.Groq")
    def test_llm_receives_system_prompt_with_platform_data(
        self, mock_groq_cls, client, admin_user, admin_token, sample_company, sample_trigger
    ):
        mock_instance = mock_groq_cls.return_value
        mock_instance.chat.completions.create.return_value = _mock_groq_response()

        client.post(
            "/api/chat/",
            json={"messages": [{"role": "user", "content": "What triggers exist?"}]},
            headers=auth_headers(admin_token),
        )

        call_args = mock_instance.chat.completions.create.call_args
        messages_sent = call_args[1]["messages"]
        system_content = messages_sent[0]["content"]

        # System prompt should include live data sections
        assert "RELANTO SERVICES" in system_content or "MONITORED COMPANIES" in system_content or "TRIGGER" in system_content


class TestChatSalesRepUser:
    @patch("app.services.chat_service.Groq")
    def test_sales_rep_gets_response(self, mock_groq_cls, client, sales_rep_user, sales_rep_token):
        mock_groq_cls.return_value.chat.completions.create.return_value = _mock_groq_response("Here are your assigned triggers...")

        res = client.post(
            "/api/chat/",
            json={"messages": [{"role": "user", "content": "Show me my triggers"}]},
            headers=auth_headers(sales_rep_token),
        )
        assert res.status_code == 200
        assert "response" in res.json()

    @patch("app.services.chat_service.Groq")
    def test_sales_rep_context_reflects_role(
        self, mock_groq_cls, client, sales_rep_user, sales_rep_token, sample_trigger
    ):
        """System prompt sent to LLM should mention the user's role."""
        mock_instance = mock_groq_cls.return_value
        mock_instance.chat.completions.create.return_value = _mock_groq_response()

        client.post(
            "/api/chat/",
            json={"messages": [{"role": "user", "content": "What are my assignments?"}]},
            headers=auth_headers(sales_rep_token),
        )

        call_args = mock_instance.chat.completions.create.call_args
        system_content = call_args[1]["messages"][0]["content"]
        assert "sales_rep" in system_content


class TestChatMultiTurn:
    @patch("app.services.chat_service.Groq")
    def test_multi_turn_conversation_passes_full_history(
        self, mock_groq_cls, client, admin_user, admin_token
    ):
        mock_instance = mock_groq_cls.return_value
        mock_instance.chat.completions.create.return_value = _mock_groq_response("Follow-up answer.")

        messages = [
            {"role": "user", "content": "Which company had a funding event?"},
            {"role": "assistant", "content": "Acme Corp raised $50M."},
            {"role": "user", "content": "What service should I pitch them?"},
        ]

        res = client.post(
            "/api/chat/",
            json={"messages": messages},
            headers=auth_headers(admin_token),
        )
        assert res.status_code == 200

        call_args = mock_instance.chat.completions.create.call_args
        sent_messages = call_args[1]["messages"]
        # system + 3 user/assistant messages = 4
        assert len(sent_messages) == 4

    @patch("app.services.chat_service.Groq")
    def test_single_message_works(self, mock_groq_cls, client, admin_user, admin_token):
        mock_groq_cls.return_value.chat.completions.create.return_value = _mock_groq_response()
        res = client.post(
            "/api/chat/",
            json={"messages": [{"role": "user", "content": "Hi"}]},
            headers=auth_headers(admin_token),
        )
        assert res.status_code == 200


class TestChatErrorHandling:
    @patch("app.services.chat_service.Groq")
    def test_llm_exception_returns_graceful_error(
        self, mock_groq_cls, client, admin_user, admin_token
    ):
        mock_groq_cls.return_value.chat.completions.create.side_effect = Exception("Groq API down")

        res = client.post(
            "/api/chat/",
            json={"messages": [{"role": "user", "content": "Hello"}]},
            headers=auth_headers(admin_token),
        )
        assert res.status_code == 200
        # Should return a graceful message, not crash
        assert "response" in res.json()
        assert len(res.json()["response"]) > 0

    def test_invalid_message_format_rejected(self, client, admin_user, admin_token):
        res = client.post(
            "/api/chat/",
            json={"messages": "not a list"},
            headers=auth_headers(admin_token),
        )
        assert res.status_code == 422
