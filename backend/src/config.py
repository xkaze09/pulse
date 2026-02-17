"""Configuration loader for the Pulse backend."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")

# OpenAI
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

# ChromaDB
CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", str(_backend_dir / "chroma_store"))
COLLECTION_NAME: str = os.getenv("COLLECTION_NAME", "doc-agent-index")

# Embedding
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

# LLM
LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o")
ROUTER_MODEL: str = os.getenv("ROUTER_MODEL", "gpt-4o-mini")

# Server
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Paths
DATA_DIR: Path = _backend_dir / "data"
DOCUMENTS_DIR: Path = DATA_DIR / "documents"
URL_MAP_PATH: Path = DATA_DIR / "url_map.json"
