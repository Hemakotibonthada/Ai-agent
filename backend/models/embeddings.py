"""
Nexus AI OS - Local Embedding Model
Sentence-transformers integration with numpy-based vector storage,
similarity search, document chunking, and semantic search.
"""

import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("nexus.models.embeddings")

# ---------------------------------------------------------------------------
# Chunking helpers
# ---------------------------------------------------------------------------

_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+")


def chunk_text(
    text: str,
    chunk_size: int = 512,
    overlap: int = 64,
    separator: str = "\n",
) -> List[str]:
    """Split *text* into overlapping chunks of roughly *chunk_size* characters."""
    if len(text) <= chunk_size:
        return [text.strip()] if text.strip() else []

    paragraphs = text.split(separator)
    chunks: List[str] = []
    current: List[str] = []
    current_len = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if current_len + len(para) + 1 > chunk_size and current:
            chunks.append(separator.join(current))
            # keep last *overlap* characters worth of paragraphs for context
            overlap_buf: List[str] = []
            overlap_len = 0
            for p in reversed(current):
                if overlap_len + len(p) > overlap:
                    break
                overlap_buf.insert(0, p)
                overlap_len += len(p)
            current = overlap_buf
            current_len = overlap_len
        current.append(para)
        current_len += len(para) + 1

    if current:
        chunks.append(separator.join(current))
    return chunks


