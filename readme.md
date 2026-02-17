# Pulse — Enterprise Documentation & Visualization Agent

A RAG-based AI agent that helps employees find documentation links quickly and generates structural visualizations (org charts, process flows) on the fly from document content.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│  ┌────────────┐  ┌───────────────┐  ┌────────────────────────┐  │
│  │ Chat Input  │→│ MessageBubble │→│ MermaidRenderer / Sources│  │
│  └────────────┘  └───────────────┘  └────────────────────────┘  │
│                          │ SSE                                  │
└──────────────────────────┼──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                           │
│                   POST /api/chat (SSE)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  LangGraph Agent                          │   │
│  │                                                           │   │
│  │   ┌────────┐    ┌────────────┐    ┌──────────────┐       │   │
│  │   │ Router │───→│ Retriever  │───→│ Text Answer  │       │   │
│  │   │(GPT-4o │    │  (RAG, k=5)│    │ + Sources    │       │   │
│  │   │ -mini) │    └────────────┘    └──────────────┘       │   │
│  │   │        │                                              │   │
│  │   │        │    ┌────────────┐    ┌──────────────┐       │   │
│  │   │        │───→│ Visualizer │───→│ Mermaid Code │       │   │
│  │   │        │    │ (RAG, k=10)│    │ + Sources    │       │   │
│  │   └────────┘    └────────────┘    └──────────────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                    ┌─────┴─────┐                                 │
│                    │ ChromaDB  │                                  │
│                    │ (Vectors) │                                  │
│                    └───────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer          | Technology                                      |
| -------------- | ----------------------------------------------- |
| LLM            | OpenAI GPT-4o (answers & diagrams), GPT-4o-mini (routing) |
| Orchestration  | LangChain + LangGraph (Python)                  |
| Vector DB      | ChromaDB (local, swappable to Pinecone)         |
| Embeddings     | OpenAI `text-embedding-3-small` (1536 dims)     |
| Backend        | Python / FastAPI / SSE                           |
| Frontend       | Next.js 15 (App Router) + Tailwind CSS          |
| Visualization  | Mermaid.js + react-markdown                       |

## Project Structure

```
pulse/
├── backend/
│   ├── pyproject.toml          # Python dependencies (Poetry/pip)
│   ├── .env.example            # Environment variables template
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI app & /api/chat endpoint
│   │   ├── agent.py            # LangGraph workflow (Router → Retriever/Visualizer)
│   │   ├── ingest.py           # Document ingestion pipeline
│   │   ├── config.py           # Configuration loader
│   │   ├── prompts.py          # System prompts
│   │   └── create_dummy_pdf.py # Dummy PDF generator for demo
│   └── data/
│       ├── documents/          # Source PDFs (drop files here)
│       └── url_map.json        # filename → public URL mapping
├── frontend/
│   ├── package.json            # Node.js dependencies (pnpm)
│   ├── .env.local.example      # Frontend env template
│   └── src/
│       ├── app/
│       │   ├── layout.tsx      # Root layout
│       │   ├── page.tsx        # Main page with header + chat
│       │   └── globals.css     # Global styles
│       ├── components/
│       │   ├── ChatInterface.tsx    # Chat state & input management
│       │   ├── MessageBubble.tsx    # Message rendering (markdown + diagrams)
│       │   ├── MermaidRenderer.tsx  # Mermaid.js → SVG renderer
│       │   └── SourceList.tsx       # Clickable source badges
│       └── lib/
│           └── chatApi.ts      # SSE client helper
├── docs/
│   └── USAGE.md                # Detailed usage guide
├── .gitignore
└── README.md                   # This file
```

## Quick Start

### Prerequisites

- **Python** 3.11+
- **Node.js** 18+ and **pnpm**
- **OpenAI API key** with access to GPT-4o

### 1. Clone & Configure

```bash
git clone <repo-url>
cd pulse

# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY

# Frontend environment
cp frontend/.env.local.example frontend/.env.local
```

### 2. Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Activate (macOS/Linux)
# source .venv/bin/activate

# Install dependencies
pip install -e .

# Run document ingestion (creates ChromaDB vector store)
python -m src.ingest

# Start the API server
uvicorn src.main:app --reload --port 8000
```

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### 4. Use the App

Open **http://localhost:3000** in your browser.

Try these example queries:
- `"What is the HR leave policy?"` — returns a text answer with source links
- `"Visualize the checkout process"` — returns a rendered flowchart
- `"Show the engineering org chart"` — returns a hierarchy diagram

## Environment Variables

### Backend (`backend/.env`)

| Variable           | Description                          | Default                   |
| ------------------ | ------------------------------------ | ------------------------- |
| `OPENAI_API_KEY`   | Your OpenAI API key                  | *(required)*              |
| `CHROMA_PERSIST_DIR` | ChromaDB storage directory         | `./chroma_store`          |
| `COLLECTION_NAME`  | Vector store collection name         | `doc-agent-index`         |
| `EMBEDDING_MODEL`  | OpenAI embedding model               | `text-embedding-3-small`  |
| `LLM_MODEL`        | Main LLM for answers & diagrams      | `gpt-4o`                  |
| `ROUTER_MODEL`     | LLM for intent classification        | `gpt-4o-mini`             |
| `HOST`             | Server host                          | `0.0.0.0`                 |
| `PORT`             | Server port                          | `8000`                    |
| `FRONTEND_URL`     | Frontend URL (for CORS)              | `http://localhost:3000`   |

### Frontend (`frontend/.env.local`)

| Variable               | Description             | Default                  |
| ---------------------- | ----------------------- | ------------------------ |
| `NEXT_PUBLIC_API_URL`  | Backend API URL          | `http://localhost:8000`  |

## API Reference

### `GET /health`

Health check endpoint.

**Response:** `{ "status": "ok" }`

### `POST /api/chat`

Send a message to the agent. Returns Server-Sent Events (SSE).

**Request Body:**
```json
{
  "message": "What is the deployment process?",
  "history": []
}
```

**SSE Events:**

| Event    | Data                                                                 |
| -------- | -------------------------------------------------------------------- |
| `intent` | `{ "intent": "retrieve_info" \| "generate_diagram" }`               |
| `answer` | `{ "text": "...", "diagram_code": "...", "sources": [...] }`         |
| `done`   | `{ "status": "complete" }`                                           |
| `error`  | `{ "error": "..." }`                                                 |

## License

MIT