# Pulse — Enterprise Process Visualization Platform

An enterprise platform for visualizing business processes as interactive BPMN 2.0 diagrams. Paste any plain-text process description and Pulse converts it into a structured swimlane diagram — instantly. Also includes org chart visualization, role-based access control, and an AI-powered documentation assistant.

## Features

- **Text-to-BPMN** — Paste a process description, click Parse, and get a fully interactive BPMN 2.0 diagram with swimlanes, gateways, and events in under 10 seconds. Export as a standard `.bpmn` file compatible with Camunda, Bizagi, and other BPMN tools.
- **Interactive BPMN canvas** — Zoom, pan, fit-to-screen. Powered by `bpmn-js` (NavigatedViewer).
- **Interactive org canvas** — Mermaid.js diagrams for org charts, business processes, workflows, and HR policy. Click any node to see its description, connections, and related steps.
- **Role-gated access** — Admin, Manager, and Viewer tiers. Restricted nodes appear blurred for lower-privilege roles. Viewers can view BPMN diagrams but cannot trigger parsing.
- **AI chat widget** — Floating assistant (bottom-right) answers questions from ingested PDFs, Excel files, Markdown, and org JSON data. Generates Mermaid diagrams on request.
- **Admin panel** — Add, edit, and delete nodes and edges for any diagram type directly in the UI.
- **Free-tier LLM** — Powered by Groq (Llama 3.3 70B). No OpenAI key required. Embeddings run locally via ChromaDB's bundled ONNX model (~80 MB, downloaded once on first run).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│                                                                  │
│  ┌──────────┐  ┌────────────────┐  ┌───────────┐  ┌──────────┐  │
│  │  Login   │  │  BPMN Canvas   │  │  Admin    │  │  Chat    │  │
│  │  Page    │  │  (bpmn-js)     │  │  Panel    │  │  Widget  │  │
│  └──────────┘  └────────────────┘  └───────────┘  └──────────┘  │
│                        │ REST / SSE                              │
└────────────────────────┼────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI)                          │
│                                                                  │
│  POST /api/auth/login          — session token                   │
│  POST /api/bpmn/parse          — text → BPMN 2.0 XML            │
│  GET  /api/bpmn/templates      — sample process flows            │
│  GET  /api/org/diagram/{type}  — permission-filtered diagram     │
│  CRUD /api/org/nodes/{type}    — admin node management           │
│  POST /api/chat (SSE)          — LangGraph RAG agent             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Text-to-BPMN Pipeline                        │   │
│  │   LLM Parser (llama-3.3-70b) → Process JSON              │   │
│  │   → BPMN 2.0 XML Generator → bpmn-js renders SVG         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   LangGraph RAG Agent                     │   │
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

| Layer         | Technology                                                                            |
|---------------|---------------------------------------------------------------------------------------|
| LLM           | Groq — `llama-3.3-70b-versatile` (BPMN parsing, answers, diagrams), `llama-3.1-8b-instant` (routing) |
| Embeddings    | ChromaDB bundled ONNX model (all-MiniLM-L6-v2, local, no API key)                    |
| Orchestration | LangChain + LangGraph                                                                 |
| Vector DB     | ChromaDB (local persistence)                                                          |
| Backend       | Python / FastAPI / SSE                                                                |
| Frontend      | Next.js 16 (App Router) + Tailwind CSS                                                |
| BPMN Canvas   | bpmn-js (NavigatedViewer — zoom, pan, export)                                        |
| Org Canvas    | Mermaid.js (org charts + AI-generated diagrams in chat)                               |

---

## Project Structure

