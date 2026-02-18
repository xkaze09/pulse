"""Admin API — document management, ingestion trigger, and README viewer.

All endpoints require admin role.
"""

import asyncio
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from src.auth import get_current_user
from src.config import DATA_DIR, DOCUMENTS_DIR

router = APIRouter()

# README.md is at the repo root (two levels up from backend/src/)
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_README_PATH = _BACKEND_DIR.parent / "readme.md"
# Fallback: check backend dir itself
if not _README_PATH.exists():
    _README_PATH = _BACKEND_DIR / "README.md"


def _require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ---------------------------------------------------------------------------
# README
# ---------------------------------------------------------------------------

@router.get("/readme", response_class=PlainTextResponse)
async def get_readme(_user: dict = Depends(_require_admin)) -> str:
    """Return the project README.md as plain text."""
    if not _README_PATH.exists():
        raise HTTPException(status_code=404, detail="README.md not found")
    return _README_PATH.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Document listing
# ---------------------------------------------------------------------------

@router.get("/documents")
async def list_documents(_user: dict = Depends(_require_admin)) -> dict:
    """List all files in the documents directory."""
    supported = {".pdf", ".xlsx", ".xls", ".md"}
    files = []
    if DOCUMENTS_DIR.exists():
        for f in sorted(DOCUMENTS_DIR.iterdir()):
            if f.is_file() and f.suffix.lower() in supported:
                stat = f.stat()
                files.append({
                    "name": f.name,
                    "size_kb": round(stat.st_size / 1024, 1),
                    "extension": f.suffix.lower(),
                    "last_modified": datetime.fromtimestamp(
                        stat.st_mtime, tz=timezone.utc
                    ).strftime("%Y-%m-%d %H:%M UTC"),
                })
    return {"documents": files, "count": len(files)}


# ---------------------------------------------------------------------------
# Ingest trigger
# ---------------------------------------------------------------------------

@router.post("/ingest")
async def trigger_ingest(_user: dict = Depends(_require_admin)) -> dict:
    """Re-run the full document ingestion pipeline (admin only).

    Runs synchronously in a thread pool so the event loop is not blocked.
    Returns a summary of the result.
    """
    def _run_ingest() -> dict:
        # Import here to avoid circular imports and to ensure fresh state
        from src.ingest import chunk_documents, create_vector_store, load_documents, load_url_map
        from src.config import URL_MAP_PATH

        url_map = load_url_map(URL_MAP_PATH)
        documents = load_documents(DOCUMENTS_DIR, url_map)
        if not documents:
            return {"status": "ok", "documents": 0, "chunks": 0, "message": "No documents found to ingest."}
        chunks = chunk_documents(documents)
        create_vector_store(chunks)
        return {
            "status": "ok",
            "documents": len(documents),
            "chunks": len(chunks),
            "message": f"Ingested {len(documents)} document(s) into {len(chunks)} chunks.",
        }

    try:
        result = await asyncio.to_thread(_run_ingest)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}") from e
