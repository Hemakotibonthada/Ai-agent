"""
Nexus AI OS - Retrieval-Augmented Generation Engine
Document ingestion (PDF, MD, TXT), chunking, embedding, context retrieval,
prompt construction with source attribution, and knowledge base management.
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

logger = logging.getLogger("nexus.models.rag_engine")

# ---------------------------------------------------------------------------
# Text extraction helpers
# ---------------------------------------------------------------------------


def extract_text_from_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def extract_text_from_markdown(file_path: str) -> str:
    text = extract_text_from_txt(file_path)
    # Strip common markdown syntax for cleaner embedding
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)  # images
    text = re.sub(r"\[([^\]]+)\]\(.*?\)", r"\1", text)  # links → anchor text
    text = re.sub(r"#{1,6}\s*", "", text)  # headers
    text = re.sub(r"[`]{1,3}", "", text)  # code fences
    text = re.sub(r"\*{1,2}([^*]+)\*{1,2}", r"\1", text)  # bold/italic
    return text


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using PyPDF2 if available, else empty string."""
    try:
        from PyPDF2 import PdfReader  # type: ignore
        reader = PdfReader(file_path)
        pages: List[str] = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages.append(t)
        return "\n\n".join(pages)
    except ImportError:
        logger.warning("PyPDF2 not installed; PDF ingestion unavailable")
        return ""
    except Exception as exc:
        logger.error("Error reading PDF %s: %s", file_path, exc)
        return ""


EXTRACTORS = {
    ".txt": extract_text_from_txt,
    ".md": extract_text_from_markdown,
    ".markdown": extract_text_from_markdown,
    ".pdf": extract_text_from_pdf,
}

# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

_HEADING_RE = re.compile(r"^#{1,6}\s", re.MULTILINE)


def chunk_text(
    text: str,
    chunk_size: int = 512,
    overlap: int = 64,
) -> List[str]:
    """Character-level chunking with paragraph-boundary awareness."""
    if not text.strip():
        return []
    if len(text) <= chunk_size:
        return [text.strip()]

    paragraphs = re.split(r"\n{2,}", text)
    chunks: List[str] = []
    current: List[str] = []
    current_len = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if current_len + len(para) + 2 > chunk_size and current:
            chunks.append("\n\n".join(current))
            # build overlap buffer
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
        current_len += len(para) + 2

    if current:
        chunks.append("\n\n".join(current))
    return chunks


def chunk_by_heading(text: str, max_chunk: int = 1500) -> List[Dict[str, str]]:
    """Split markdown by headings, keeping heading as metadata."""
    sections: List[Dict[str, str]] = []
    parts = _HEADING_RE.split(text)
    headings = _HEADING_RE.findall(text)

    for i, part in enumerate(parts):
        part = part.strip()
        if not part:
            continue
        heading = headings[i - 1].strip() if i > 0 and i - 1 < len(headings) else "Introduction"
        if len(part) > max_chunk:
            sub_chunks = chunk_text(part, chunk_size=max_chunk)
            for j, sc in enumerate(sub_chunks):
                sections.append({"heading": f"{heading} (part {j + 1})", "text": sc})
        else:
            sections.append({"heading": heading, "text": part})
    return sections


# ---------------------------------------------------------------------------
# Document record
# ---------------------------------------------------------------------------

class DocumentRecord:
    def __init__(
        self,
        doc_id: str,
        source_path: str,
        title: str = "",
        doc_type: str = "txt",
        chunk_count: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.doc_id = doc_id
        self.source_path = source_path
        self.title = title or os.path.basename(source_path)
        self.doc_type = doc_type
        self.chunk_count = chunk_count
        self.metadata = metadata or {}
        self.ingested_at = datetime.now(timezone.utc).isoformat()
        self.content_hash = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "source_path": self.source_path,
            "title": self.title,
            "doc_type": self.doc_type,
            "chunk_count": self.chunk_count,
            "metadata": self.metadata,
            "ingested_at": self.ingested_at,
            "content_hash": self.content_hash,
        }


# ---------------------------------------------------------------------------
# RAG Engine
# ---------------------------------------------------------------------------

