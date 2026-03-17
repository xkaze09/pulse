"""BPMN 2.0 XML generator.

Converts a validated ProcessFlow into BPMN 2.0 XML renderable by bpmn-js.

Layout algorithm:
  - Actors → horizontal swimlanes stacked vertically (160px each)
  - Elements ordered left-to-right by BFS depth from start event
  - Pool/participant wraps all lanes with a 30px header strip on the left
  - Each lane has an additional 30px label strip, then element columns at 190px spacing

ASCII layout:
  ┌────────────────────────────────────────────────────────┐
  │ Pool │ Lane 0 │ [StartEvt] ──► [Task] ──► [Gateway]  │
  │      │ Lane 1 │             [Task2]     [Task3] ──►  │
  │      │ Lane 2 │                                [End]  │
  └────────────────────────────────────────────────────────┘
    30px   30px     col0=240  col1=430  col2=620 ...
"""

import xml.etree.ElementTree as ET
from collections import deque

from src.bpmn.models import Activity, BPMNEvent, Gateway, ProcessFlow

# ---------------------------------------------------------------------------
# Namespace URIs and registration
# ---------------------------------------------------------------------------

BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"
BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI"
DC_NS = "http://www.omg.org/spec/DD/20100524/DC"
DI_NS = "http://www.omg.org/spec/DD/20100524/DI"

ET.register_namespace("bpmn", BPMN_NS)
ET.register_namespace("bpmndi", BPMNDI_NS)
ET.register_namespace("dc", DC_NS)
ET.register_namespace("di", DI_NS)


def _b(tag: str) -> str:
    return f"{{{BPMN_NS}}}{tag}"


def _bdi(tag: str) -> str:
    return f"{{{BPMNDI_NS}}}{tag}"


def _dc(tag: str) -> str:
    return f"{{{DC_NS}}}{tag}"


def _di(tag: str) -> str:
    return f"{{{DI_NS}}}{tag}"


# ---------------------------------------------------------------------------
# Layout constants
# ---------------------------------------------------------------------------

POOL_X = 120          # left edge of the pool shape
POOL_Y = 52           # top edge of the pool shape
POOL_HEADER_W = 30    # width of pool participant label strip
LANE_HEADER_W = 30    # additional width for lane label strip inside pool
LANE_HEIGHT = 160     # height of each swimlane
COL_MARGIN = 60       # x-margin from lane header to first element center
STEP_WIDTH = 190      # center-to-center horizontal spacing between columns

# Element (w, h) by type
EVENT_W, EVENT_H = 36, 36
TASK_W, TASK_H = 100, 80
GW_W, GW_H = 50, 50


# ---------------------------------------------------------------------------
# Layout helpers
# ---------------------------------------------------------------------------

def _col_cx(col: int) -> int:
    """X center of column `col`."""
    return POOL_X + POOL_HEADER_W + LANE_HEADER_W + COL_MARGIN + col * STEP_WIDTH


def _lane_cy(lane_idx: int) -> int:
    """Y center of lane `lane_idx`."""
    return POOL_Y + lane_idx * LANE_HEIGHT + LANE_HEIGHT // 2


def _elem_size(elem) -> tuple[int, int]:
    if isinstance(elem, BPMNEvent):
        return EVENT_W, EVENT_H
    if isinstance(elem, Gateway):
        return GW_W, GW_H
    return TASK_W, TASK_H


# ---------------------------------------------------------------------------
# Column assignment (BFS longest-path, loop-back safe)
# ---------------------------------------------------------------------------