```
pulse/
├── backend/
│   ├── pyproject.toml
│   ├── .env.example
│   ├── src/
│   │   ├── main.py           # FastAPI app — auth, org, bpmn, and chat endpoints
│   │   ├── agent.py          # LangGraph state machine (Router → Retriever/Visualizer)
│   │   ├── auth.py           # Session-based auth, hardcoded users
│   │   ├── ingest.py         # Document ingestion (PDF, Excel, Markdown, org JSON)
│   │   ├── config.py         # Env var loader
│   │   ├── prompts.py        # LLM system prompts
│   │   ├── embeddings.py     # Local embedding wrapper
│   │   ├── bpmn/             # Text-to-BPMN pipeline
│   │   │   ├── models.py     # Pydantic models (ProcessFlow, Actor, Gateway, etc.)
│   │   │   ├── parser.py     # LLM-based process text extractor (JSON mode + retry)
│   │   │   └── generator.py  # Process JSON → BPMN 2.0 XML with swimlanes & DI
│   │   └── routers/
│   │       ├── bpmn.py       # POST /api/bpmn/parse, GET /api/bpmn/templates
│   │       ├── org.py        # Org diagram CRUD endpoints
│   │       └── admin.py      # Admin ingestion trigger endpoint
│   ├── data/
│   │   ├── documents/                       # Drop files here for RAG ingestion
│   │   │   ├── Agile_Approach_in_Company_Guide.pdf
│   │   │   ├── Organization_Structure_Template.xlsx
│   │   │   ├── hr_leave_policy.md
│   │   │   └── who_to_contact.md
│   │   ├── org/                             # Canvas diagram JSON files
│   │   │   ├── org_chart.json
│   │   │   ├── business_process.json
│   │   │   ├── workflow.json
│   │   │   └── hr_policy.json
│   │   ├── templates/                       # BPMN process flow templates
│   │   │   └── telco_case_management.txt
│   │   └── url_map.json
│   └── tests/
│       ├── test_smoke.py     # Auth, org API, RAG chat integration tests
│       └── test_bpmn.py      # 21 tests: BPMN generator, endpoints, live LLM
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/
│       │   └── (platform)/
│       │       ├── layout.tsx
│       │       ├── dashboard/
│       │       ├── processes/        # BPMN canvas (ProcessInput + BPMNCanvas)
│       │       ├── org/
│       │       ├── workflows/
│       │       ├── hr/
│       │       └── admin/
│       ├── components/
│       │   ├── bpmn/                 # Text-to-BPMN components
│       │   │   ├── ProcessInput.tsx  # Textarea + template dropdown + parse button
│       │   │   ├── BPMNCanvas.tsx    # bpmn-js viewer (SSR-safe dynamic import)
│       │   │   └── BPMNToolbar.tsx   # Zoom in/out, fit-to-screen, download .bpmn
│       │   ├── canvas/               # OrgCanvas, NodeDetailPanel
│       │   ├── chat/                 # ChatWidget, MermaidRenderer
│       │   ├── layout/               # Sidebar, Navbar
│       │   ├── admin/                # AdminPanel, NodeFormModal, EdgeFormModal
│       │   └── dashboard/            # DashboardView
│       ├── context/AuthContext.tsx
│       ├── lib/
│       │   ├── api.ts                # Authenticated fetch wrapper + BPMN + org API
│       │   └── auth.ts
│       └── types/org.ts
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

python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -e .

# Ingest documents into ChromaDB
python -m src.ingest

# Start the API server
uvicorn src.main:app --reload --port 8000
```

> **Note:** The first ingest downloads the local embedding model (~80 MB) to `~/.cache/chroma/`. Subsequent runs are instant.

### 3. Setup Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

### 4. Open the App

Go to **http://localhost:3000** and log in:

| Username  | Password     | Role    | Access                                          |
|-----------|--------------|---------|-------------------------------------------------|
| `admin`   | `admin123`   | Admin   | All nodes + admin panel + BPMN parse            |
| `manager` | `manager123` | Manager | Public + manager nodes + BPMN parse             |
| `viewer`  | `viewer123`  | Viewer  | Public nodes only (others blurred); BPMN view only |

---

## Using the BPMN Feature

1. Navigate to **Processes** in the sidebar
2. Select a template from the dropdown (e.g. *Telco Case Management*) or paste your own process description
3. Click **Parse to BPMN**
4. The diagram renders as an interactive swimlane BPMN diagram
5. Use the toolbar to zoom in/out, fit to screen, or download the `.bpmn` file

### BPMN API

#### `POST /api/bpmn/parse`

Requires manager or admin role.

**Request:**
```json
{ "text": "Customer contacts store. Frontliner creates a case..." }
```

**Response:**
```json
{
  "bpmn_xml": "<?xml version=\"1.0\"?>...",
  "process_json": {
    "name": "...",
    "actors": [...],
    "activities": [...],
    "gateways": [...],
    "events": [...],
    "sequence_flows": [...]
  }
}
```

#### `GET /api/bpmn/templates`

Returns available sample process flow texts from `data/templates/`.

---

## Example Chat Queries

| Query | What it uses |
|---|---|
| `"What is the HR leave policy?"` | `hr_leave_policy.md` |
| `"Who do I contact for a backend API issue?"` | `who_to_contact.md` |
| `"How does the customer place an order?"` | `business_process.json` |
| `"Show the engineering org chart"` | Generates a Mermaid diagram |
| `"Visualize the customer order process"` | Generates a Mermaid flowchart |

---

## Running Tests

```bash
cd backend

# Unit + API tests (no LLM required)
pytest tests/ -v

# Include live LLM integration tests (requires GROQ_API_KEY and running server)
pytest tests/ -v -m slow
```

- `test_smoke.py` — auth, org API, RAG chat (requires running server)
- `test_bpmn.py` — 21 tests: BPMN XML generator (unit), endpoints (API), live parse (LLM)

---

## Environment Variables

### Backend (`backend/.env`)

| Variable             | Description                              | Default                   |
|----------------------|------------------------------------------|---------------------------|
| `GROQ_API_KEY`       | Your Groq API key                        | *(required)*              |
| `CHROMA_PERSIST_DIR` | ChromaDB storage directory               | `./chroma_store`          |
| `COLLECTION_NAME`    | Vector store collection name             | `doc-agent-index`         |
| `LLM_MODEL`          | Groq model for BPMN parsing and answers  | `llama-3.3-70b-versatile` |
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

## License

MIT
