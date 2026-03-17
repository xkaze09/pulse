"""LLM-based parser: plain text → structured ProcessFlow.

Uses Groq llama-3.3-70b with JSON mode to extract BPMN elements.
Falls back to one retry with a correction prompt on parse/validation failure.
"""

import json
import logging

from fastapi import HTTPException
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from pydantic import ValidationError

from src.bpmn.models import ProcessFlow
from src.config import GROQ_API_KEY, LLM_MODEL

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

PARSER_SYSTEM_PROMPT = """\
You are a BPMN process analysis expert. Extract a structured process representation from the user's text.

OUTPUT RULES:
- Return ONLY a valid JSON object. No markdown fences, no explanation, no commentary.
- The JSON must match this exact schema:

{
  "name": "short process name",
  "description": "one-sentence description",
  "actors": [
    {"id": "actor_1", "name": "Actor Name", "description": "role description"}
  ],
  "events": [
    {
      "id": "evt_start",
      "name": "Event Name",
      "event_type": "start",
      "lane_id": "actor_id_this_event_belongs_to"
    }
  ],
  "activities": [
    {
      "id": "act_1",
      "name": "Activity Name",
      "activity_type": "userTask",
      "lane_id": "actor_id",
      "description": "what happens"
    }
  ],
  "gateways": [
    {
      "id": "gw_1",
      "name": "Decision Question?",
      "gateway_type": "exclusive",
      "lane_id": "actor_id"
    }
  ],
  "sequence_flows": [
    {
      "id": "sf_1",
      "source_id": "element_id",
      "target_id": "element_id",
      "condition_label": "Yes / No / condition text or null"
    }
  ]
}

BPMN MAPPING RULES:
1. Each distinct actor/role/department becomes one actor entry (swimlane).
   Every element (event, activity, gateway) MUST have a lane_id matching an actor id.
2. Include exactly ONE start event (event_type: "start") and at least ONE end event (event_type: "end").
3. "If / whether / decide / approve / check" language → exclusive gateway (gateway_type: "exclusive").
4. Parallel/simultaneous actions → parallel gateway (gateway_type: "parallel").
5. Human tasks → userTask. Automated/system actions (CRM updates, SMS notifications) → serviceTask. Physical tasks → manualTask.
6. Every element EXCEPT start events MUST have at least one incoming sequence flow.
7. Every element EXCEPT end events MUST have at least one outgoing sequence flow.
8. Sequence flows leaving gateways MUST have a condition_label (e.g., "Yes", "No", "Approved", "Escalate").
9. IDs must be globally unique. Use prefixes: actor_, evt_, act_, gw_, sf_.
10. Loop-back paths (e.g. case reopened → return to earlier step) are valid — add sequence flows back to the earlier element.

IMPORTANT: Return ONLY the JSON object. No text before or after it.\
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_process_text(text: str) -> ProcessFlow:
    """Parse plain-text process description into a validated ProcessFlow.

    Calls Groq with JSON mode. On parse/validation failure, retries once
    with the bad response shown back to the model. Raises HTTPException on
    repeated failure or service unavailability.
    """
    llm = ChatGroq(
        model=LLM_MODEL,
        temperature=0,
        groq_api_key=GROQ_API_KEY,
        model_kwargs={"response_format": {"type": "json_object"}},
    )

    messages = [
        SystemMessage(content=PARSER_SYSTEM_PROMPT),
        HumanMessage(content=f"Process description:\n\n{text}"),
    ]

    # Attempt 1
    try:
        response = llm.invoke(messages)
    except Exception as exc:
        logger.error("Groq API error during BPMN parse: %s", exc)
        raise HTTPException(status_code=503, detail="Parse service temporarily unavailable")

    raw = response.content.strip()

    try:
        data = json.loads(raw)
        return ProcessFlow.model_validate(data)
    except (json.JSONDecodeError, ValidationError) as first_err:
        logger.warning("First parse attempt failed (%s) — retrying", type(first_err).__name__)

    # Attempt 2: show the bad response back and ask for a fix
    retry_messages = messages + [
        AIMessage(content=raw),
        HumanMessage(
            content=(
                "Your response could not be validated against the required schema. "
                f"Error: {str(first_err)[:300]}. "
                "Please return ONLY the corrected JSON object — no markdown, no code fences, no explanation."
            )
        ),
    ]

    try:
        retry_response = llm.invoke(retry_messages)
        data = json.loads(retry_response.content.strip())
        return ProcessFlow.model_validate(data)
    except Exception as exc:
        logger.error("Retry parse attempt also failed: %s", exc)
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not parse process flow into a valid BPMN structure. "
                "Try providing a more detailed description with clear actors, "
                "sequential steps, and explicit decision points."
            ),
        )