def _assign_columns(process: ProcessFlow) -> dict[str, int]:
    """Assign a horizontal column index to every element.

    Uses BFS from start events with a visited-set guard so that loop-back
    edges (e.g. rejected case → re-assess) don't cause unbounded column growth.
    """
    all_ids: set[str] = (
        {e.id for e in process.events}
        | {a.id for a in process.activities}
        | {g.id for g in process.gateways}
    )

    successors: dict[str, list[str]] = {}
    for sf in process.sequence_flows:
        if sf.source_id in all_ids and sf.target_id in all_ids:
            successors.setdefault(sf.source_id, []).append(sf.target_id)

    # Seed from start events; fall back to elements with no predecessors
    start_ids = [e.id for e in process.events if e.event_type == "start"]
    if not start_ids:
        all_targets = {sf.target_id for sf in process.sequence_flows if sf.target_id in all_ids}
        start_ids = list(all_ids - all_targets) or [next(iter(all_ids))]

    columns: dict[str, int] = {}
    visited: set[str] = set()
    queue: deque[str] = deque()

    for sid in start_ids:
        columns[sid] = 0
        queue.append(sid)

    while queue:
        current = queue.popleft()
        if current in visited:
            continue
        visited.add(current)
        cur_col = columns.get(current, 0)
        for succ in successors.get(current, []):
            if succ not in visited:
                proposed = cur_col + 1
                if columns.get(succ, -1) < proposed:
                    columns[succ] = proposed
                queue.append(succ)

    # Assign any elements not reachable from start events
    max_col = max(columns.values(), default=0)
    for i, eid in enumerate(sorted(all_ids - set(columns.keys()))):
        columns[eid] = max_col + 1 + i

    return columns


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def generate_bpmn_xml(process: ProcessFlow) -> str:
    """Convert a ProcessFlow into a BPMN 2.0 XML string.

    Returns a UTF-8 XML string with:
      - bpmn:collaboration / bpmn:participant (pool)
      - bpmn:process with bpmn:laneSet (one lane per actor)
      - All flow elements: startEvent, endEvent, userTask, serviceTask,
        manualTask, exclusiveGateway, parallelGateway
      - All sequenceFlow elements
      - bpmndi:BPMNDiagram with BPMNShape + BPMNEdge DI entries
    """

    # Build element lookup
    actor_idx: dict[str, int] = {a.id: i for i, a in enumerate(process.actors)}
    all_elements: dict[str, BPMNEvent | Activity | Gateway] = {}
    for e in process.events:
        all_elements[e.id] = e
    for a in process.activities:
        all_elements[a.id] = a
    for g in process.gateways:
        all_elements[g.id] = g

    columns = _assign_columns(process)
    max_col = max(columns.values(), default=0)

    num_lanes = len(process.actors)
    pool_width = POOL_HEADER_W + LANE_HEADER_W + COL_MARGIN + (max_col + 1) * STEP_WIDTH + 80
    pool_height = num_lanes * LANE_HEIGHT

    # Map actor_id → list of element IDs in that lane
    lane_elements: dict[str, list[str]] = {a.id: [] for a in process.actors}
    for eid, elem in all_elements.items():
        lid = getattr(elem, "lane_id", None)
        if lid not in lane_elements:
            lid = process.actors[0].id  # fallback to first lane
        lane_elements[lid].append(eid)

    # -----------------------------------------------------------------------
    # BPMN semantic section
    # -----------------------------------------------------------------------

    root = ET.Element(_b("definitions"))
    root.set("id", "Definitions_1")
    root.set("targetNamespace", "http://bpmn.io/schema/bpmn")
    root.set("exporter", "Pulse BPMN Generator")
    root.set("exporterVersion", "1.0")

    # Collaboration
    collab = ET.SubElement(root, _b("collaboration"))
    collab.set("id", "Collaboration_1")
    participant = ET.SubElement(collab, _b("participant"))
    participant.set("id", "Participant_1")
    participant.set("name", process.name)
    participant.set("processRef", "Process_1")

    # Process
    proc = ET.SubElement(root, _b("process"))
    proc.set("id", "Process_1")
    proc.set("isExecutable", "false")

    # LaneSet
    lane_set = ET.SubElement(proc, _b("laneSet"))
    lane_set.set("id", "LaneSet_1")
    for actor in process.actors:
        lane = ET.SubElement(lane_set, _b("lane"))
        lane.set("id", f"Lane_{actor.id}")
        lane.set("name", actor.name)
        for eid in lane_elements.get(actor.id, []):
            ref = ET.SubElement(lane, _b("flowNodeRef"))
            ref.text = eid

    # Events
    for event in process.events:
        tag = "startEvent" if event.event_type == "start" else "endEvent"
        el = ET.SubElement(proc, _b(tag))
        el.set("id", event.id)
        el.set("name", event.name)

    # Activities
    for activity in process.activities:
        el = ET.SubElement(proc, _b(activity.activity_type))
        el.set("id", activity.id)
        el.set("name", activity.name)

    # Gateways
    _GW_TAG = {
        "exclusive": "exclusiveGateway",
        "parallel": "parallelGateway",
        "inclusive": "inclusiveGateway",
    }
    for gateway in process.gateways:
        el = ET.SubElement(proc, _b(_GW_TAG.get(gateway.gateway_type, "exclusiveGateway")))
        el.set("id", gateway.id)
        el.set("name", gateway.name)

    # Sequence flows
    for sf in process.sequence_flows:
        el = ET.SubElement(proc, _b("sequenceFlow"))
        el.set("id", sf.id)
        el.set("sourceRef", sf.source_id)
        el.set("targetRef", sf.target_id)
        if sf.condition_label:
            cond = ET.SubElement(el, _b("conditionExpression"))
            cond.text = sf.condition_label

    # -----------------------------------------------------------------------
    # BPMNDiagram (DI) section
    # -----------------------------------------------------------------------

    diagram = ET.SubElement(root, _bdi("BPMNDiagram"))
    diagram.set("id", "BPMNDiagram_1")
    plane = ET.SubElement(diagram, _bdi("BPMNPlane"))
    plane.set("id", "BPMNPlane_1")
    plane.set("bpmnElement", "Collaboration_1")

    # Pool (participant) shape
    _add_shape(plane, "Participant_1_di", "Participant_1",
               POOL_X, POOL_Y, pool_width, pool_height, horizontal=True)

    # Lane shapes
    for i, actor in enumerate(process.actors):
        _add_shape(
            plane,
            f"Lane_{actor.id}_di",
            f"Lane_{actor.id}",
            POOL_X + POOL_HEADER_W,
            POOL_Y + i * LANE_HEIGHT,
            pool_width - POOL_HEADER_W,
            LANE_HEIGHT,
            horizontal=True,
        )

    # Element shapes
    for eid, elem in all_elements.items():
        col = columns.get(eid, 0)
        lid = getattr(elem, "lane_id", process.actors[0].id)
        if lid not in actor_idx:
            lid = process.actors[0].id
        lane_i = actor_idx[lid]

        cx = _col_cx(col)
        cy = _lane_cy(lane_i)
        w, h = _elem_size(elem)

        shape = _add_shape(plane, f"{eid}_di", eid, cx - w // 2, cy - h // 2, w, h)

        # Label bounds below small shapes (events and gateways)
        if isinstance(elem, (BPMNEvent, Gateway)):
            lbl = ET.SubElement(shape, _bdi("BPMNLabel"))
            lb = ET.SubElement(lbl, _dc("Bounds"))
            lb.set("x", str(cx - 50))
            lb.set("y", str(cy + h // 2 + 6))
            lb.set("width", "100")
            lb.set("height", "27")

    # Sequence flow edges
    for sf in process.sequence_flows:
        src = all_elements.get(sf.source_id)
        tgt = all_elements.get(sf.target_id)
        if not src or not tgt:
            continue

        src_lid = getattr(src, "lane_id", process.actors[0].id)
        tgt_lid = getattr(tgt, "lane_id", process.actors[0].id)
        if src_lid not in actor_idx:
            src_lid = process.actors[0].id
        if tgt_lid not in actor_idx:
            tgt_lid = process.actors[0].id

        src_col = columns.get(sf.source_id, 0)
        tgt_col = columns.get(sf.target_id, 0)
        src_cx = _col_cx(src_col)
        src_cy = _lane_cy(actor_idx[src_lid])
        tgt_cx = _col_cx(tgt_col)
        tgt_cy = _lane_cy(actor_idx[tgt_lid])
        src_w, _ = _elem_size(src)
        tgt_w, _ = _elem_size(tgt)

        edge = ET.SubElement(plane, _bdi("BPMNEdge"))
        edge.set("id", f"{sf.id}_di")
        edge.set("bpmnElement", sf.id)

        # Waypoints: right edge of source → left edge of target
        _add_waypoint(edge, src_cx + src_w // 2, src_cy)
        _add_waypoint(edge, tgt_cx - tgt_w // 2, tgt_cy)

        # Edge label for condition
        if sf.condition_label:
            mid_x = (src_cx + tgt_cx) // 2
            mid_y = min(src_cy, tgt_cy) - 18
            lbl = ET.SubElement(edge, _bdi("BPMNLabel"))
            lb = ET.SubElement(lbl, _dc("Bounds"))
            lb.set("x", str(mid_x - 25))
            lb.set("y", str(mid_y))
            lb.set("width", "50")
            lb.set("height", "14")

    xml_str = ET.tostring(root, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_str}'


# ---------------------------------------------------------------------------
# XML helpers
# ---------------------------------------------------------------------------

def _add_shape(
    parent: ET.Element,
    shape_id: str,
    bpmn_element: str,
    x: int,
    y: int,
    width: int,
    height: int,
    horizontal: bool = False,
) -> ET.Element:
    shape = ET.SubElement(parent, _bdi("BPMNShape"))
    shape.set("id", shape_id)
    shape.set("bpmnElement", bpmn_element)
    if horizontal:
        shape.set("isHorizontal", "true")
    bounds = ET.SubElement(shape, _dc("Bounds"))
    bounds.set("x", str(x))
    bounds.set("y", str(y))
    bounds.set("width", str(width))
    bounds.set("height", str(height))
    return shape


def _add_waypoint(parent: ET.Element, x: int, y: int) -> None:
    wp = ET.SubElement(parent, _di("waypoint"))
    wp.set("x", str(x))
    wp.set("y", str(y))
