# Pulse — Architecture & Implementation Guide

> **Audience:** New team members who want to understand *why* we built Pulse the way we did and *how* every piece fits together, from the high-level idea down to individual lines of code.

---

## Table of Contents

1. [The Idea](#1-the-idea)
2. [Core Concepts You Need to Know](#2-core-concepts-you-need-to-know)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Technology Choices & Rationale](#4-technology-choices--rationale)
5. [Step-by-Step Implementation Walkthrough](#5-step-by-step-implementation-walkthrough)
   - [Step 1 — Project Scaffolding](#step-1--project-scaffolding)
   - [Step 2 — Configuration & Environment](#step-2--configuration--environment)
   - [Step 3 — Document Ingestion Pipeline](#step-3--document-ingestion-pipeline)
   - [Step 4 — The LangGraph Agent](#step-4--the-langgraph-agent)
   - [Step 5 — System Prompts](#step-5--system-prompts)
   - [Step 6 — FastAPI Backend & SSE Streaming](#step-6--fastapi-backend--sse-streaming)
   - [Step 7 — The Next.js Frontend](#step-7--the-nextjs-frontend)
6. [Data Flow: End-to-End Request Lifecycle](#6-data-flow-end-to-end-request-lifecycle)
7. [Key Design Decisions](#7-key-design-decisions)
8. [File-by-File Reference](#8-file-by-file-reference)
9. [Glossary](#9-glossary)

---

## 1. The Idea

### The Problem

Employees in any organisation waste significant time hunting for the right document, the right link, or trying to understand complex processes buried inside PDFs and spreadsheets. Common scenarios:

- *"Where is the HR leave policy?"*
- *"What does the checkout process look like as a flowchart?"*
- *"Who reports to whom in the engineering org?"*

These questions usually involve opening SharePoint/Google Drive, searching through multiple documents, reading several pages, and then mentally piecing things together.

### The Solution — Pulse

Pulse is an **AI-powered documentation assistant** that:

1. **Answers questions** about company documents with cited sources and clickable links back to the original file.
2. **Generates visual diagrams** (org charts, process flows, sequence diagrams) on demand, rendered directly in the browser.

Under the hood, Pulse is a **Retrieval-Augmented Generation (RAG)** agent. It doesn't rely on the LLM's general knowledge — it searches a local vector database of *your* company's documents and uses only that context to answer.

---

## 2. Core Concepts You Need to Know

If you're new to AI/LLM applications, here are the building blocks Pulse relies on. Skim these now; they'll make the implementation walkthrough much clearer.

### RAG (Retrieval-Augmented Generation)

Instead of asking the LLM to answer from memory (which can hallucinate), we:

1. **Retrieve** the most relevant chunks of text from a database.
2. **Augment** the LLM's prompt with those chunks as context.
3. **Generate** an answer grounded in real documents.

This is the single most important pattern in Pulse.

### Embeddings

An embedding is a fixed-length vector of numbers that represents the "meaning" of a piece of text. Texts with similar meanings have vectors that are close together in vector space. We use OpenAI's `text-embedding-3-small` model (1536-dimensional vectors) to convert document chunks into embeddings.

### Vector Database (ChromaDB)

A specialised database that stores embeddings and lets you search by *similarity*. When a user asks a question, we embed their question, then find the document chunks whose embeddings are closest (cosine similarity). We use **ChromaDB** — a lightweight, file-based vector store that runs locally with no external server required.

### LangChain & LangGraph

- **LangChain** — A Python framework that provides abstractions for LLMs, embeddings, document loaders, text splitters, and vector stores. It handles the "plumbing" so we don't write boilerplate.
- **LangGraph** — A library built on top of LangChain for creating **stateful, graph-based agent workflows**. We define nodes (functions) and edges (transitions) to build a state machine that routes and processes queries.

### Mermaid.js

A JavaScript library that renders diagrams from a simple text-based syntax. For example:

```
graph TD
    A[Start] --> B[Process]
    B --> C[End]
```

We ask the LLM to output Mermaid syntax, and the frontend renders it as an SVG diagram.

### SSE (Server-Sent Events)

A standard for streaming data from server to client over HTTP. Unlike WebSockets, SSE is unidirectional (server → client) and works over a normal HTTP connection. We use it to progressively send the agent's response (intent classification, answer, sources) to the frontend.

---

## 3. High-Level Architecture

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

**In plain English:** The user types a question in the chat UI. The frontend sends it to the FastAPI backend. The backend runs a LangGraph state machine that first classifies the user's intent (info retrieval or diagram?), then routes to the appropriate handler node. That node searches ChromaDB for relevant document chunks, feeds them to GPT-4o as context, and returns either a text answer or Mermaid diagram code. The result streams back to the frontend via SSE, where it's rendered as Markdown or an interactive SVG diagram.

---

## 4. Technology Choices & Rationale

| Layer         | Choice                         | Why                                                                                       |
| ------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| **LLM**       | GPT-4o (answers & diagrams)    | Strongest reasoning, best at following complex formatting instructions for Mermaid output  |
| **Router LLM**| GPT-4o-mini (intent classification) | Cheaper and faster — classification is a simple task that doesn't need the full model |
| **Orchestration** | LangGraph                  | Gives us a clear state machine with typed state, conditional routing, and easy extensibility |
| **Embeddings**| `text-embedding-3-small`       | Good balance of quality and cost; 1536 dimensions; matches the `cl100k_base` tokenizer    |
| **Vector DB** | ChromaDB (local)               | Zero-config, file-based, perfect for development; swappable to Pinecone for production     |
| **Backend**   | FastAPI + SSE                  | Async-first, automatic OpenAPI docs, SSE support via `sse-starlette`                      |
| **Frontend**  | Next.js 15 + Tailwind CSS     | React with App Router, server components, fast HMR, easy styling                          |
| **Diagrams**  | Mermaid.js                     | Text-based → easy for LLMs to generate; renders client-side as SVG; downloadable           |
| **Markdown**  | `react-markdown`               | Renders the LLM's Markdown answers natively in React                                      |

---

## 5. Step-by-Step Implementation Walkthrough

This section walks through how the project was built, in the order a developer would naturally approach it.

---

### Step 1 — Project Scaffolding

We created a monorepo with two top-level folders:

```
pulse/
├── backend/       ← Python (FastAPI + LangGraph)
├── frontend/      ← TypeScript (Next.js)
└── docs/          ← Documentation
```

**Backend** uses `pyproject.toml` with Hatchling as the build system. Key dependencies:

```toml
dependencies = [
    "langgraph>=0.2.0",          # Agent state machine
    "langchain-openai>=0.2.0",   # OpenAI LLM & embeddings wrappers
    "langchain-community>=0.3.0",# Document loaders (PDF, etc.)
    "langchain-text-splitters>=0.3.0", # Chunking strategies
    "langchain-chroma>=0.2.0",   # ChromaDB integration
    "chromadb>=0.5.0",           # Vector database
    "pypdf>=4.0.0",              # PDF parsing
    "openpyxl>=3.1.0",           # Excel parsing
    "fastapi>=0.115.0",          # Web framework
    "uvicorn[standard]>=0.32.0", # ASGI server
    "sse-starlette>=2.0.0",      # SSE support for FastAPI
    "python-dotenv>=1.0.0",      # .env file loading
    "tiktoken>=0.7.0",           # Token counting for chunking
    "pydantic>=2.0.0",           # Data validation
]
```

**Frontend** uses `pnpm` and Next.js 16 with React 19. Key dependencies:

```json
{
  "lucide-react": "icons",
  "mermaid": "diagram rendering",
  "react-markdown": "markdown rendering in chat bubbles"
}
```

---

### Step 2 — Configuration & Environment

**File:** `backend/src/config.py`

All configuration lives in one place. The module loads a `.env` file from the backend directory and exposes typed constants:

```python
# OpenAI
OPENAI_API_KEY      # Your API key (required, from .env)

# ChromaDB
CHROMA_PERSIST_DIR  # Where the vector store is saved on disk
COLLECTION_NAME     # Name of the collection inside ChromaDB ("doc-agent-index")

# Models
EMBEDDING_MODEL     # "text-embedding-3-small" — used for embedding documents & queries
LLM_MODEL           # "gpt-4o" — used for generating answers and diagrams
ROUTER_MODEL        # "gpt-4o-mini" — used for intent classification (cheaper/faster)

# Server
HOST, PORT          # Where the FastAPI server listens
FRONTEND_URL        # Allowed CORS origin

# Paths
DATA_DIR            # backend/data/
DOCUMENTS_DIR       # backend/data/documents/ — drop PDFs and Excel files here
URL_MAP_PATH        # backend/data/url_map.json — maps filenames to public URLs
```

**Why centralize config?** Every module imports from `config.py` instead of reading `os.getenv()` directly. This means one place to change defaults, one place to validate, and easy testability.

---

### Step 3 — Document Ingestion Pipeline

**File:** `backend/src/ingest.py`

Before the agent can answer questions, we need to load your documents into the vector database. The ingestion pipeline runs as a standalone script: `python -m src.ingest`.

#### 3.1 — Load the URL Map

```python
url_map = load_url_map(URL_MAP_PATH)
# Reads backend/data/url_map.json
# Maps: { "Company_Processes.pdf": "https://sharepoint.example.com/..." }
```

This allows the agent to include clickable links back to the original document in its answers.

#### 3.2 — Load Documents

```python
documents = load_documents(DOCUMENTS_DIR, url_map)
```

This function iterates over all files in `backend/data/documents/` and handles two formats:

- **PDFs** — Loaded with `PyPDFLoader` from LangChain. Each page becomes a separate LangChain `Document` object.
- **Excel files (.xlsx/.xls)** — Loaded with `openpyxl`. Each sheet is converted into a text representation where each row is formatted as `"Column: Value | Column: Value"`. This makes tabular data searchable.

Each document is enriched with metadata:
- `url` — The public URL from the URL map (for citation links)
- `filename` — The original filename
- `page` — The page number (for PDFs) or 0 (for Excel)
- `last_updated` — The current date

#### 3.3 — Chunk Documents

```python
chunks = chunk_documents(documents)
```

Full pages are too large to embed effectively. We split them into overlapping chunks:

| Parameter        | Value           | Explanation                                                      |
| ---------------- | --------------- | ---------------------------------------------------------------- |
| `chunk_size`     | 1000 tokens     | Big enough to carry meaning, small enough to be specific         |
| `chunk_overlap`  | 200 tokens      | Overlap prevents important sentences from being cut in half      |
| `encoding`       | `cl100k_base`   | The tokenizer used by GPT-4o and `text-embedding-3-small`       |

We use `RecursiveCharacterTextSplitter.from_tiktoken_encoder()` which splits by tokens (not characters), respecting paragraph/sentence boundaries before resorting to hard cuts.

#### 3.4 — Embed & Store

```python
vectorstore = create_vector_store(chunks)
```

This function:
1. Deletes any existing ChromaDB store (clean rebuild).
2. Creates an `OpenAIEmbeddings` instance with `text-embedding-3-small`.
3. Calls `Chroma.from_documents()` which embeds every chunk and stores the vector + text + metadata in a local SQLite-backed ChromaDB database at `backend/chroma_store/`.

After ingestion, the database is ready for similarity search.

#### Complete Pipeline Flow

```
PDF/Excel files in data/documents/
         │
         ▼
    Load documents (PyPDFLoader / openpyxl)
         │
         ▼
    Enrich metadata (URLs, filenames, dates)
         │
         ▼
    Chunk into ~1000-token pieces (200 overlap)
         │
         ▼
    Embed with text-embedding-3-small (1536-dim vectors)
         │
         ▼
    Store in ChromaDB (backend/chroma_store/)
```

---

### Step 4 — The LangGraph Agent

**File:** `backend/src/agent.py`

This is the brain of Pulse — a three-node state machine built with LangGraph.

#### 4.1 — Agent State

Every node in the graph reads from and writes to a shared `AgentState` dictionary:

```python
class AgentState(TypedDict):
    input: str          # The user's question
    chat_history: list  # Previous messages (for context)
    intent: str         # "retrieve_info" or "generate_diagram"
    context: list       # Retrieved document chunks
    answer: str         # The final text answer
    sources: list       # Source citations [{url, source, page}]
    diagram_code: str   # Mermaid syntax (empty for info queries)
```

This typed dictionary is the "contract" between all nodes. Each node receives the full state and returns a partial update (only the fields it modifies).

#### 4.2 — Node 1: Router

```python
def router_node(state: AgentState) -> dict:
```

**Purpose:** Classify the user's intent into exactly one of two categories.

**How it works:**
1. Creates a `ChatOpenAI` instance using `GPT-4o-mini` (fast and cheap for classification).
2. Uses LangChain's **structured output** feature (`.with_structured_output(RouteDecision)`) which forces the LLM to return a Pydantic model:

```python
class RouteDecision(BaseModel):
    intent: Literal["retrieve_info", "generate_diagram"]
```

3. Sends the user's message with the `ROUTER_SYSTEM_PROMPT` to the LLM.
4. Returns `{"intent": "retrieve_info"}` or `{"intent": "generate_diagram"}`.

**Why structured output?** It guarantees we get a valid classification string — no parsing, no regex, no "sometimes the LLM returns something unexpected." Pydantic enforces the schema.

#### 4.3 — Node 2: Retriever

```python
def retriever_node(state: AgentState) -> dict:
```

**Purpose:** Answer factual questions using RAG.

**How it works:**
1. Opens the ChromaDB vector store.
2. Runs `similarity_search(query, k=5)` — finds the 5 most relevant chunks.
3. Formats those chunks into a context string with source metadata.
4. Sends the context + question to `GPT-4o` with the `RETRIEVER_SYSTEM_PROMPT` (which says "answer ONLY from the provided context and cite sources").
5. Returns the answer text, the source list, and an empty `diagram_code`.

**Why k=5?** A good balance — enough context for comprehensive answers without overwhelming the LLM's context window or diluting relevance.

#### 4.4 — Node 3: Visualizer

```python
def visualizer_node(state: AgentState) -> dict:
```

**Purpose:** Generate Mermaid.js diagram code from document content.

**How it works:**
1. Same as Retriever but with `k=10` (diagrams need more context to capture full structures).
2. Uses the `VISUALIZER_SYSTEM_PROMPT` (which says "output ONLY raw Mermaid code, no explanations").
3. Cleans up the response by stripping any accidental Markdown code fences the LLM might add.
4. Returns `diagram_code` containing the Mermaid syntax, plus sources.

**Why k=10?** Diagrams (especially org charts) need to capture relationships across many parts of a document. More context = more complete diagrams.

#### 4.5 — Helper Functions

- **`_get_vectorstore()`** — Creates a Chroma instance pointing at the persisted store. Used by both Retriever and Visualizer.
- **`_extract_sources(docs)`** — Deduplicates source metadata from retrieved documents. Returns a list of `{url, source, page}` dicts for the frontend's source badges.
- **`_format_context(docs)`** — Formats chunks into numbered text blocks with source annotations. This is what gets injected into the LLM prompt.

#### 4.6 — Graph Wiring

```python
def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    # Nodes
    graph.add_node("router", router_node)
    graph.add_node("retriever", retriever_node)
    graph.add_node("visualizer", visualizer_node)

    # Edges
    graph.add_edge(START, "router")                    # Always start at Router
    graph.add_conditional_edges(                        # Router decides the path
        "router",
        route_by_intent,                                # This function reads state["intent"]
        {"retriever": "retriever", "visualizer": "visualizer"},
    )
    graph.add_edge("retriever", END)                   # Retriever → done
    graph.add_edge("visualizer", END)                  # Visualizer → done

    return graph.compile()

# Singleton — compiled once at import time
agent = build_graph()
```

**Visual representation of the graph:**

```
START ──→ [Router] ──┬── intent = "retrieve_info"  ──→ [Retriever]  ──→ END
                     │
                     └── intent = "generate_diagram" ──→ [Visualizer] ──→ END
```

The graph is compiled into an executable object. Calling `agent.invoke(state)` runs the full pipeline and returns the final state.

---

### Step 5 — System Prompts

**File:** `backend/src/prompts.py`

All LLM instructions are centralized here. This is crucial — it means you can tune the agent's behavior without touching any code.

#### Router Prompt

Tells GPT-4o-mini how to classify intent. Lists trigger words:
- `"visualize", "diagram", "draw", "chart", "flow", "org chart"` → `generate_diagram`
- `"what is", "where can I find", "explain"` → `retrieve_info`

#### Retriever Prompt

Tells GPT-4o to:
- Answer ONLY from the provided context (prevents hallucination).
- Be concise and accurate.
- Cite sources with URLs at the end of the answer.
- Format output as Markdown.

#### Visualizer Prompt

Tells GPT-4o to:
- Output ONLY raw Mermaid.js code (no explanations, no code fences).
- Use `graph TD` for hierarchies, `sequenceDiagram` for processes.
- Use descriptive node labels.
- Keep diagrams clean and readable.

---

### Step 6 — FastAPI Backend & SSE Streaming

**File:** `backend/src/main.py`

#### 6.1 — App Setup

```python
app = FastAPI(title="Pulse API", version="0.1.0")
```

CORS middleware is added to allow the Next.js frontend (running on port 3000) to call the API on port 8000.

#### 6.2 — The `/api/chat` Endpoint

This is the only substantive endpoint. It:

1. Accepts a `POST` request with `{ message: string, history: [] }`.
2. Runs the LangGraph agent via `_run_agent()`.
3. Streams the response back using **Server-Sent Events (SSE)**.

**Why SSE instead of a plain JSON response?**

SSE lets us send multiple named events as the agent processes the query. The frontend receives events progressively:

| Event    | When Sent              | Contains                                      |
| -------- | ---------------------- | --------------------------------------------- |
| `intent` | After routing          | `{ "intent": "retrieve_info" }`               |
| `answer` | After generation       | `{ "text": "...", "diagram_code": "...", "sources": [...] }` |
| `done`   | Processing complete    | `{ "status": "complete" }`                    |
| `error`  | If something breaks    | `{ "error": "..." }`                          |

#### 6.3 — Running the Agent Asynchronously

```python
result = await asyncio.to_thread(agent.invoke, initial_state)
```

LangGraph's `invoke` is synchronous (it makes blocking HTTP calls to OpenAI). We wrap it in `asyncio.to_thread()` so it doesn't block FastAPI's async event loop.

#### 6.4 — Health Check

```
GET /health → { "status": "ok" }
```

Used for monitoring and Docker health checks.

---

### Step 7 — The Next.js Frontend

The frontend is a single-page chat application built with Next.js 15 (App Router) and Tailwind CSS.

#### 7.1 — Page Layout

**Files:** `frontend/src/app/layout.tsx` and `frontend/src/app/page.tsx`

- `layout.tsx` — Root layout with Geist fonts and global CSS.
- `page.tsx` — Main page with a header ("Pulse" logo + title) and the `<ChatInterface />` component filling the rest of the screen.

#### 7.2 — ChatInterface (State Management)

**File:** `frontend/src/components/ChatInterface.tsx`

This is the main stateful component. It manages:

- `messages[]` — Array of all chat messages (user + assistant).
- `input` — The current text in the input bar.
- `isLoading` — Whether we're waiting for the agent.

**Flow:**
1. User types a message and hits Enter.
2. The message is added to the `messages` array as a `user` message.
3. `sendChatMessage()` is called (see below).
4. The response is added as an `assistant` message with optional `diagramCode` and `sources`.
5. On error, a friendly error message is shown.

**UX details:**
- Auto-scrolls to the latest message.
- Shows a "Thinking..." spinner while waiting.
- Displays suggested queries when the chat is empty.

#### 7.3 — SSE Client

**File:** `frontend/src/lib/chatApi.ts`

```typescript
export async function sendChatMessage(message, history): Promise<ChatResponse>
```

This function:
1. POSTs to `http://localhost:8000/api/chat`.
2. Reads the response body as a stream using `ReadableStream`.
3. Parses SSE events manually (splitting on `\n`, looking for `event:` and `data:` lines).
4. Builds up a `ChatResponse` object with `intent`, `text`, `diagramCode`, and `sources`.
5. Returns the complete response.

**Why manual SSE parsing?** The browser's `EventSource` API only supports GET requests. Since we need POST (to send the message body), we use `fetch()` and parse the SSE format ourselves.

#### 7.4 — MessageBubble (Rendering)

**File:** `frontend/src/components/MessageBubble.tsx`

Each message is rendered differently based on role:
- **User messages** — Blue bubble, right-aligned, plain text.
- **Assistant messages** — White bubble, left-aligned, containing:
  - **Markdown** rendered via `react-markdown` (for formatted answers with headings, lists, links).
  - **Mermaid diagram** rendered via `<MermaidRenderer />` (if `diagramCode` is present).
  - **Source badges** rendered via `<SourceList />` (if `sources` are present).

#### 7.5 — MermaidRenderer (Diagrams)

**File:** `frontend/src/components/MermaidRenderer.tsx`

Renders Mermaid syntax into an interactive SVG:

1. Initializes the Mermaid library once on mount.
2. When `chart` prop changes, calls `mermaid.render()` to produce SVG markup.
3. Injects the SVG into the DOM via `dangerouslySetInnerHTML`.
4. Provides a **"Download SVG"** button that creates a Blob and triggers a file download.
5. Shows an error state with the raw Mermaid code if rendering fails (so users can debug).

**Important:** This component is loaded with `next/dynamic` and `ssr: false` because Mermaid requires a browser DOM to render.

#### 7.6 — SourceList (Citations)

**File:** `frontend/src/components/SourceList.tsx`

Renders source citations as clickable badges:

- Deduplicates sources by URL.
- Extracts a human-readable label from the filename (e.g., `Company_Processes.pdf` → `Company Processes`).
- Shows page numbers when available.
- Each badge is an `<a>` tag that opens the source document in a new tab.

---

## 6. Data Flow: End-to-End Request Lifecycle

Here's exactly what happens when a user types *"Visualize the checkout process"*:

```
1. User types message in ChatInterface input bar
2. handleSubmit() fires → adds user message to state → calls sendChatMessage()
3. Frontend POSTs to http://localhost:8000/api/chat:
   { "message": "Visualize the checkout process", "history": [] }

4. FastAPI receives request in chat() endpoint
5. _run_agent() constructs initial AgentState:
   { input: "Visualize the checkout process", intent: "", context: [], ... }

6. agent.invoke(state) starts the LangGraph state machine:

   ┌─ START ─→ router_node() ─────────────────────────────────┐
   │  • Sends message to GPT-4o-mini with ROUTER_SYSTEM_PROMPT │
   │  • GPT-4o-mini responds: { intent: "generate_diagram" }   │
   │  • State updated: intent = "generate_diagram"              │
   └────────────────────────────────────────────────────────────┘
                        │
                        ▼
   ┌─ route_by_intent() → "visualizer" ──────────────────────────┐
   │                                                              │
   │  visualizer_node():                                          │
   │  • Opens ChromaDB vector store                               │
   │  • Embeds "Visualize the checkout process" → 1536-dim vector │
   │  • similarity_search(k=10) → top 10 matching chunks          │
   │  • Formats chunks into context string                        │
   │  • Sends context + request to GPT-4o with VISUALIZER_PROMPT  │
   │  • GPT-4o returns raw Mermaid code:                          │
   │      graph TD                                                │
   │        A[User Adds to Cart] --> B[Checkout Page]             │
   │        B --> C{Payment Method?}                              │
   │        C -->|Credit Card| D[Process Payment]                 │
   │        C -->|PayPal| E[Redirect to PayPal]                   │
   │        ...                                                   │
   │  • Strips any accidental ``` fences                          │
   │  • Returns { answer, diagram_code, sources }                 │
   └──────────────────────────────────────── → END ───────────────┘

7. agent.invoke() returns final state with all fields populated

8. FastAPI SSE generator yields three events:
   event: intent  → { "intent": "generate_diagram" }
   event: answer  → { "text": "Here is the requested diagram:",
                       "diagram_code": "graph TD\n  A[User Adds...]...",
                       "sources": [{"url": "...", "source": "...", "page": 0}] }
   event: done    → { "status": "complete" }

9. Frontend chatApi.ts parses SSE stream → builds ChatResponse

10. ChatInterface adds assistant message to messages[]:
    { content: "Here is...", diagramCode: "graph TD\n...", sources: [...] }

11. MessageBubble renders:
    • Markdown text: "Here is the requested diagram:"
    • MermaidRenderer: renders the graph TD code as an SVG diagram
    • SourceList: clickable badges for each source document
```

---

## 7. Key Design Decisions

### Why a Router node instead of a single prompt?

We could have used one LLM call that both classifies and answers. But separating routing has key benefits:
- **Cost:** The router uses GPT-4o-mini (much cheaper). Only the actual generation uses GPT-4o.
- **Reliability:** Structured output with Pydantic guarantees valid classification — no prompt hacking or regex parsing.
- **Extensibility:** Adding a new intent (e.g., "summarize") means adding a node and an edge, without touching the existing retriever or visualizer code.

### Why k=5 for retrieval and k=10 for visualization?

- **Retrieval (k=5):** Questions are usually specific. 5 chunks provide enough context without noise.
- **Visualization (k=10):** Diagrams need to capture entire structures (all teams in an org chart, all steps in a process). More context = more complete diagrams.

### Why SSE instead of WebSockets?

- SSE is simpler (no handshake, no bidirectional protocol).
- We only need server → client streaming (the client sends one POST, then listens).
- SSE works through most proxies and load balancers without special configuration.
- Each interaction is a single request-response — no persistent connection needed.

### Why ChromaDB (local) instead of Pinecone?

- **Development speed:** ChromaDB requires zero setup — no account, no API key, no network calls. Just a local SQLite file.
- **Portability:** The vector store is checked into the repo (or rebuilt with `python -m src.ingest`).
- **Production swap:** The code is designed to swap in Pinecone with minimal changes (see `docs/USAGE.md`).

### Why a compatibility patch (`compat.py`)?

ChromaDB internally uses pydantic v1's `BaseSettings`, which has a type inference bug on Python 3.14+. Rather than downgrading Python or pinning old library versions, we apply a surgical monkey-patch that falls back to `Any` type when inference fails. This module **must** be imported before `chromadb` or `langchain_chroma` — hence the `import src.compat` at the top of every backend module.

---

## 8. File-by-File Reference

### Backend (`backend/src/`)

| File                | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `config.py`         | Loads `.env`, exposes all configuration as typed constants                            |
| `compat.py`         | Patches pydantic v1 for Python 3.14+ compatibility (imported first everywhere)       |
| `ingest.py`         | Document loading → chunking → embedding → ChromaDB storage pipeline                  |
| `prompts.py`        | All system prompts (router, retriever, visualizer) in one place                      |
| `agent.py`          | LangGraph state machine (Router → Retriever/Visualizer), compiled as singleton       |
| `main.py`           | FastAPI app, `/api/chat` SSE endpoint, CORS setup                                     |
| `create_dummy_pdf.py`| Utility to generate sample PDFs for testing                                          |

### Frontend (`frontend/src/`)

| File                       | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `app/layout.tsx`           | Root layout with fonts and metadata                                  |
| `app/page.tsx`             | Main page — header + ChatInterface                                   |
| `app/globals.css`          | Global Tailwind styles                                               |
| `components/ChatInterface.tsx` | Chat state management, input handling, API calls                 |
| `components/MessageBubble.tsx` | Renders each message (Markdown + diagrams + sources)             |
| `components/MermaidRenderer.tsx`| Renders Mermaid code to SVG, with download button               |
| `components/SourceList.tsx`| Renders source citation badges with links                            |
| `lib/chatApi.ts`           | SSE client — POSTs to backend, parses streaming response             |

### Data Files

| File/Directory              | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `backend/data/documents/`   | Drop your PDF and Excel files here                               |
| `backend/data/url_map.json` | Maps filenames to public URLs (for source citation links)        |
| `backend/chroma_store/`     | Persisted ChromaDB vector database (auto-generated by ingest)    |

---

## 9. Glossary

| Term                  | Definition                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| **RAG**               | Retrieval-Augmented Generation — retrieve relevant context, then generate answers grounded in that data  |
| **Embedding**         | A numeric vector representing the meaning of text; similar texts have similar vectors                    |
| **Vector Store**      | A database optimized for storing and searching by embedding similarity                                   |
| **ChromaDB**          | An open-source, lightweight vector database that stores data locally in SQLite                           |
| **LangChain**         | Python framework providing abstractions for LLMs, embeddings, loaders, splitters                        |
| **LangGraph**         | Extension of LangChain for building stateful agent workflows as directed graphs                          |
| **Mermaid.js**        | A JavaScript library for rendering diagrams from text-based syntax                                       |
| **SSE**               | Server-Sent Events — a protocol for streaming data from server to client over HTTP                       |
| **Structured Output** | LangChain feature that forces the LLM to return a Pydantic-validated object                              |
| **Chunking**          | Splitting documents into smaller pieces so they can be individually embedded and retrieved                |
| **Token**             | The basic unit of text that LLMs process; roughly ¾ of a word                                            |
| **CORS**              | Cross-Origin Resource Sharing — browser security policy; we configure it so the frontend can call the API |
| **Pydantic**          | Python library for data validation using type annotations                                                |

---

*Last updated: February 2026*
