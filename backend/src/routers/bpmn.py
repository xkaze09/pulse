"""BPMN parse and template endpoints.

POST /api/bpmn/parse   — text → BPMN 2.0 XML (manager/admin only)
GET  /api/bpmn/templates — list sample process flows from data/templates/
"""

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.auth import get_current_user
from src.bpmn.generator import generate_bpmn_xml
from src.bpmn.parser import parse_process_text
from src.config import DATA_DIR

logger = logging.getLogger(__name__)
router = APIRouter()

TEMPLATES_DIR: Path = DATA_DIR / "templates"


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ParseRequest(BaseModel):
    text: str = Field(
        min_length=10,
        max_length=5000,
        description="Plain-text process flow description to parse into BPMN",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/parse")
async def parse_process(
    body: ParseRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    """Parse plain-text process flow into BPMN 2.0 XML.

    Requires manager or admin role. Viewers may only view pre-existing diagrams.
    """
    if user["role"] == "viewer":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    process_flow = parse_process_text(body.text)
    bpmn_xml = generate_bpmn_xml(process_flow)

    logger.info(
        "BPMN parse complete: process=%r actors=%d activities=%d gateways=%d flows=%d",
        process_flow.name,
        len(process_flow.actors),
        len(process_flow.activities),
        len(process_flow.gateways),
        len(process_flow.sequence_flows),
    )

    return {
        "bpmn_xml": bpmn_xml,
        "process_json": process_flow.model_dump(),
    }


@router.get("/templates")
async def list_templates(
    user: dict = Depends(get_current_user),
) -> list[dict]:
    """Return available process flow template texts from data/templates/."""
    templates: list[dict] = []
    if TEMPLATES_DIR.exists():
        for path in sorted(TEMPLATES_DIR.glob("*.txt")):
            name = path.stem.replace("_", " ").title()
            try:
                templates.append({
                    "name": name,
                    "text": path.read_text(encoding="utf-8"),
                })
            except OSError as exc:
                logger.warning("Could not read template %s: %s", path.name, exc)
    return templates
