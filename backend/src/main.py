"""FastAPI backend for the Pulse documentation & visualization agent.

Provides a streaming SSE endpoint for chat interactions with the LangGraph agent,
plus auth and org-chart API routes.

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
from src.auth import USERS, create_session
from src.config import FRONTEND_URL
from src.routers import admin as admin_router
from src.routers import org as org_router

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

# Mount routers
app.include_router(org_router.router, prefix="/api/org")
app.include_router(admin_router.router, prefix="/api/admin")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Incoming chat request."""

    message: str
    history: list[dict] = []


class LoginRequest(BaseModel):
    username: str
    password: str


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.post("/api/auth/login")
async def login(body: LoginRequest) -> dict:
    """Validate credentials and return a session token."""
    user = USERS.get(body.username)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_session(body.username, user["role"])
    return {
        "token": token,
        "username": body.username,
        "role": user["role"],
        "name": user["name"],
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Chat endpoint
# ---------------------------------------------------------------------------

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Process a chat message through the Pulse agent and stream the response via SSE."""

    async def event_generator():
        try:
            result = await _run_agent(request.message, request.history)

            yield {
                "event": "intent",
                "data": json.dumps({"intent": result.get("intent", "retrieve_info")}),
            }

            yield {
                "event": "answer",
                "data": json.dumps({
                    "text": result.get("answer", ""),
                    "diagram_code": result.get("diagram_code", ""),
                    "sources": result.get("sources", []),
                }),
            }

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