def chunk_sentences(text: str, max_sentences: int = 5, overlap: int = 1) -> List[str]:
    """Chunk by sentence boundaries."""
    sentences = _SENTENCE_BOUNDARY.split(text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if len(sentences) <= max_sentences:
        return [" ".join(sentences)] if sentences else []
    chunks: List[str] = []
    i = 0
    while i < len(sentences):
        chunk = sentences[i : i + max_sentences]
        chunks.append(" ".join(chunk))
        i += max_sentences - overlap
    return chunks


# ---------------------------------------------------------------------------
# Cosine similarity / nearest-neighbour helpers
# ---------------------------------------------------------------------------


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def cosine_similarity_batch(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Return cosine similarities between *query* (1-D) and each row of *matrix*."""
    norms = np.linalg.norm(matrix, axis=1)
    norms[norms == 0] = 1.0
    query_norm = np.linalg.norm(query)
    if query_norm == 0:
        return np.zeros(matrix.shape[0])
    return np.dot(matrix, query) / (norms * query_norm)


# ---------------------------------------------------------------------------
# In-memory vector store with disk persistence
# ---------------------------------------------------------------------------


class VectorStore:
    """Simple numpy-backed vector store with JSON metadata and disk persistence."""

    def __init__(self, persist_dir: Optional[str] = None) -> None:
        self.vectors: Optional[np.ndarray] = None  # (N, D)
        self.metadata: List[Dict[str, Any]] = []
        self.ids: List[str] = []
        self.dimension: int = 0
        self.persist_dir = persist_dir
        if persist_dir:
            os.makedirs(persist_dir, exist_ok=True)

    # -- persistence ---------------------------------------------------------

    def save(self) -> None:
        if not self.persist_dir or self.vectors is None:
            return
        np.save(os.path.join(self.persist_dir, "vectors.npy"), self.vectors)
        with open(os.path.join(self.persist_dir, "metadata.json"), "w") as f:
            json.dump({"ids": self.ids, "metadata": self.metadata, "dimension": self.dimension}, f)
        logger.info("VectorStore saved %d vectors to %s", len(self.ids), self.persist_dir)

    def load(self) -> bool:
        if not self.persist_dir:
            return False
        vec_path = os.path.join(self.persist_dir, "vectors.npy")
        meta_path = os.path.join(self.persist_dir, "metadata.json")
        if not os.path.exists(vec_path) or not os.path.exists(meta_path):
            return False
        self.vectors = np.load(vec_path)
        with open(meta_path) as f:
            data = json.load(f)
        self.ids = data["ids"]
        self.metadata = data["metadata"]
        self.dimension = data["dimension"]
        logger.info("VectorStore loaded %d vectors from %s", len(self.ids), self.persist_dir)
        return True

    # -- CRUD ----------------------------------------------------------------

    def add(self, vector: np.ndarray, doc_id: str, meta: Optional[Dict[str, Any]] = None) -> None:
        vec = np.asarray(vector, dtype=np.float32)
        if self.vectors is None:
            self.dimension = vec.shape[0]
            self.vectors = vec.reshape(1, -1)
        else:
            if vec.shape[0] != self.dimension:
                raise ValueError(f"Dimension mismatch: expected {self.dimension}, got {vec.shape[0]}")
            self.vectors = np.vstack([self.vectors, vec.reshape(1, -1)])
        self.ids.append(doc_id)
        self.metadata.append(meta or {})

    def add_batch(
        self,
        vectors: np.ndarray,
        doc_ids: List[str],
        metas: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        vecs = np.asarray(vectors, dtype=np.float32)
        if vecs.ndim == 1:
            vecs = vecs.reshape(1, -1)
        if self.vectors is None:
            self.dimension = vecs.shape[1]
            self.vectors = vecs
        else:
            if vecs.shape[1] != self.dimension:
                raise ValueError(f"Dimension mismatch: expected {self.dimension}, got {vecs.shape[1]}")
            self.vectors = np.vstack([self.vectors, vecs])
        self.ids.extend(doc_ids)
        if metas:
            self.metadata.extend(metas)
        else:
            self.metadata.extend([{} for _ in doc_ids])

    def remove(self, doc_id: str) -> bool:
        if doc_id not in self.ids:
            return False
        idx = self.ids.index(doc_id)
        self.ids.pop(idx)
        self.metadata.pop(idx)
        if self.vectors is not None:
            self.vectors = np.delete(self.vectors, idx, axis=0)
            if self.vectors.shape[0] == 0:
                self.vectors = None
        return True

    def clear(self) -> None:
        self.vectors = None
        self.ids.clear()
        self.metadata.clear()
        self.dimension = 0

    @property
    def size(self) -> int:
        return len(self.ids)

    # -- search --------------------------------------------------------------

    def search(
        self,
        query_vector: np.ndarray,
        top_k: int = 5,
        min_score: float = 0.0,
        filter_fn: Optional[Any] = None,
    ) -> List[Tuple[str, float, Dict[str, Any]]]:
        if self.vectors is None or self.size == 0:
            return []
        q = np.asarray(query_vector, dtype=np.float32)
        scores = cosine_similarity_batch(q, self.vectors)
        indices = np.argsort(scores)[::-1]

        results: List[Tuple[str, float, Dict[str, Any]]] = []
        for idx in indices:
            if scores[idx] < min_score:
                break
            meta = self.metadata[idx]
            if filter_fn and not filter_fn(meta):
                continue
            results.append((self.ids[idx], float(scores[idx]), meta))
            if len(results) >= top_k:
                break
        return results

    def get_by_id(self, doc_id: str) -> Optional[Tuple[np.ndarray, Dict[str, Any]]]:
        if doc_id not in self.ids:
            return None
        idx = self.ids.index(doc_id)
        return self.vectors[idx], self.metadata[idx]  # type: ignore[index]

    def stats(self) -> Dict[str, Any]:
        return {
            "size": self.size,
            "dimension": self.dimension,
            "memory_bytes": int(self.vectors.nbytes) if self.vectors is not None else 0,
            "persist_dir": self.persist_dir,
        }


# ---------------------------------------------------------------------------
# Embedding model wrapper (sentence-transformers)
# ---------------------------------------------------------------------------

class EmbeddingModel:
    """Wraps a sentence-transformers model for embedding generation and search."""

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        persist_dir: str = "./data/embeddings",
        device: str = "cpu",
    ) -> None:
        self.model_name = model_name
        self.device = device
        self._model: Any = None
        self.store = VectorStore(persist_dir=persist_dir)
        self._loaded = False

    # -- lazy load -----------------------------------------------------------

    def _ensure_model(self) -> None:
        if self._model is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
            self._model = SentenceTransformer(self.model_name, device=self.device)
            self._loaded = True
            logger.info("Loaded embedding model %s on %s", self.model_name, self.device)
        except ImportError:
            logger.warning("sentence-transformers not installed; falling back to random embeddings for dev")
            self._model = None
            self._loaded = False

    # -- embedding -----------------------------------------------------------

    def embed(self, text: str) -> np.ndarray:
        self._ensure_model()
        if self._model is not None:
            return self._model.encode(text, convert_to_numpy=True).astype(np.float32)
        # fallback: deterministic pseudo-embedding based on text hash
        h = int(hashlib.sha256(text.encode()).hexdigest(), 16)
        rng = np.random.RandomState(h % (2**31))
        return rng.randn(384).astype(np.float32)

    def embed_batch(self, texts: List[str]) -> np.ndarray:
        self._ensure_model()
        if self._model is not None:
            return self._model.encode(texts, convert_to_numpy=True, batch_size=64).astype(np.float32)
        return np.array([self.embed(t) for t in texts], dtype=np.float32)

    # -- indexing ------------------------------------------------------------

    def index_text(
        self,
        text: str,
        doc_id: str,
        metadata: Optional[Dict[str, Any]] = None,
        chunk: bool = True,
        chunk_size: int = 512,
        overlap: int = 64,
    ) -> int:
        if chunk:
            chunks = chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        else:
            chunks = [text]
        if not chunks:
            return 0
        vectors = self.embed_batch(chunks)
        for i, (vec, c) in enumerate(zip(vectors, chunks)):
            cid = f"{doc_id}__chunk_{i}"
            meta = {**(metadata or {}), "text": c, "chunk_index": i, "source_id": doc_id}
            self.store.add(vec, cid, meta)
        return len(chunks)

    def index_documents(
        self,
        documents: List[Dict[str, Any]],
        id_field: str = "id",
        text_field: str = "text",
        chunk: bool = True,
    ) -> int:
        total = 0
        for doc in documents:
            doc_id = doc.get(id_field, hashlib.md5(doc[text_field].encode()).hexdigest())
            meta = {k: v for k, v in doc.items() if k != text_field}
            total += self.index_text(doc[text_field], doc_id, metadata=meta, chunk=chunk)
        return total

    # -- search --------------------------------------------------------------

    def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.3,
        filter_fn: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        qvec = self.embed(query)
        results = self.store.search(qvec, top_k=top_k, min_score=min_score, filter_fn=filter_fn)
        return [
            {"id": rid, "score": round(score, 4), **meta}
            for rid, score, meta in results
        ]

    def semantic_search(
        self,
        query: str,
        top_k: int = 5,
        context_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        filter_fn = None
        if context_type:
            filter_fn = lambda m: m.get("type") == context_type
        return self.search(query, top_k=top_k, filter_fn=filter_fn)

    def find_similar(self, doc_id: str, top_k: int = 5) -> List[Dict[str, Any]]:
        result = self.store.get_by_id(doc_id)
        if result is None:
            return []
        vec, _ = result
        results = self.store.search(vec, top_k=top_k + 1)
        return [
            {"id": rid, "score": round(score, 4), **meta}
            for rid, score, meta in results
            if rid != doc_id
        ][:top_k]

    # -- management ----------------------------------------------------------

    def remove_document(self, doc_id: str) -> int:
        to_remove = [sid for sid in self.store.ids if sid == doc_id or sid.startswith(f"{doc_id}__chunk_")]
        for sid in to_remove:
            self.store.remove(sid)
        return len(to_remove)

    def save(self) -> None:
        self.store.save()

    def load(self) -> bool:
        return self.store.load()

    def stats(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "device": self.device,
            "model_loaded": self._loaded,
            "store": self.store.stats(),
        }

    def clear(self) -> None:
        self.store.clear()
