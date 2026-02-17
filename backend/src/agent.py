"""LangGraph agent for the Pulse documentation & visualization assistant.

Implements a three-node state machine:
  Router -> Retriever (RAG answer + sources)
         -> Visualizer (Mermaid diagram generation)
"""

import src.compat  # noqa: F401 — must be first to patch pydantic v1 for Python 3.14+

from typing import Literal, TypedDict

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from src.config import (
    CHROMA_PERSIST_DIR,
    COLLECTION_NAME,
    GROQ_API_KEY,
    LLM_MODEL,
    ROUTER_MODEL,
)
from src.prompts import RETRIEVER_SYSTEM_PROMPT, ROUTER_SYSTEM_PROMPT, VISUALIZER_SYSTEM_PROMPT


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    """The shared state passed between all nodes in the graph."""

    input: str
    chat_history: list
    intent: str  # "retrieve_info" | "generate_diagram"
    context: list  # retrieved document chunks (as dicts)
    answer: str  # final text answer
    sources: list  # [{"url": ..., "source": ..., "page": ...}]
    diagram_code: str  # Mermaid syntax or empty string


# ---------------------------------------------------------------------------
# Structured output model for the router
# ---------------------------------------------------------------------------

class RouteDecision(BaseModel):
    """Router classification output."""

    intent: Literal["retrieve_info", "generate_diagram"] = Field(
        description="The classified intent of the user query."
    )


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _query_docs(query: str, k: int = 5) -> list[Document]:
    """Query ChromaDB directly using its native embedding function."""
    try:
        client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        collection = client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=DefaultEmbeddingFunction(),
        )
    except Exception:
        return []  # Collection not yet created — run ingest first

    results = collection.query(query_texts=[query], n_results=k)
    docs: list[Document] = []
    for content, meta in zip(results["documents"][0], results["metadatas"][0]):
        docs.append(Document(page_content=content, metadata=meta or {}))
    return docs


def _extract_sources(docs: list) -> list[dict]:
    """Extract unique source metadata from retrieved documents."""
    seen_urls: set[str] = set()
    sources: list[dict] = []
    for doc in docs:
        meta = doc.metadata
        url = meta.get("url", "")
        source = meta.get("source", meta.get("filename", ""))
        filename = meta.get("filename", "")
        page = meta.get("page", 0)
        key = f"{filename}:{page}" if not url else f"{url}:{page}"
        if key not in seen_urls:
            seen_urls.add(key)
            sources.append({
                "url": url,
                "source": source,
                "page": page,
            })
    return sources


def _format_context(docs: list) -> str:
    """Format retrieved documents into a context string for the LLM."""
    parts: list[str] = []
    for i, doc in enumerate(docs, 1):
        meta = doc.metadata
        source_info = f"[Source: {meta.get('filename', 'unknown')}, Page: {meta.get('page', '?')}, URL: {meta.get('url', 'N/A')}]"
        parts.append(f"--- Chunk {i} {source_info} ---\n{doc.page_content}")
    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------

def router_node(state: AgentState) -> dict:
    """Classify user intent using Groq with structured output."""
    llm = ChatGroq(
        model=ROUTER_MODEL,
        temperature=0,
        groq_api_key=GROQ_API_KEY,
    )
    structured_llm = llm.with_structured_output(RouteDecision)

    result = structured_llm.invoke([
        SystemMessage(content=ROUTER_SYSTEM_PROMPT),
        HumanMessage(content=state["input"]),
    ])

    return {"intent": result.intent}


def retriever_node(state: AgentState) -> dict:
    """Retrieve relevant chunks and generate an answer with source citations."""
    docs = _query_docs(state["input"], k=5)

    context_str = _format_context(docs)
    sources = _extract_sources(docs)

    llm = ChatGroq(
        model=LLM_MODEL,
        temperature=0.1,
        groq_api_key=GROQ_API_KEY,
    )

    messages = [
        SystemMessage(content=RETRIEVER_SYSTEM_PROMPT),
        HumanMessage(
            content=(
                f"Context:\n{context_str}\n\n"
                f"Question: {state['input']}"
            )
        ),
    ]

    response = llm.invoke(messages)

    return {
        "context": [{"page_content": d.page_content, "metadata": d.metadata} for d in docs],
        "answer": response.content,
        "sources": sources,
        "diagram_code": "",
    }


def visualizer_node(state: AgentState) -> dict:
    """Retrieve context and generate a Mermaid.js diagram."""
    docs = _query_docs(state["input"], k=10)

    context_str = _format_context(docs)
    sources = _extract_sources(docs)

    llm = ChatGroq(
        model=LLM_MODEL,
        temperature=0,
        groq_api_key=GROQ_API_KEY,
    )

    messages = [
        SystemMessage(content=VISUALIZER_SYSTEM_PROMPT),
        HumanMessage(
            content=(
                f"Context:\n{context_str}\n\n"
                f"User request: {state['input']}"
            )
        ),
    ]

    response = llm.invoke(messages)

    # Clean up the response — strip any accidental markdown fences
    diagram_code = response.content.strip()
    if diagram_code.startswith("```"):
        lines = diagram_code.split("\n")
        # Remove first and last lines (``` markers)
        lines = [l for l in lines if not l.strip().startswith("```")]
        diagram_code = "\n".join(lines).strip()

    return {
        "context": [{"page_content": d.page_content, "metadata": d.metadata} for d in docs],
        "answer": "Here is the requested diagram:",
        "sources": sources,
        "diagram_code": diagram_code,
    }


# ---------------------------------------------------------------------------
# Routing logic
# ---------------------------------------------------------------------------

def route_by_intent(state: AgentState) -> str:
    """Conditional edge: route to retriever or visualizer based on intent."""
    if state.get("intent") == "generate_diagram":
        return "visualizer"
    return "retriever"


# ---------------------------------------------------------------------------
# Graph compilation
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    """Build and compile the Pulse agent graph."""
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("router", router_node)
    graph.add_node("retriever", retriever_node)
    graph.add_node("visualizer", visualizer_node)

    # Add edges
    graph.add_edge(START, "router")
    graph.add_conditional_edges(
        "router",
        route_by_intent,
        {
            "retriever": "retriever",
            "visualizer": "visualizer",
        },
    )
    graph.add_edge("retriever", END)
    graph.add_edge("visualizer", END)

    return graph.compile()


# Singleton compiled graph
agent = build_graph()
