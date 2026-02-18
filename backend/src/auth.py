"""In-memory session auth for Pulse (mock auth — no external packages)."""

import secrets
import time

from fastapi import Header, HTTPException

USERS: dict[str, dict] = {
    "admin":   {"password": "admin123",   "role": "admin",   "name": "Admin User"},
    "manager": {"password": "manager123", "role": "manager", "name": "Manager User"},
    "viewer":  {"password": "viewer123",  "role": "viewer",  "name": "Viewer User"},
}

_sessions: dict[str, dict] = {}  # resets on server restart — fine for mock auth


def create_session(username: str, role: str) -> str:
    token = secrets.token_hex(32)
    _sessions[token] = {"username": username, "role": role, "t": time.time()}
    return token


def get_session(token: str) -> dict | None:
    s = _sessions.get(token)
    if not s or time.time() - s["t"] > 28800:  # 8-hour expiry
        _sessions.pop(token, None)
        return None
    return s


async def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency — validates Bearer token and returns session dict."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = get_session(authorization[7:])
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return session
