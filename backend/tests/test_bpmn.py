"""BPMN pipeline tests.

Tests for the /api/bpmn/* endpoints and the generator unit.
Fast tests (no LLM call) run by default.
Slow tests (live Groq call) are opt-in: pytest -m slow

Run with: cd backend && pytest tests/test_bpmn.py -v
"""

import pytest
import httpx

from src.bpmn.models import (
    Actor, Activity, BPMNEvent, Gateway, ProcessFlow, SequenceFlow,
)
from src.bpmn.generator import generate_bpmn_xml

BASE = "http://localhost:8000"

SIMPLE_TEXT = (
    "Actors: Customer, Agent.\n"
    "1. Customer enters store with an issue.\n"
    "2. Agent greets customer and records the issue.\n"
    "3. If issue is simple: Agent resolves on the spot. Customer confirms. Done.\n"
    "4. Otherwise: Agent creates a case. Manager reviews. Customer notified. Case closed."
)

# ---------------------------------------------------------------------------
# Fixture: minimal process flow for generator unit tests
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_flow() -> ProcessFlow:
    return ProcessFlow(
        name="Test Process",
        actors=[
            Actor(id="actor_1", name="Customer"),
            Actor(id="actor_2", name="Agent"),
        ],
        events=[
            BPMNEvent(id="evt_start", name="Start", event_type="start", lane_id="actor_1"),
            BPMNEvent(id="evt_end", name="End", event_type="end", lane_id="actor_2"),
        ],
        activities=[
            Activity(id="act_1", name="Submit Request", activity_type="userTask", lane_id="actor_1"),
            Activity(id="act_2", name="Process Request", activity_type="serviceTask", lane_id="actor_2"),
        ],
        gateways=[
            Gateway(id="gw_1", name="Approved?", gateway_type="exclusive", lane_id="actor_2"),
        ],
        sequence_flows=[
            SequenceFlow(id="sf_1", source_id="evt_start", target_id="act_1"),
            SequenceFlow(id="sf_2", source_id="act_1", target_id="gw_1"),
            SequenceFlow(id="sf_3", source_id="gw_1", target_id="act_2", condition_label="Yes"),
            SequenceFlow(id="sf_4", source_id="act_2", target_id="evt_end"),
        ],
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def login(username: str, password: str) -> str:
    r = httpx.post(f"{BASE}/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return r.json()["token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Generator unit tests (no LLM — fast)
# ---------------------------------------------------------------------------

class TestBPMNGenerator:
    def test_generates_valid_xml_declaration(self, sample_flow):
        xml = generate_bpmn_xml(sample_flow)
        assert xml.startswith("<?xml")

    def test_generates_all_namespace_declarations_at_root(self, sample_flow):
        xml = generate_bpmn_xml(sample_flow)
        # All four namespaces must be declared (bpmn-js requires them at root)
        assert 'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"' in xml
        assert 'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"' in xml
        assert 'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"' in xml
        assert 'xmlns:di="http://www.omg.org/spec/DD/20100524/DI"' in xml

    def test_generates_semantic_elements(self, sample_flow):
        xml = generate_bpmn_xml(sample_flow)
        assert "bpmn:collaboration" in xml
        assert "bpmn:participant" in xml
        assert "bpmn:process" in xml
        assert "bpmn:laneSet" in xml
        assert "bpmn:lane" in xml
        assert "bpmn:startEvent" in xml
        assert "bpmn:endEvent" in xml
        assert "bpmn:userTask" in xml
        assert "bpmn:serviceTask" in xml
        assert "bpmn:exclusiveGateway" in xml
        assert "bpmn:sequenceFlow" in xml

    def test_generates_di_section(self, sample_flow):
        xml = generate_bpmn_xml(sample_flow)
        assert "bpmndi:BPMNDiagram" in xml
        assert "bpmndi:BPMNPlane" in xml
        assert "bpmndi:BPMNShape" in xml
        assert "bpmndi:BPMNEdge" in xml

    def test_generates_coordinate_bounds(self, sample_flow):
        xml = generate_bpmn_xml(sample_flow)
        assert "dc:Bounds" in xml
        assert 'width="' in xml
        assert 'height="' in xml

    def test_generates_waypoints(self, sample_flow):
        xml = generate_bpmn_xml(sample_flow)
        assert "di:waypoint" in xml

    def test_lanes_are_horizontal(self, sample_flow):
        xml = generate_bpmn_xml(sample_flow)
        # Count isHorizontal="true" — should appear for pool + each lane
        count = xml.count('isHorizontal="true"')
        assert count >= len(sample_flow.actors) + 1  # pool + lanes

    def test_actor_names_appear_in_xml(self, sample_flow):
        xml = generate_bpmn_xml(sample_flow)
        for actor in sample_flow.actors:
            assert actor.name in xml

    def test_process_name_in_participant(self, sample_flow):
        xml = generate_bpmn_xml(sample_flow)
        assert sample_flow.name in xml

    def test_condition_labels_in_xml(self, sample_flow):
        xml = generate_bpmn_xml(sample_flow)
        assert "Approved?" in xml or "Yes" in xml  # condition label on gateway flow

    def test_five_lane_process(self):
        """Generator handles 5-lane Telco process without crashing."""
        pf = ProcessFlow(
            name="Telco Case",
            actors=[
                Actor(id="a1", name="Customer"),
                Actor(id="a2", name="Frontliner"),
                Actor(id="a3", name="Supervisor"),
                Actor(id="a4", name="Backend"),
                Actor(id="a5", name="Case Mgmt"),
            ],
            events=[
                BPMNEvent(id="e_start", name="Start", event_type="start", lane_id="a1"),
                BPMNEvent(id="e_end", name="End", event_type="end", lane_id="a1"),
            ],
            activities=[
                Activity(id="act_a", name="Report Issue", lane_id="a1"),
                Activity(id="act_b", name="Create Case", lane_id="a2"),
                Activity(id="act_c", name="Evaluate", lane_id="a3"),
                Activity(id="act_d", name="Resolve", lane_id="a4"),
                Activity(id="act_e", name="Monitor SLA", lane_id="a5"),
            ],
            sequence_flows=[
                SequenceFlow(id="f1", source_id="e_start", target_id="act_a"),
                SequenceFlow(id="f2", source_id="act_a", target_id="act_b"),
                SequenceFlow(id="f3", source_id="act_b", target_id="act_c"),
                SequenceFlow(id="f4", source_id="act_c", target_id="act_d"),
                SequenceFlow(id="f5", source_id="act_d", target_id="act_e"),
                SequenceFlow(id="f6", source_id="act_e", target_id="e_end"),
            ],
        )
        xml = generate_bpmn_xml(pf)
        assert "bpmn:definitions" in xml
        assert xml.count("bpmn:lane") >= 5


# ---------------------------------------------------------------------------
# API endpoint tests (require running server — fast, no LLM)
# ---------------------------------------------------------------------------

class TestBPMNEndpoints:
    def test_parse_requires_auth(self):
        r = httpx.post(
            f"{BASE}/api/bpmn/parse",
            json={"text": "a process flow description goes here"},
        )
        assert r.status_code == 401

    def test_viewer_cannot_parse(self):
        token = login("viewer", "viewer123")
        r = httpx.post(
            f"{BASE}/api/bpmn/parse",
            json={"text": "a process flow description goes here"},
            headers=auth_headers(token),
        )
        assert r.status_code == 403

    def test_parse_empty_input_returns_422(self):
        token = login("admin", "admin123")
        r = httpx.post(
            f"{BASE}/api/bpmn/parse",
            json={"text": "short"},
            headers=auth_headers(token),
        )
        assert r.status_code == 422

    def test_parse_oversized_input_returns_422(self):
        token = login("admin", "admin123")
        r = httpx.post(
            f"{BASE}/api/bpmn/parse",
            json={"text": "x" * 5001},
            headers=auth_headers(token),
        )
        assert r.status_code == 422

    def test_templates_endpoint_returns_list(self):
        token = login("admin", "admin123")
        r = httpx.get(f"{BASE}/api/bpmn/templates", headers=auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert all("name" in t and "text" in t for t in data)

    def test_templates_include_telco(self):
        token = login("manager", "manager123")
        r = httpx.get(f"{BASE}/api/bpmn/templates", headers=auth_headers(token))
        assert r.status_code == 200
        names = [t["name"].lower() for t in r.json()]
        assert any("telco" in n for n in names)

    def test_templates_requires_auth(self):
        r = httpx.get(f"{BASE}/api/bpmn/templates")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Live LLM integration test (opt-in — calls Groq, takes ~15s)
# ---------------------------------------------------------------------------

class TestBPMNLiveIntegration:
    @pytest.mark.slow
    def test_parse_returns_bpmn_xml(self):
        """Full pipeline: text → Groq → ProcessFlow → BPMN XML."""
        token = login("admin", "admin123")
        r = httpx.post(
            f"{BASE}/api/bpmn/parse",
            json={"text": SIMPLE_TEXT},
            headers=auth_headers(token),
            timeout=60,
        )
        assert r.status_code == 200, f"Parse failed: {r.text}"
        data = r.json()
        assert "bpmn_xml" in data
        assert "process_json" in data
        xml = data["bpmn_xml"]
        assert "<?xml" in xml or "<bpmn:definitions" in xml
        assert "bpmn:process" in xml
        assert "bpmndi:BPMNDiagram" in xml

    @pytest.mark.slow
    def test_parse_produces_swimlanes(self):
        """LLM correctly extracts actors as lanes."""
        token = login("admin", "admin123")
        r = httpx.post(
            f"{BASE}/api/bpmn/parse",
            json={"text": SIMPLE_TEXT},
            headers=auth_headers(token),
            timeout=60,
        )
        assert r.status_code == 200
        pj = r.json()["process_json"]
        assert len(pj["actors"]) >= 2
        assert len(pj["activities"]) >= 2
        assert len(pj["sequence_flows"]) >= 2

    @pytest.mark.slow
    def test_manager_can_parse(self):
        token = login("manager", "manager123")
        r = httpx.post(
            f"{BASE}/api/bpmn/parse",
            json={"text": SIMPLE_TEXT},
            headers=auth_headers(token),
            timeout=60,
        )
        assert r.status_code == 200
