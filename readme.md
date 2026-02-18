# Pulse — Org Visualization Platform

An enterprise platform for exploring org charts, business processes, and workflows with role-based access control. Includes an AI-powered documentation assistant (RAG chat) that answers questions from your uploaded documents and org data.

## Features

- **Interactive org canvas** — Mermaid.js diagrams for org charts, business processes, and workflows. Click any node to view details.
- **Role-gated access** — Admin, Manager, and Viewer tiers. Restricted nodes appear blurred for lower-privilege roles.
- **AI chat widget** — Floating assistant answers questions from ingested PDFs, Excel files, Markdown, and org JSON data.
- **Admin panel** — Add, edit, and delete nodes and edges for any diagram type directly in the UI.
- **Free-tier LLM** — Powered by Groq (Llama 3.3 70B). No OpenAI key required. Embeddings run locally via ChromaDB's bundled ONNX model (~80 MB, downloaded once).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐  │
│  │  Login   │  │  Org Canvas  │  │  Admin    │  │   Chat    │  │
│  │  Page    │  │  (Mermaid)   │  │  Panel    │  │  Widget   │  │
│  └──────────┘  └──────────────┘  └───────────┘  └───────────┘  │
│                        │ REST / SSE                              │
└────────────────────────┼────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI)                          │
│                                                                  │
│  POST /api/auth/login          — session token                   │
│  GET  /api/org/diagram/{type}  — permission-filtered diagram     │
│  CRUD /api/org/nodes/{type}    — admin node management           │
│  CRUD /api/org/edges/{type}    — admin edge management           │
│  POST /api/chat (SSE)          — LangGraph RAG agent             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   LangGraph Agent                         │   │
│  │   Router (llama-3.1-8b) → Retriever / Visualizer         │   │
│  │                     (llama-3.3-70b)                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                    ┌─────┴──────┐                                │
│                    │  ChromaDB  │  ← PDFs, Excel, Markdown,      │
│                    │  (local)   │     org JSON files             │
│                    └────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer         | Technology                                              |
|---------------|---------------------------------------------------------|
| LLM           | Groq — `llama-3.3-70b-versatile` (answers & diagrams), `llama-3.1-8b-instant` (routing) |
| Embeddings    | ChromaDB bundled ONNX model (all-MiniLM-L6-v2, local, no API key) |
| Orchestration | LangChain + LangGraph                                   |
| Vector DB     | ChromaDB (local persistence)                            |
| Backend       | Python / FastAPI / SSE                                  |
| Frontend      | Next.js 15 (App Router) + Tailwind CSS                  |
| Visualization | Mermaid.js                                              |

---

## Project Structure

```
pulse/
├── backend/
│   ├── pyproject.toml
│   ├── .env.example
│   ├── src/
│   │   ├── main.py          # FastAPI app — auth, org, and chat endpoints
│   │   ├── agent.py         # LangGraph state machine (Router → Retriever/Visualizer)
│   │   ├── auth.py          # Session-based auth, hardcoded users
│   │   ├── ingest.py        # Document ingestion pipeline (PDF, Excel, Markdown, JSON)
│   │   ├── config.py        # Env var loader
│   │   ├── prompts.py       # LLM system prompts
│   │   ├── embeddings.py    # Local embedding wrapper
│   │   └── routers/
│   │       ├── org.py       # Org diagram CRUD endpoints
│   │       └── admin.py     # Admin ingestion trigger endpoint
│   ├── data/
│   │   ├── documents/       # Drop PDFs / Excel / Markdown here for ingestion
│   │   ├── org/             # Org chart, business process, workflow JSON files
│   │   └── url_map.json     # filename → public URL mapping for source citations
│   └── tests/
│       └── test_smoke.py    # Integration smoke tests (20 tests)
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/         # Login page
│       │   └── (platform)/           # Auth-guarded shell
│       │       ├── layout.tsx        # Sidebar + Navbar + ChatWidget
│       │       ├── dashboard/        # Role-aware landing page
│       │       ├── org/              # Org chart canvas
│       │       ├── processes/        # Business process canvas
│       │       ├── workflows/        # Workflow canvas
│       │       └── admin/            # Admin-only node/edge management
│       ├── components/
│       │   ├── canvas/               # OrgCanvas, NodeDetailPanel
│       │   ├── chat/                 # ChatWidget (floating)
│       │   ├── layout/               # Sidebar, Navbar
│       │   ├── admin/                # AdminPanel, NodeFormModal, EdgeFormModal
│       │   └── dashboard/            # DashboardView
│       ├── context/AuthContext.tsx   # Auth state (React Context)
│       ├── lib/
│       │   ├── api.ts                # Authenticated fetch wrapper + org API calls
│       │   └── auth.ts               # Login, localStorage token helpers
│       └── types/org.ts             # Shared TypeScript types
├── .gitignore
└── README.md
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ and pnpm
- A free [Groq API key](https://console.groq.com)

### 1. Clone & Configure

```bash
git clone https://github.com/xkaze09/pulse.git
cd pulse

# Backend
cp backend/.env.example backend/.env
# Open backend/.env and set GROQ_API_KEY

# Frontend
# Create frontend/.env.local if you need a non-default API URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > frontend/.env.local
```

### 2. Setup Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -e .

# Ingest documents into ChromaDB
# (This also indexes org JSON files from data/org/)
python -m src.ingest

# Start the API server
uvicorn src.main:app --reload --port 8000
```

