"""
Tests for internal service authentication on the claim-drafter.
"""

import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


class TestInternalAuth:
    """Test the X-Internal-Secret header check."""

    def test_health_endpoint_is_always_accessible(self):
        """Health check should work without auth (for Docker health checks)."""
        from src.server import app
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_draft_accessible_when_no_secret_configured(self):
        """When INTERNAL_SERVICE_SECRET is not set, auth is disabled (dev mode)."""
        from src.server import app
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/draft/sync", json={
            "invention_narrative": "test",
            "settings": {"api_key": "fake"}
        })
        # Should get past auth (may fail on pipeline with 500 — that's OK, we're testing auth)
        assert resp.status_code != 403

    def test_draft_rejected_when_secret_set_and_not_provided(self):
        """When secret is configured, requests without it get 403."""
        import src.server as srv
        original = srv.INTERNAL_SECRET
        srv.INTERNAL_SECRET = "test-secret-123"
        try:
            client = TestClient(srv.app)
            resp = client.post("/draft/sync", json={
                "invention_narrative": "test",
                "settings": {"api_key": "fake"}
            })
            assert resp.status_code == 403
            assert "internal service secret" in resp.json()["detail"].lower()
        finally:
            srv.INTERNAL_SECRET = original

    def test_draft_accepted_with_correct_secret(self):
        """When secret matches, request passes auth."""
        import src.server as srv
        original = srv.INTERNAL_SECRET
        srv.INTERNAL_SECRET = "test-secret-123"
        try:
            client = TestClient(srv.app, raise_server_exceptions=False)
            resp = client.post(
                "/draft/sync",
                json={
                    "invention_narrative": "test",
                    "settings": {"api_key": "fake"}
                },
                headers={"X-Internal-Secret": "test-secret-123"},
            )
            # Should get past auth (may fail on pipeline with 500 — that's OK)
            assert resp.status_code != 403
        finally:
            srv.INTERNAL_SECRET = original

    def test_draft_rejected_with_wrong_secret(self):
        """Wrong secret gets 403."""
        import src.server as srv
        original = srv.INTERNAL_SECRET
        srv.INTERNAL_SECRET = "correct-secret"
        try:
            client = TestClient(srv.app)
            resp = client.post(
                "/draft/sync",
                json={
                    "invention_narrative": "test",
                    "settings": {"api_key": "fake"}
                },
                headers={"X-Internal-Secret": "wrong-secret"},
            )
            assert resp.status_code == 403
        finally:
            srv.INTERNAL_SECRET = original
