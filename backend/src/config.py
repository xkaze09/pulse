"""Configuration loader for the Pulse backend."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")

# Groq
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

# ChromaDB
CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", str(_backend_dir / "chroma_store"))
COLLECTION_NAME: str = os.getenv("COLLECTION_NAME", "doc-agent-index")

# LLM (embeddings use local all-MiniLM-L6-v2, no API key needed)
LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
ROUTER_MODEL: str = os.getenv("ROUTER_MODEL", "llama-3.1-8b-instant")

# Server
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Auth
SESSION_SECRET: str = os.getenv("SESSION_SECRET", "dev-only-change-in-prod")

# Paths
DATA_DIR: Path = _backend_dir / "data"
DOCUMENTS_DIR: Path = DATA_DIR / "documents"
ORG_DIR: Path = DATA_DIR / "org"
URL_MAP_PATH: Path = DATA_DIR / "url_map.json"
