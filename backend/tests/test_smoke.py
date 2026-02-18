"""Smoke tests for the Pulse API.

Exercises auth, org diagram endpoints, and the chat/RAG pipeline.
Run with: cd backend && pytest tests/test_smoke.py -v
"""

import json
import pytest
import httpx


BASE = "http://localhost:8000"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def login(username: str, password: str) -> dict:
    r = httpx.post(f"{BASE}/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"Login failed for {username}: {r.text}"
    return r.json()


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class TestAuth:
    def test_admin_login(self):
        data = login("admin", "admin123")
        assert data["role"] == "admin"
        assert "token" in data

    def test_manager_login(self):
        data = login("manager", "manager123")
        assert data["role"] == "manager"

    def test_viewer_login(self):
        data = login("viewer", "viewer123")
        assert data["role"] == "viewer"

    def test_bad_credentials(self):
        r = httpx.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_unauthenticated_org_request(self):
        r = httpx.get(f"{BASE}/api/org/diagram/org_chart")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Org Diagrams — permission filtering
# ---------------------------------------------------------------------------

DIAGRAM_TYPES = ["org_chart", "business_process", "workflow"]


class TestOrgDiagrams:
    @pytest.fixture(autouse=True)
    def tokens(self):
        self.admin_token = login("admin", "admin123")["token"]
        self.manager_token = login("manager", "manager123")["token"]
        self.viewer_token = login("viewer", "viewer123")["token"]

    @pytest.mark.parametrize("diagram_type", DIAGRAM_TYPES)
    def test_admin_sees_all_nodes(self, diagram_type):
        r = httpx.get(f"{BASE}/api/org/diagram/{diagram_type}", headers=auth_headers(self.admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "nodes" in data and "edges" in data
        assert len(data["nodes"]) > 0
        # Admin: no restricted nodes (is_restricted == False for all)
        restricted = [n for n in data["nodes"] if n["data"]["is_restricted"]]
        assert len(restricted) == 0, f"Admin should see all nodes, got {len(restricted)} restricted"

    @pytest.mark.parametrize("diagram_type", DIAGRAM_TYPES)
    def test_viewer_has_restricted_nodes(self, diagram_type):
        r = httpx.get(f"{BASE}/api/org/diagram/{diagram_type}", headers=auth_headers(self.viewer_token))
        assert r.status_code == 200
        data = r.json()
        restricted = [n for n in data["nodes"] if n["data"]["is_restricted"]]
        # Each diagram has at least one manager/admin-level node
        assert len(restricted) > 0, "Viewer should see some restricted nodes"

    @pytest.mark.parametrize("diagram_type", DIAGRAM_TYPES)
    def test_manager_sees_more_than_viewer(self, diagram_type):
        r_manager = httpx.get(f"{BASE}/api/org/diagram/{diagram_type}", headers=auth_headers(self.manager_token))
        r_viewer  = httpx.get(f"{BASE}/api/org/diagram/{diagram_type}", headers=auth_headers(self.viewer_token))
        manager_restricted = sum(1 for n in r_manager.json()["nodes"] if n["data"]["is_restricted"])
        viewer_restricted  = sum(1 for n in r_viewer.json()["nodes"]  if n["data"]["is_restricted"])
        assert manager_restricted <= viewer_restricted, "Manager should have fewer (or equal) restricted nodes than viewer"

    def test_invalid_diagram_type(self):
        r = httpx.get(f"{BASE}/api/org/diagram/nonexistent", headers=auth_headers(self.admin_token))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Chat / RAG
# ---------------------------------------------------------------------------

class TestChat:
    def _chat(self, message: str) -> dict:
        """Send a chat message and parse the SSE answer event."""
        with httpx.Client(timeout=60) as client:
            with client.stream("POST", f"{BASE}/api/chat",
                               json={"message": message, "history": []}) as r:
                assert r.status_code == 200
                answer = {}
                for line in r.iter_lines():
                    if line.startswith("data:"):
                        payload = json.loads(line[5:].strip())
                        if "text" in payload:
                            answer = payload
                return answer

    def test_agile_question_returns_answer(self):
        result = self._chat("What is agile methodology?")
        assert result.get("text"), "Expected a non-empty answer"
        assert "agile" in result["text"].lower() or "sprint" in result["text"].lower()

    def test_business_process_question(self):
        result = self._chat("How does the customer place an order?")
        assert result.get("text"), "Expected a non-empty answer"
        text = result["text"].lower()
        assert any(word in text for word in ["order", "customer", "submit", "select"])

    def test_workflow_question(self):
        result = self._chat("Tell me about the deployment workflow")
        assert result.get("text"), "Expected a non-empty answer"
        text = result["text"].lower()
        assert any(word in text for word in ["deploy", "pipeline", "pull request", "ci", "workflow"])

    def test_sources_returned(self):
        result = self._chat("What is agile?")
        # Sources list present (may be empty if no docs matched, but key must exist)
        assert "sources" in result

    def test_diagram_intent_routed(self):
        """A diagram request should set diagram_code, not just text."""
        with httpx.Client(timeout=60) as client:
            with client.stream("POST", f"{BASE}/api/chat",
                               json={"message": "Generate a diagram of the org chart", "history": []}) as r:
                assert r.status_code == 200
                intent = None
                diagram_code = None
                for line in r.iter_lines():
                    if line.startswith("data:"):
                        payload = json.loads(line[5:].strip())
                        if "intent" in payload:
                            intent = payload["intent"]
                        if "diagram_code" in payload:
                            diagram_code = payload["diagram_code"]
                assert intent == "generate_diagram", f"Expected generate_diagram, got {intent}"
                assert diagram_code, "Expected Mermaid diagram code"