### 3. Setup Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

### 4. Open the App

Go to **http://localhost:3000** and log in with one of the demo accounts:

| Username  | Password     | Role    | Access                              |
|-----------|--------------|---------|-------------------------------------|
| `admin`   | `admin123`   | Admin   | All nodes + admin panel             |
| `manager` | `manager123` | Manager | Public + manager nodes              |
| `viewer`  | `viewer123`  | Viewer  | Public nodes only (others blurred)  |

---

## Adding Documents

1. Drop PDF, Excel (`.xlsx`), or Markdown (`.md`) files into `backend/data/documents/`
2. Optionally add URL mappings to `backend/data/url_map.json`:
   ```json
   { "my-policy.pdf": "https://company.com/docs/my-policy" }
   ```
3. Re-run ingestion:
   ```bash
   cd backend && python -m src.ingest
   ```

The chat widget will immediately answer questions from the new documents.

---

## Editing Org Data

Org charts, business processes, and workflows are stored as JSON in `backend/data/org/`:

- `org_chart.json`
- `business_process.json`
- `workflow.json`

Each file has `nodes` and `edges`. Nodes have a `permission_level` field:

| `permission_level` | Visible to        |
|--------------------|-------------------|
| `"public"`         | All roles         |
| `"manager"`        | Manager + Admin   |
| `"admin"`          | Admin only        |

You can edit the JSON files directly, or use the **Admin Panel** in the UI (`/admin` — admin role required) to add, edit, and delete nodes and edges without touching the files.

After editing org JSON files, re-run ingestion so the chat assistant reflects the changes.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable             | Description                              | Default                  |
|----------------------|------------------------------------------|--------------------------|
| `GROQ_API_KEY`       | Your Groq API key                        | *(required)*             |
| `CHROMA_PERSIST_DIR` | ChromaDB storage directory               | `./chroma_store`         |
| `COLLECTION_NAME`    | Vector store collection name             | `doc-agent-index`        |
| `LLM_MODEL`          | Groq model for answers and diagrams      | `llama-3.3-70b-versatile`|
| `ROUTER_MODEL`       | Groq model for intent classification     | `llama-3.1-8b-instant`   |
| `HOST`               | Server host                              | `0.0.0.0`                |
| `PORT`               | Server port                              | `8000`                   |
| `FRONTEND_URL`       | Frontend URL (CORS allowlist)            | `http://localhost:3000`  |
| `SESSION_SECRET`     | Secret for session tokens                | `dev-only-change-in-prod`|

### Frontend (`frontend/.env.local`)

| Variable              | Description      | Default                 |
|-----------------------|------------------|-------------------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL  | `http://localhost:8000` |

---

## API Reference

### Auth

#### `POST /api/auth/login`
```json
{ "username": "admin", "password": "admin123" }
```
Returns: `{ "token": "...", "username": "admin", "role": "admin", "name": "Admin User" }`

Pass the token as `Authorization: Bearer <token>` on all subsequent requests.

---

### Org Diagrams

#### `GET /api/org/diagram/{type}`
Returns a permission-filtered diagram for `org_chart`, `business_process`, or `workflow`.

```json
{
  "diagram_type": "org_chart",
  "nodes": [
    {
      "id": "ceo-001",
      "type": "orgNode",
      "data": {
        "label": "CEO",
        "description": "Chief Executive Officer",
        "node_type": "person",
        "permission_level": "public",
        "is_restricted": false
      }
    }
  ],
  "edges": [{ "id": "e1", "source": "ceo-001", "target": "cto-001" }]
}
```

Nodes the caller's role cannot see are returned with `"label": "Restricted"` and `"is_restricted": true` rather than being omitted entirely (so the canvas can render them blurred).

#### Admin-only node/edge CRUD

| Method   | Path                          | Description         |
|----------|-------------------------------|---------------------|
| `GET`    | `/api/org/nodes/{type}`       | List all raw nodes  |
| `POST`   | `/api/org/nodes/{type}`       | Create a node       |
| `PATCH`  | `/api/org/nodes/{type}/{id}`  | Update a node       |
| `DELETE` | `/api/org/nodes/{type}/{id}`  | Delete a node       |
| `POST`   | `/api/org/edges/{type}`       | Create an edge      |
| `DELETE` | `/api/org/edges/{type}/{id}`  | Delete an edge      |

---

### Chat

#### `POST /api/chat`
Streams Server-Sent Events.

**Request:**
```json
{ "message": "How does the customer place an order?", "history": [] }
```

**SSE Events:**

| Event    | Data                                                         |
|----------|--------------------------------------------------------------|
| `intent` | `{ "intent": "retrieve_info" \| "generate_diagram" }`       |
| `answer` | `{ "text": "...", "diagram_code": "...", "sources": [...] }` |
| `done`   | `{ "status": "complete" }`                                   |
| `error`  | `{ "error": "..." }`                                         |

---

## Running Tests

```bash
cd backend
pip install pytest httpx
python -m pytest tests/test_smoke.py -v
```

Runs 20 integration tests covering auth, permission filtering, and the RAG chat pipeline. The backend must be running on port 8000.

---

## License

MIT
