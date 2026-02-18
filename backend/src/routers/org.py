"""Org chart CRUD API — backed by JSON files in backend/data/org/."""

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.auth import get_current_user
from src.config import DATA_DIR

router = APIRouter()

ORG_DIR: Path = DATA_DIR / "org"

ROLE_LEVELS: dict[str, list[str]] = {
    "admin":   ["public", "manager", "admin"],
    "manager": ["public", "manager"],
    "viewer":  ["public"],
}

VALID_TYPES = {"org_chart", "business_process", "workflow"}


# ---------------------------------------------------------------------------
# File helpers
# ---------------------------------------------------------------------------

def _diagram_path(diagram_type: str) -> Path:
    if diagram_type not in VALID_TYPES:
        raise HTTPException(status_code=404, detail=f"Unknown diagram type: {diagram_type}")
    return ORG_DIR / f"{diagram_type}.json"


def _read_diagram(diagram_type: str) -> dict:
    path = _diagram_path(diagram_type)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Diagram '{diagram_type}' not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_diagram(diagram_type: str, data: dict) -> None:
    path = _diagram_path(diagram_type)
    ORG_DIR.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _build_flow_response(diagram: dict, role: str) -> dict:
    """Return permission-filtered flow data for the frontend canvas."""
    allowed = ROLE_LEVELS.get(role, ["public"])
    flow_nodes = []
    for node in diagram["nodes"]:
        restricted = node["permission_level"] not in allowed
        flow_nodes.append({
            "id": node["id"],
            "type": "restrictedNode" if restricted else "orgNode",
            "data": {
                "id": node["id"],
                "label": "Restricted" if restricted else node["label"],
                "description": None if restricted else node.get("description"),
                "node_type": node["node_type"],
                "permission_level": node["permission_level"],
                "is_restricted": restricted,
            },
        })
    visible_ids = {n["id"] for n in diagram["nodes"]}
    flow_edges = [
        {
            "id": e["id"],
            "source": e["source_id"],
            "target": e["target_id"],
            "label": e.get("label", ""),
        }
        for e in diagram["edges"]
        if e["source_id"] in visible_ids and e["target_id"] in visible_ids
    ]
    return {
        "diagram_type": diagram["diagram_type"],
        "nodes": flow_nodes,
        "edges": flow_edges,
    }


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class NodeCreate(BaseModel):
    label: str
    description: str = ""
    node_type: str = "department"
    parent_id: str | None = None
    permission_level: str = "public"


class NodeUpdate(BaseModel):
    label: str | None = None
    description: str | None = None
    node_type: str | None = None
    parent_id: str | None = None
    permission_level: str | None = None


class EdgeCreate(BaseModel):
    source_id: str
    target_id: str
    label: str = ""
    edge_type: str = "hierarchy"


# ---------------------------------------------------------------------------
# Read endpoints (all authenticated roles)
# ---------------------------------------------------------------------------

@router.get("/diagram/{diagram_type}")
async def get_diagram(
    diagram_type: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """Return permission-filtered flow data."""
    diagram = _read_diagram(diagram_type)
    return _build_flow_response(diagram, user["role"])


@router.get("/nodes/{diagram_type}")
async def list_nodes(
    diagram_type: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """Return raw nodes + edges (admin only)."""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    diagram = _read_diagram(diagram_type)
    return {"nodes": diagram["nodes"], "edges": diagram["edges"]}


# ---------------------------------------------------------------------------
# Node CRUD (admin only)
# ---------------------------------------------------------------------------

@router.post("/nodes/{diagram_type}", status_code=201)
async def create_node(
    diagram_type: str,
    body: NodeCreate,
    user: dict = Depends(get_current_user),
) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    diagram = _read_diagram(diagram_type)
    new_node = {
        "id": str(uuid.uuid4()),
        "label": body.label,
        "description": body.description,
        "node_type": body.node_type,
        "parent_id": body.parent_id,
        "permission_level": body.permission_level,
    }
    diagram["nodes"].append(new_node)
    _write_diagram(diagram_type, diagram)
    return new_node


@router.patch("/nodes/{diagram_type}/{node_id}")
async def update_node(
    diagram_type: str,
    node_id: str,
    body: NodeUpdate,
    user: dict = Depends(get_current_user),
) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    diagram = _read_diagram(diagram_type)
    for node in diagram["nodes"]:
        if node["id"] == node_id:
            if body.label is not None:
                node["label"] = body.label
            if body.description is not None:
                node["description"] = body.description
            if body.node_type is not None:
                node["node_type"] = body.node_type
            if body.parent_id is not None:
                node["parent_id"] = body.parent_id
            if body.permission_level is not None:
                node["permission_level"] = body.permission_level
            _write_diagram(diagram_type, diagram)
            return node
    raise HTTPException(status_code=404, detail="Node not found")


@router.delete("/nodes/{diagram_type}/{node_id}", status_code=204)
async def delete_node(
    diagram_type: str,
    node_id: str,
    user: dict = Depends(get_current_user),
) -> None:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    diagram = _read_diagram(diagram_type)
    diagram["nodes"] = [n for n in diagram["nodes"] if n["id"] != node_id]
    # Remove edges referencing this node
    diagram["edges"] = [
        e for e in diagram["edges"]
        if e["source_id"] != node_id and e["target_id"] != node_id
    ]
    _write_diagram(diagram_type, diagram)


# ---------------------------------------------------------------------------
# Edge CRUD (admin only)
# ---------------------------------------------------------------------------

@router.post("/edges/{diagram_type}", status_code=201)
async def create_edge(
    diagram_type: str,
    body: EdgeCreate,
    user: dict = Depends(get_current_user),
) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    diagram = _read_diagram(diagram_type)
    new_edge = {
        "id": str(uuid.uuid4()),
        "source_id": body.source_id,
        "target_id": body.target_id,
        "label": body.label,
        "edge_type": body.edge_type,
    }
    diagram["edges"].append(new_edge)
    _write_diagram(diagram_type, diagram)
    return new_edge


@router.delete("/edges/{diagram_type}/{edge_id}", status_code=204)
async def delete_edge(
    diagram_type: str,
    edge_id: str,
    user: dict = Depends(get_current_user),
) -> None:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    diagram = _read_diagram(diagram_type)
    diagram["edges"] = [e for e in diagram["edges"] if e["id"] != edge_id]
    _write_diagram(diagram_type, diagram)
