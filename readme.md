# Pulse — Org Visualization Platform

An enterprise platform for exploring org charts, business processes, workflows, and HR policies with role-based access control. Includes an AI-powered documentation assistant (RAG chat) that answers questions from your uploaded documents and org data.

## Features

- **Interactive org canvas** — Mermaid.js diagrams for org charts, business processes, workflows, and HR policy. Click any node to see its description, connections, and related steps in an expandable side panel. Nodes highlight on hover and show a blue ring when selected.
- **Role-gated access** — Admin, Manager, and Viewer tiers. Restricted nodes appear blurred for lower-privilege roles rather than being hidden entirely.
- **AI chat widget** — Floating assistant (bottom-right) answers questions from ingested PDFs, Excel files, Markdown, and org JSON data. Also generates Mermaid diagrams on request with validated syntax.
- **Admin panel** — Add, edit, and delete nodes and edges for any diagram type directly in the UI without touching JSON files.
- **Free-tier LLM** — Powered by Groq (Llama 3.3 70B). No OpenAI key required. Embeddings run locally via ChromaDB's bundled ONNX model (~80 MB, downloaded once on first run).

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

| Layer         | Technology                                                                          |
|---------------|-------------------------------------------------------------------------------------|
| LLM           | Groq — `llama-3.3-70b-versatile` (answers & diagrams), `llama-3.1-8b-instant` (routing) |
| Embeddings    | ChromaDB bundled ONNX model (all-MiniLM-L6-v2, local, no API key)                  |
| Orchestration | LangChain + LangGraph                                                               |
| Vector DB     | ChromaDB (local persistence)                                                        |
| Backend       | Python / FastAPI / SSE                                                              |
| Frontend      | Next.js 15 (App Router) + Tailwind CSS                                              |
| Visualization | Mermaid.js (canvas diagrams + AI-generated diagrams in chat)                        |

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
│   │   ├── ingest.py        # Document ingestion (PDF, Excel, Markdown, org JSON)
│   │   ├── config.py        # Env var loader
│   │   ├── prompts.py       # LLM system prompts with Mermaid syntax rules
│   │   ├── embeddings.py    # Local embedding wrapper
│   │   └── routers/
│   │       ├── org.py       # Org diagram CRUD endpoints
│   │       └── admin.py     # Admin ingestion trigger endpoint
│   ├── data/
│   │   ├── documents/                      # Drop files here for RAG ingestion
│   │   │   ├── Agile_Approach_in_Company_Guide.pdf
│   │   │   ├── Organization_Structure_Template.xlsx
│   │   │   ├── hr_leave_policy.md          # Full HR leave entitlements & process
│   │   │   └── who_to_contact.md           # Contact directory by topic
│   │   ├── org/                            # Canvas diagram JSON files
│   │   │   ├── org_chart.json              # Full org hierarchy (CEO→teams→leads)
│   │   │   ├── business_process.json       # Customer order flow
│   │   │   ├── workflow.json               # Engineering deployment workflow
│   │   │   └── hr_policy.json             # Leave types & approval flow
│   │   └── url_map.json                    # filename → public URL for citations
│   └── tests/
│       └── test_smoke.py    # 20 integration tests (auth, org API, RAG chat)
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/         # Login page
│       │   └── (platform)/           # Auth-guarded shell
│       │       ├── layout.tsx        # Sidebar + Navbar + ChatWidget
│       │       ├── dashboard/        # Role-aware landing page with diagram cards
│       │       ├── org/              # Org chart canvas
│       │       ├── processes/        # Business process canvas
│       │       ├── workflows/        # Workflow canvas
│       │       ├── hr/               # HR policy canvas (under Policies)
│       │       └── admin/            # Admin-only node/edge management
│       ├── components/
│       │   ├── canvas/               # OrgCanvas (hover/select highlight), NodeDetailPanel
│       │   ├── chat/                 # ChatWidget (floating bottom-right)
│       │   ├── layout/               # Sidebar (with Policies section), Navbar
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
# (indexes PDFs, Excel, Markdown from data/documents/ + org JSON from data/org/)
python -m src.ingest

