"""Local embeddings using ChromaDB's bundled sentence-transformer model.

Uses all-MiniLM-L6-v2 via ONNX runtime — no API key required.
The model (~80 MB) is downloaded and cached on first use.
"""

import numpy as np
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
from langchain_core.embeddings import Embeddings


class LocalEmbeddings(Embeddings):
    """LangChain-compatible wrapper around ChromaDB's default embedding function."""

    def __init__(self) -> None:
        self._ef = DefaultEmbeddingFunction()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        # .tolist() on a numpy array recursively converts np.float32 → Python float
        return np.array(self._ef(texts), dtype=np.float64).tolist()  # type: ignore[arg-type]

    def embed_query(self, text: str) -> list[float]:
        return np.array(self._ef([text])[0], dtype=np.float64).tolist()  # type: ignore[index]
