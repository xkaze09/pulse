"""Document ingestion pipeline for the Pulse RAG agent.

Loads PDFs and Excel files from data/documents/, enriches metadata with URLs
from url_map.json, chunks the text, embeds with OpenAI, and stores in ChromaDB.

Usage:
    cd backend
    python -m src.ingest
"""

import src.compat  # noqa: F401 — must be first to patch pydantic v1 for Python 3.14+

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config import (
    CHROMA_PERSIST_DIR,
    COLLECTION_NAME,
    DOCUMENTS_DIR,
    EMBEDDING_MODEL,
    OPENAI_API_KEY,
    URL_MAP_PATH,
)


def load_url_map(url_map_path: Path) -> dict[str, str]:
    """Load the filename -> public URL mapping from JSON."""
    if not url_map_path.exists():
        print(f"Warning: URL map not found at {url_map_path}. URLs will not be attached.")
        return {}
    with open(url_map_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_excel(file_path: Path) -> list[Document]:
    """Load an Excel file (.xlsx / .xls) into LangChain Documents.

    Each sheet becomes one or more Documents. Row data is converted to readable
    text so the content is searchable and embeddable.
    """
    import openpyxl

    docs: list[Document] = []
    wb = openpyxl.load_workbook(str(file_path), read_only=True, data_only=True)

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue

        # Use first row as headers if it looks like a header row
        headers = [str(c) if c is not None else f"Col{i+1}" for i, c in enumerate(rows[0])]
        text_lines: list[str] = [f"Sheet: {sheet_name}", ""]

        for row_idx, row in enumerate(rows[1:], start=2):
            parts: list[str] = []
            for h, val in zip(headers, row):
                if val is not None:
                    parts.append(f"{h}: {val}")
            if parts:
                text_lines.append(f"Row {row_idx}: " + " | ".join(parts))

        if len(text_lines) > 2:  # more than just the header
            docs.append(
                Document(
                    page_content="\n".join(text_lines),
                    metadata={
                        "source": str(file_path),
                        "sheet": sheet_name,
                        "page": 0,
                    },
                )
            )

    wb.close()
    return docs


def load_documents(documents_dir: Path, url_map: dict[str, str]) -> list:
    """Load all PDFs and Excel files from the documents directory with enriched metadata."""
    all_docs = []

    # Collect supported files
    supported_extensions = (".pdf", ".xlsx", ".xls")
    files = [
        f for f in documents_dir.iterdir()
        if f.is_file() and f.suffix.lower() in supported_extensions
    ]

    if not files:
        print(f"No supported files found in {documents_dir}")
        print(f"  Supported formats: {', '.join(supported_extensions)}")
        return all_docs

    for file_path in sorted(files):
        print(f"Loading: {file_path.name}")
        ext = file_path.suffix.lower()

        if ext == ".pdf":
            loader = PyPDFLoader(str(file_path))
            docs = loader.load()
        elif ext in (".xlsx", ".xls"):
            docs = _load_excel(file_path)
        else:
            continue

        # Enrich metadata
        filename = file_path.name
        public_url = url_map.get(filename, "")

        for doc in docs:
            doc.metadata["url"] = public_url
            doc.metadata["filename"] = filename
            doc.metadata["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            if "page" not in doc.metadata:
                doc.metadata["page"] = 0

        all_docs.extend(docs)
        print(f"  Loaded {len(docs)} section(s) from {filename}")

    return all_docs


def chunk_documents(documents: list) -> list:
    """Split documents into chunks using token-based splitting."""
    splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        encoding_name="cl100k_base",
        chunk_size=1000,
        chunk_overlap=200,
    )
    chunks = splitter.split_documents(documents)
    print(f"Split {len(documents)} pages into {len(chunks)} chunks")
    return chunks


def create_vector_store(chunks: list) -> Chroma:
    """Create and persist a ChromaDB vector store from document chunks."""
    embeddings = OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        openai_api_key=OPENAI_API_KEY,
    )

    # Remove old store if it exists
    persist_dir = CHROMA_PERSIST_DIR
    if os.path.exists(persist_dir):
        import shutil
        shutil.rmtree(persist_dir)
        print(f"Removed existing vector store at {persist_dir}")

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=persist_dir,
        collection_name=COLLECTION_NAME,
    )

    print(f"Created vector store with {len(chunks)} chunks in '{COLLECTION_NAME}'")
    print(f"Persisted to: {persist_dir}")
    return vectorstore


def main():
    """Run the full ingestion pipeline."""
    print("=" * 60)
    print("Pulse - Document Ingestion Pipeline")
    print("=" * 60)

    # Step 1: Load URL map
    print("\n[1/4] Loading URL map...")
    url_map = load_url_map(URL_MAP_PATH)
    print(f"  Found {len(url_map)} URL mappings")

    # Step 2: Load documents
    print("\n[2/4] Loading documents...")
    documents = load_documents(DOCUMENTS_DIR, url_map)
    if not documents:
        print("No documents to ingest. Exiting.")
        return

    # Step 3: Chunk documents
    print("\n[3/4] Chunking documents...")
    chunks = chunk_documents(documents)

    # Step 4: Create vector store
    print("\n[4/4] Creating vector store...")
    create_vector_store(chunks)

    print("\n" + "=" * 60)
    print("Ingestion complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