class RAGEngine:
    """Retrieval-Augmented Generation: ingest documents, retrieve context, build prompts."""

    def __init__(
        self,
        embedding_model: Any = None,
        persist_dir: str = "./data/rag",
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        top_k: int = 5,
        min_relevance: float = 0.3,
    ) -> None:
        self.embedding_model = embedding_model  # EmbeddingModel instance
        self.persist_dir = persist_dir
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.top_k = top_k
        self.min_relevance = min_relevance
        self.documents: Dict[str, DocumentRecord] = {}
        self._index_path = os.path.join(persist_dir, "rag_index.json")
        os.makedirs(persist_dir, exist_ok=True)
        self._load_index()

    # -- index persistence ---------------------------------------------------

    def _load_index(self) -> None:
        if not os.path.exists(self._index_path):
            return
        try:
            with open(self._index_path) as f:
                data = json.load(f)
            for entry in data.get("documents", []):
                rec = DocumentRecord(
                    doc_id=entry["doc_id"],
                    source_path=entry["source_path"],
                    title=entry.get("title", ""),
                    doc_type=entry.get("doc_type", "txt"),
                    chunk_count=entry.get("chunk_count", 0),
                    metadata=entry.get("metadata", {}),
                )
                rec.ingested_at = entry.get("ingested_at", "")
                rec.content_hash = entry.get("content_hash", "")
                self.documents[rec.doc_id] = rec
            logger.info("RAG index loaded: %d documents", len(self.documents))
        except Exception as exc:
            logger.error("Failed to load RAG index: %s", exc)

    def _save_index(self) -> None:
        data = {"documents": [d.to_dict() for d in self.documents.values()]}
        with open(self._index_path, "w") as f:
            json.dump(data, f, indent=2)

    # -- ingestion -----------------------------------------------------------

    def ingest_file(
        self,
        file_path: str,
        title: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            return {"error": f"File not found: {file_path}"}

        ext = path.suffix.lower()
        extractor = EXTRACTORS.get(ext)
        if extractor is None:
            return {"error": f"Unsupported file type: {ext}"}

        text = extractor(str(path))
        if not text.strip():
            return {"error": "No text extracted from document"}

        content_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
        doc_id = f"doc_{content_hash}"

        # check for duplicate content
        for existing in self.documents.values():
            if existing.content_hash == content_hash:
                return {"status": "skipped", "reason": "duplicate", "doc_id": existing.doc_id}

        chunks = chunk_text(text, chunk_size=self.chunk_size, overlap=self.chunk_overlap)
        if not chunks:
            return {"error": "No chunks produced"}

        if self.embedding_model is not None:
            doc_meta = {
                **(metadata or {}),
                "source": str(path),
                "title": title or path.name,
                "type": "rag_document",
            }
            indexed = self.embedding_model.index_text(
                text, doc_id, metadata=doc_meta, chunk_size=self.chunk_size, overlap=self.chunk_overlap
            )
        else:
            indexed = len(chunks)

        rec = DocumentRecord(
            doc_id=doc_id,
            source_path=str(path),
            title=title or path.name,
            doc_type=ext.lstrip("."),
            chunk_count=indexed,
            metadata=metadata or {},
        )
        rec.content_hash = content_hash
        self.documents[doc_id] = rec
        self._save_index()

        logger.info("Ingested %s → %d chunks", path.name, indexed)
        return {"status": "ingested", "doc_id": doc_id, "chunks": indexed, "title": rec.title}

    def ingest_text(
        self,
        text: str,
        doc_id: Optional[str] = None,
        title: str = "Untitled",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        content_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
        doc_id = doc_id or f"doc_{content_hash}"
        chunks = chunk_text(text, chunk_size=self.chunk_size, overlap=self.chunk_overlap)
        if not chunks:
            return {"error": "No chunks produced"}

        if self.embedding_model is not None:
            doc_meta = {**(metadata or {}), "title": title, "type": "rag_document"}
            indexed = self.embedding_model.index_text(
                text, doc_id, metadata=doc_meta, chunk_size=self.chunk_size, overlap=self.chunk_overlap
            )
        else:
            indexed = len(chunks)

        rec = DocumentRecord(
            doc_id=doc_id, source_path="<inline>", title=title,
            doc_type="txt", chunk_count=indexed, metadata=metadata or {},
        )
        rec.content_hash = content_hash
        self.documents[doc_id] = rec
        self._save_index()
        return {"status": "ingested", "doc_id": doc_id, "chunks": indexed}

    def ingest_directory(
        self,
        directory: str,
        extensions: Optional[List[str]] = None,
        recursive: bool = True,
    ) -> Dict[str, Any]:
        exts = extensions or [".txt", ".md", ".pdf"]
        results: List[Dict[str, Any]] = []
        base = Path(directory)
        pattern = "**/*" if recursive else "*"
        for path in base.glob(pattern):
            if path.is_file() and path.suffix.lower() in exts:
                result = self.ingest_file(str(path))
                results.append(result)
        ingested = sum(1 for r in results if r.get("status") == "ingested")
        skipped = sum(1 for r in results if r.get("status") == "skipped")
        errors = sum(1 for r in results if "error" in r)
        return {
            "total_files": len(results),
            "ingested": ingested,
            "skipped": skipped,
            "errors": errors,
            "details": results,
        }

    # -- retrieval -----------------------------------------------------------

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        min_score: Optional[float] = None,
        doc_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if self.embedding_model is None:
            logger.warning("No embedding model configured; retrieval unavailable")
            return []

        k = top_k or self.top_k
        score = min_score or self.min_relevance

        filter_fn = None
        if doc_filter:
            filter_fn = lambda m: m.get("source_id", "").startswith(doc_filter) or m.get("title", "") == doc_filter

        results = self.embedding_model.search(query, top_k=k, min_score=score, filter_fn=filter_fn)
        return results

    def retrieve_with_sources(
        self,
        query: str,
        top_k: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, str]]]:
        results = self.retrieve(query, top_k=top_k)
        sources: List[Dict[str, str]] = []
        seen: set = set()
        for r in results:
            source_id = r.get("source_id", r.get("id", ""))
            if source_id not in seen:
                seen.add(source_id)
                title = r.get("title", source_id)
                sources.append({"id": source_id, "title": title, "score": str(r.get("score", 0))})
        return results, sources

    # -- prompt construction -------------------------------------------------

    def build_augmented_prompt(
        self,
        query: str,
        top_k: Optional[int] = None,
        system_prefix: str = "",
        include_sources: bool = True,
    ) -> Dict[str, Any]:
        results, sources = self.retrieve_with_sources(query, top_k=top_k)

        if not results:
            return {
                "prompt": query,
                "system": system_prefix,
                "context_used": False,
                "sources": [],
            }

        context_parts: List[str] = []
        for i, r in enumerate(results, 1):
            text = r.get("text", "")
            title = r.get("title", "Unknown")
            context_parts.append(f"[Source {i}: {title}]\n{text}")

        context_block = "\n\n---\n\n".join(context_parts)

        system = (
            f"{system_prefix}\n\n"
            "You have access to the following reference material. "
            "Use it to answer the user's question accurately. "
            "Cite sources using [Source N] notation when applicable.\n\n"
            f"--- REFERENCE MATERIAL ---\n{context_block}\n--- END REFERENCE ---"
        )

        result: Dict[str, Any] = {
            "prompt": query,
            "system": system,
            "context_used": True,
            "chunks_used": len(results),
        }
        if include_sources:
            result["sources"] = sources
        return result

    # -- knowledge base management -------------------------------------------

    def list_documents(self) -> List[Dict[str, Any]]:
        return [d.to_dict() for d in self.documents.values()]

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        rec = self.documents.get(doc_id)
        return rec.to_dict() if rec else None

    def remove_document(self, doc_id: str) -> bool:
        if doc_id not in self.documents:
            return False
        if self.embedding_model is not None:
            self.embedding_model.remove_document(doc_id)
        del self.documents[doc_id]
        self._save_index()
        return True

    def clear_all(self) -> None:
        if self.embedding_model is not None:
            self.embedding_model.clear()
        self.documents.clear()
        self._save_index()

    def reindex(self) -> Dict[str, Any]:
        """Re-ingest all documents (useful after embedding model change)."""
        docs = list(self.documents.values())
        if self.embedding_model is not None:
            self.embedding_model.clear()
        self.documents.clear()

        results: List[Dict[str, Any]] = []
        for doc in docs:
            if doc.source_path == "<inline>":
                continue
            result = self.ingest_file(doc.source_path, title=doc.title, metadata=doc.metadata)
            results.append(result)

        self._save_index()
        if self.embedding_model is not None:
            self.embedding_model.save()
        return {"reindexed": len(results), "details": results}

    # -- stats ---------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        total_chunks = sum(d.chunk_count for d in self.documents.values())
        return {
            "document_count": len(self.documents),
            "total_chunks": total_chunks,
            "chunk_size": self.chunk_size,
            "chunk_overlap": self.chunk_overlap,
            "top_k": self.top_k,
            "min_relevance": self.min_relevance,
            "embedding_model_available": self.embedding_model is not None,
            "persist_dir": self.persist_dir,
        }