# Start the API server
uvicorn src.main:app --reload --port 8000
```

> **Note:** The first ingest also downloads the local embedding model (~80 MB) to `~/.cache/chroma/`. Subsequent runs are instant.

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

## Example Chat Queries

The assistant answers from all ingested documents and org data. Try these:

| Query | What it uses |
|---|---|
| `"What is the HR leave policy?"` | `hr_leave_policy.md` — returns entitlements, carry-over rules, approval process |
| `"How many days of annual leave do I get?"` | `hr_leave_policy.md` |
| `"Who do I contact for a backend API issue?"` | `who_to_contact.md` → Alice Reyes |
| `"Who manages the Microservices Migration project?"` | `who_to_contact.md` → Alice Reyes, P-001 |
| `"What is the process for leave approval?"` | `hr_leave_policy.md` + `hr_policy.json` |
| `"How does the customer place an order?"` | `business_process.json` |
| `"Tell me about the deployment workflow"` | `workflow.json` |
| `"Show the engineering org chart"` | Generates a Mermaid diagram from org data |
| `"Visualize the customer order process"` | Generates a Mermaid flowchart |

---

## Canvas Interactivity

Each diagram page (Org Chart, Business Processes, Workflows, HR Policy) supports:

- **Hover** — node darkens with a drop shadow to indicate it's clickable
- **Click** — blue ring appears on the selected node; a detail panel slides in from the right
- **Detail panel** — shows the node's full description, type, access level, and an expandable **Connections** section listing which nodes it leads to and receives from (with edge labels)
- **Restricted nodes** — shown with a 🔒 blurred style; non-clickable for roles that lack access
- **Admin actions** — Edit and Delete buttons appear in the panel for admin users

---

## Adding Documents

1. Drop PDF, Excel (`.xlsx`), or Markdown (`.md`) files into `backend/data/documents/`
2. Optionally map filenames to public URLs in `backend/data/url_map.json`:
   ```json
   { "my-policy.pdf": "https://company.com/docs/my-policy" }
   ```
3. Re-run ingestion (stop the server first on Windows):
   ```bash
   cd backend && python -m src.ingest
   ```

The chat widget will answer questions from the new documents immediately after restart.

---

## Editing Org Data

Diagrams are stored as JSON in `backend/data/org/`:

| File | Content |
|---|---|
| `org_chart.json` | Full company hierarchy: CEO, CTO, COO, CFO → departments → teams → named leads |
| `business_process.json` | Customer order → validation → payment → shipping flow |
| `workflow.json` | Engineering PR → CI → review → staging → production deploy |
| `hr_policy.json` | Leave types → manager approval → HR review → confirmation |

Each node has a `permission_level`:

| `permission_level` | Visible to        |
|--------------------|-------------------|
| `"public"`         | All roles         |
| `"manager"`        | Manager + Admin   |
| `"admin"`          | Admin only        |

Edit JSON files directly, or use the **Admin Panel** at `/admin` (admin role required). After editing org JSON, re-run ingestion so the chat assistant picks up the changes.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable             | Description                              | Default                   |
|----------------------|------------------------------------------|---------------------------|
| `GROQ_API_KEY`       | Your Groq API key                        | *(required)*              |
| `CHROMA_PERSIST_DIR` | ChromaDB storage directory               | `./chroma_store`          |
| `COLLECTION_NAME`    | Vector store collection name             | `doc-agent-index`         |
| `LLM_MODEL`          | Groq model for answers and diagrams      | `llama-3.3-70b-versatile` |
| `ROUTER_MODEL`       | Groq model for intent classification     | `llama-3.1-8b-instant`    |
| `HOST`               | Server host                              | `0.0.0.0`                 |
| `PORT`               | Server port                              | `8000`                    |
| `FRONTEND_URL`       | Frontend URL (CORS allowlist)            | `http://localhost:3000`   |
| `SESSION_SECRET`     | Secret for session tokens                | `dev-only-change-in-prod` |

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

Valid types: `org_chart`, `business_process`, `workflow`, `hr_policy`

Returns a permission-filtered diagram. Nodes the caller's role cannot access are returned with `"label": "Restricted"` and `"is_restricted": true` so the canvas can render them blurred.

```json
{
  "diagram_type": "org_chart",
  "nodes": [
    {
      "id": "ceo-001",
      "type": "orgNode",
      "data": {
        "label": "CEO",
        "description": "Chief Executive Officer — overall company strategy",
        "node_type": "person",
        "permission_level": "public",
        "is_restricted": false
      }
    }
  ],
  "edges": [{ "id": "e1", "source": "ceo-001", "target": "cto-001", "label": "" }]
}
```

#### Admin-only node/edge CRUD

| Method   | Path                          | Description        |
|----------|-------------------------------|--------------------|
| `GET`    | `/api/org/nodes/{type}`       | List all raw nodes |
| `POST`   | `/api/org/nodes/{type}`       | Create a node      |
| `PATCH`  | `/api/org/nodes/{type}/{id}`  | Update a node      |
| `DELETE` | `/api/org/nodes/{type}/{id}`  | Delete a node      |
| `POST`   | `/api/org/edges/{type}`       | Create an edge     |
| `DELETE` | `/api/org/edges/{type}/{id}`  | Delete an edge     |

---

### Chat

#### `POST /api/chat`

Streams Server-Sent Events. The agent classifies intent first, then either retrieves information or generates a Mermaid diagram. Diagram syntax is validated and auto-corrected before streaming.

**Request:**
```json
{ "message": "Show the engineering org chart", "history": [] }
```

**SSE Events:**

| Event    | Data                                                         |
|----------|--------------------------------------------------------------|
| `intent` | `{ "intent": "retrieve_info" \| "generate_diagram" }`       |
| `answer` | `{ "text": "...", "diagram_code": "...", "sources": [...] }` |
| `done`   | `{ "status": "complete" }`                                   |
| `error`  | `{ "error": "..." }`                                         |

When `intent` is `generate_diagram`, `diagram_code` contains raw Mermaid syntax and `text` is `"Here is the requested diagram:"`.

---

## Running Tests

```bash
cd backend
pip install pytest httpx    # only needed once
python -m pytest tests/test_smoke.py -v
```

20 integration tests covering auth, role-based permission filtering across all diagram types, and the full RAG chat pipeline including diagram generation. The backend must be running on port 8000.

---

## License

MIT
