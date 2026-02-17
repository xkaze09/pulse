# Pulse — Usage Guide

This guide covers how to use, extend, and deploy the Pulse documentation & visualization agent.

---

## Table of Contents

1. [For End Users](#for-end-users)
2. [For Developers](#for-developers)
3. [Deployment](#deployment)

---

## For End Users

### Getting Started

1. Open **http://localhost:3000** in your browser.
2. You'll see a clean chat interface with suggested queries.
3. Type your question in the input bar and press Enter (or click the send button).

### Types of Queries

Pulse automatically detects whether you need **information retrieval** or a **visual diagram**.

#### Information Retrieval

Ask questions about your company documentation. The agent will search the knowledge base and return an answer with clickable source links.

**Example queries:**
- "What is the HR leave policy?"
- "Send me the link to the HR policy."
- "What are the standard work hours?"
- "Explain the deployment rollback procedure."
- "What benefits do full-time employees receive?"

**What you get:**
- A Markdown-formatted answer
- Clickable source badges below the answer (click to open the original document)

#### Visual Diagrams

Ask the agent to create a diagram, and it will generate a Mermaid.js visualization rendered directly in the chat.

**Example queries:**
- "Visualize the checkout process"
- "Draw the engineering org chart"
- "Show me the deployment flow as a diagram"
- "Create a flowchart of the order process"
- "Map out the CI/CD pipeline"

**What you get:**
- A rendered SVG diagram in the chat window
- A **"Download SVG"** button to save the diagram to your computer
- Source badges showing which documents were used

### Tips

- **Be specific:** "Show the checkout process flow" works better than "show me stuff."
- **Use visualization keywords:** Words like "visualize," "diagram," "draw," "chart," "flow," and "org chart" trigger diagram generation.
- **Click source badges** to open the original document in a new tab.

---

## For Developers

### Adding New Documents

1. **Drop PDF files** into `backend/data/documents/`.

2. **Update the URL map** in `backend/data/url_map.json`:
   ```json
   {
     "Company_Processes.pdf": "https://sharepoint.example.com/docs/Company_Processes.pdf",
     "New_Document.pdf": "https://sharepoint.example.com/docs/New_Document.pdf"
   }
   ```

3. **Re-run ingestion** to update the vector store:
   ```bash
   cd backend
   python -m src.ingest
   ```

   This will:
   - Delete the existing ChromaDB store
   - Reload all PDFs with enriched metadata
   - Chunk the text (1000 tokens, 200 overlap)
   - Embed and store in ChromaDB

4. **Restart the backend** (or it will auto-reload if using `--reload`).

### Modifying System Prompts

All prompts are centralized in `backend/src/prompts.py`:

- **`ROUTER_SYSTEM_PROMPT`** — Controls how the intent classifier decides between retrieval and visualization.
- **`RETRIEVER_SYSTEM_PROMPT`** — Controls the tone, format, and citation behavior of answers.
- **`VISUALIZER_SYSTEM_PROMPT`** — Controls Mermaid diagram generation rules.

### Extending the Agent

The LangGraph agent in `backend/src/agent.py` is built as a state machine. To add new capabilities:

1. **Define a new node function** (e.g., `summarizer_node`).
2. **Add the intent** to the `RouteDecision` Pydantic model.
3. **Register the node** in `build_graph()` and add edges.
4. **Update the router prompt** in `prompts.py` to recognize the new intent.

### Switching to Pinecone

The vector store abstraction makes switching straightforward:

1. Install the Pinecone package:
   ```bash
   pip install langchain-pinecone pinecone
   ```

2. In `agent.py`, replace the `_get_vectorstore()` function:
   ```python
   from langchain_pinecone import PineconeVectorStore
   
   def _get_vectorstore():
       embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
       return PineconeVectorStore(
           index_name="doc-agent-index",
           embedding=embeddings,
       )
   ```

3. Update `ingest.py` similarly to use `PineconeVectorStore.from_documents()`.

4. Set the `PINECONE_API_KEY` environment variable.

### Chunking Parameters

The ingestion pipeline uses token-based chunking via tiktoken:

| Parameter      | Value | Rationale                                    |
| -------------- | ----- | -------------------------------------------- |
| `chunk_size`   | 1000  | Tokens (not characters) — fits within embedding model limits |
| `chunk_overlap` | 200  | Ensures context continuity across chunk boundaries |
| `encoding`     | `cl100k_base` | Matches GPT-4o and text-embedding-3-small tokenizer |

To adjust, edit the `chunk_documents()` function in `backend/src/ingest.py`.

### Project Architecture

```
User Query
    │
    ▼
┌──────────┐
│  Router   │ ← GPT-4o-mini structured output
│ (Classify)│   Intent: "retrieve_info" | "generate_diagram"
└────┬──────┘
     │
     ├─── retrieve_info ──→ ┌──────────┐    ┌──────────────┐
     │                       │Retriever │───→│ Text + Links │
     │                       │ (k=5)    │    └──────────────┘
     │                       └──────────┘
     │
     └─── generate_diagram → ┌──────────┐    ┌──────────────┐
                              │Visualizer│───→│ Mermaid Code │
                              │ (k=10)   │    └──────────────┘
                              └──────────┘
```

---

## Deployment

### Docker Compose

Create a `docker-compose.yml` in the project root:

```yaml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    volumes:
      - ./backend/data:/app/data
      - chroma_data:/app/chroma_store
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      - backend

volumes:
  chroma_data:
```

### Backend Dockerfile (`backend/Dockerfile`)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .

COPY . .
RUN python -m src.ingest

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Dockerfile (`frontend/Dockerfile`)

```dockerfile
FROM node:20-slim AS builder
RUN npm install -g pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:20-slim AS runner
RUN npm install -g pnpm
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["pnpm", "start"]
```

### Production CORS Configuration

Update `FRONTEND_URL` in `backend/.env` to match your production frontend URL:

```
FRONTEND_URL=https://pulse.yourcompany.com
```

The backend will allow CORS from this origin. To add multiple origins, modify the `allow_origins` list in `backend/src/main.py`.

### Security Considerations

- Never commit `.env` files to version control (they are in `.gitignore`).
- Use environment variables or secrets management in production.
- The OpenAI API key should be server-side only — it is never exposed to the frontend.
- Consider adding authentication (e.g., OAuth2) for production deployments.
