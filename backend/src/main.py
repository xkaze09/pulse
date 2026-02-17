"""FastAPI backend for the Pulse documentation & visualization agent.

Provides a streaming SSE endpoint for chat interactions with the LangGraph agent.

Usage:
    cd backend
    uvicorn src.main:app --reload --port 8000
"""

import src.compat  # noqa: F401 — must be first to patch pydantic v1 for Python 3.14+

import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from src.agent import agent
from src.config import FRONTEND_URL

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Pulse API",
    description="Enterprise Documentation & Visualization Agent",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:3000",
        "http://192.168.1.2:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Incoming chat request."""

    message: str
    history: list[dict] = []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}



@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Process a chat message through the Pulse agent and stream the response via SSE."""

    async def event_generator():
        try:
            # Invoke the LangGraph agent
            result = await _run_agent(request.message, request.history)

            # Stream intent event
            yield {
                "event": "intent",
                "data": json.dumps({"intent": result.get("intent", "retrieve_info")}),
            }

            # Stream the answer event
            yield {
                "event": "answer",
                "data": json.dumps({
                    "text": result.get("answer", ""),
                    "diagram_code": result.get("diagram_code", ""),
                    "sources": result.get("sources", []),
                }),
            }

            # Signal completion
            yield {
                "event": "done",
                "data": json.dumps({"status": "complete"}),
            }

        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}),
            }

    return EventSourceResponse(event_generator())


async def _run_agent(message: str, history: list[dict]) -> dict:
    """Run the LangGraph agent with the given input."""
    initial_state = {
        "input": message,
        "chat_history": history,
        "intent": "",
        "context": [],
        "answer": "",
        "sources": [],
        "diagram_code": "",
    }

    # LangGraph invoke (runs synchronously internally, but we wrap for async compat)
    import asyncio
    result = await asyncio.to_thread(agent.invoke, initial_state)
    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    from src.config import HOST, PORT

    uvicorn.run("src.main:app", host=HOST, port=PORT, reload=True)
