# NEXUS AI - AI Service
"""
Manages local AI models via Ollama for inference, model management,
chat completion, embeddings, and RAG pipeline operations.
Provides the core AI backbone for all NEXUS agents.
"""

import asyncio
import hashlib
import json
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import aiohttp
from loguru import logger

from core.config import NexusSettings, settings
from core.events import Event, EventBus, EventCategory, EventPriority, event_bus
from core.logger import nexus_logger


class ModelInfo:
    """Container for loaded model metadata."""

    def __init__(self, name: str, size: int = 0, digest: str = "",
                 modified_at: str = "", family: str = "",
                 parameter_size: str = "", quantization: str = ""):
        self.name: str = name
        self.size: int = size
        self.digest: str = digest
        self.modified_at: str = modified_at
        self.family: str = family
        self.parameter_size: str = parameter_size
        self.quantization: str = quantization

    def to_dict(self) -> Dict[str, Any]:
        """Serialize model info to dictionary."""
        return {
            "name": self.name,
            "size": self.size,
            "digest": self.digest,
            "modified_at": self.modified_at,
            "family": self.family,
            "parameter_size": self.parameter_size,
            "quantization": self.quantization,
        }


class EmbeddingCache:
    """In-memory LRU cache for embedding vectors to avoid recomputation."""

    def __init__(self, max_size: int = 10000):
        self._cache: Dict[str, List[float]] = {}
        self._access_order: List[str] = []
        self._max_size: int = max_size
        self._hits: int = 0
        self._misses: int = 0

    def _compute_key(self, text: str, model: str) -> str:
        """Compute a deterministic cache key for text+model pair."""
        raw = f"{model}::{text}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, text: str, model: str) -> Optional[List[float]]:
        """Retrieve cached embedding if available."""
        key = self._compute_key(text, model)
        if key in self._cache:
            self._hits += 1
            self._access_order.remove(key)
            self._access_order.append(key)
            return self._cache[key]
        self._misses += 1
        return None

    def put(self, text: str, model: str, embedding: List[float]) -> None:
        """Store embedding in cache, evicting oldest if at capacity."""
        key = self._compute_key(text, model)
        if key in self._cache:
            self._access_order.remove(key)
        elif len(self._cache) >= self._max_size:
            oldest = self._access_order.pop(0)
            del self._cache[oldest]
        self._cache[key] = embedding
        self._access_order.append(key)

    def clear(self) -> None:
        """Clear the entire cache."""
        self._cache.clear()
        self._access_order.clear()
        self._hits = 0
        self._misses = 0

    @property
    def stats(self) -> Dict[str, int]:
        """Return cache hit/miss statistics."""
        total = self._hits + self._misses
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total, 4) if total > 0 else 0.0,
        }


class ConversationMemory:
    """Sliding-window conversation memory for context management."""

    def __init__(self, max_messages: int = 50, max_tokens_estimate: int = 8000):
        self._conversations: Dict[str, List[Dict[str, str]]] = {}
        self._max_messages: int = max_messages
        self._max_tokens_estimate: int = max_tokens_estimate

    def add_message(self, conversation_id: str, role: str, content: str) -> None:
        """Add a message to the conversation history."""
        if conversation_id not in self._conversations:
            self._conversations[conversation_id] = []
        self._conversations[conversation_id].append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        })
        self._trim(conversation_id)

    def get_history(self, conversation_id: str, limit: Optional[int] = None) -> List[Dict[str, str]]:
        """Retrieve conversation history, optionally limited."""
        history = self._conversations.get(conversation_id, [])
        if limit:
            return history[-limit:]
        return list(history)

    def clear(self, conversation_id: str) -> None:
        """Clear a specific conversation history."""
        self._conversations.pop(conversation_id, None)

    def clear_all(self) -> None:
        """Clear all conversation histories."""
        self._conversations.clear()

    def _trim(self, conversation_id: str) -> None:
        """Trim conversation to stay within limits."""
        msgs = self._conversations[conversation_id]
        if len(msgs) > self._max_messages:
            self._conversations[conversation_id] = msgs[-self._max_messages:]
        total_chars = sum(len(m["content"]) for m in self._conversations[conversation_id])
        estimated_tokens = total_chars // 4
        while estimated_tokens > self._max_tokens_estimate and len(self._conversations[conversation_id]) > 2:
            self._conversations[conversation_id].pop(0)
            total_chars = sum(len(m["content"]) for m in self._conversations[conversation_id])
            estimated_tokens = total_chars // 4

    @property
    def active_conversations(self) -> int:
        """Number of active conversations in memory."""
        return len(self._conversations)


class AIService:
    """
    Core AI service managing local Ollama models.

    Provides:
    - Chat completion with streaming support
    - Text embedding generation with caching
    - Model lifecycle management (pull, delete, list)
    - RAG pipeline with context retrieval
    - Conversation memory management
    - Health monitoring of the Ollama backend
    """

    def __init__(self, config: Optional[NexusSettings] = None,
                 event_bus_instance: Optional[EventBus] = None):
        self._config: NexusSettings = config or settings
        self._event_bus: EventBus = event_bus_instance or event_bus
        self._ollama_url: str = self._config.ollama.base_url
        self._default_model: str = self._config.ollama.model
        self._embedding_model: str = self._config.ollama.embedding_model
        self._vision_model: str = self._config.ollama.vision_model
        self._timeout: int = self._config.ollama.timeout
        self._max_retries: int = self._config.ollama.max_retries
        self._session: Optional[aiohttp.ClientSession] = None
        self._embedding_cache: EmbeddingCache = EmbeddingCache(max_size=10000)
        self._conversation_memory: ConversationMemory = ConversationMemory()
        self._available_models: List[ModelInfo] = []
        self._initialized: bool = False
        self._healthy: bool = False
        self._request_count: int = 0
        self._error_count: int = 0
        self._total_tokens: int = 0
        self._total_inference_ms: float = 0.0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize the AI service, verify Ollama connectivity, and cache model list."""
        try:
            logger.info("Initializing AIService...")
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self._timeout)
            )
            self._healthy = await self._check_ollama_health()
            if self._healthy:
                await self._refresh_model_list()
                await self._ensure_default_models()
                logger.info(
                    f"AIService initialized — {len(self._available_models)} models available"
                )
            else:
                logger.warning(
                    "AIService initialized in degraded mode — Ollama not reachable"
                )
            self._initialized = True
            await self._event_bus.emit(
                "ai.initialized",
                {"healthy": self._healthy, "models": len(self._available_models)},
                source="ai_service",
                category=EventCategory.SYSTEM,
            )
        except Exception as exc:
            logger.error(f"AIService initialization failed: {exc}")
            self._initialized = True
            self._healthy = False

    async def shutdown(self) -> None:
        """Gracefully close HTTP session and release resources."""
        try:
            logger.info("Shutting down AIService...")
            if self._session and not self._session.closed:
                await self._session.close()
            self._embedding_cache.clear()
            self._conversation_memory.clear_all()
            self._initialized = False
            self._healthy = False
            logger.info("AIService shut down complete")
        except Exception as exc:
            logger.error(f"Error during AIService shutdown: {exc}")

    # ------------------------------------------------------------------
    # Health & Status
    # ------------------------------------------------------------------

    async def _check_ollama_health(self) -> bool:
        """Ping Ollama to verify it is running."""
        try:
            if not self._session:
                return False
            async with self._session.get(f"{self._ollama_url}/api/tags") as resp:
                return resp.status == 200
        except Exception:
            return False

    async def health_check(self) -> Dict[str, Any]:
        """Return comprehensive health information."""
        self._healthy = await self._check_ollama_health()
        return {
            "service": "ai_service",
            "healthy": self._healthy,
            "ollama_url": self._ollama_url,
            "default_model": self._default_model,
            "embedding_model": self._embedding_model,
            "models_loaded": len(self._available_models),
            "request_count": self._request_count,
            "error_count": self._error_count,
            "total_tokens": self._total_tokens,
            "avg_inference_ms": (
                round(self._total_inference_ms / self._request_count, 2)
                if self._request_count > 0 else 0.0
            ),
            "embedding_cache": self._embedding_cache.stats,
            "active_conversations": self._conversation_memory.active_conversations,
        }

    # ------------------------------------------------------------------
    # Model Management
    # ------------------------------------------------------------------

    async def _refresh_model_list(self) -> None:
        """Fetch and cache the list of models available in Ollama."""
        try:
            if not self._session:
                return
            async with self._session.get(f"{self._ollama_url}/api/tags") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self._available_models = [
                        ModelInfo(
                            name=m.get("name", ""),
                            size=m.get("size", 0),
                            digest=m.get("digest", ""),
                            modified_at=m.get("modified_at", ""),
                            family=m.get("details", {}).get("family", ""),
                            parameter_size=m.get("details", {}).get("parameter_size", ""),
                            quantization=m.get("details", {}).get("quantization_level", ""),
                        )
                        for m in data.get("models", [])
                    ]
        except Exception as exc:
            logger.error(f"Failed to refresh model list: {exc}")

    async def _ensure_default_models(self) -> None:
        """Pull default models if they are not yet available locally."""
        available_names = {m.name for m in self._available_models}
        required = [self._default_model, self._embedding_model]
        for model_name in required:
            if model_name not in available_names:
                logger.info(f"Model '{model_name}' not found locally — pulling...")
                await self.pull_model(model_name)

    async def pull_model(self, model_name: str) -> bool:
        """
        Pull a model from the Ollama registry.

        Args:
            model_name: Name of the model to pull (e.g. 'llama3.1').

        Returns:
            True if the pull succeeded.
        """
        try:
            logger.info(f"Pulling model: {model_name}")
            if not self._session:
                return False
            payload = {"name": model_name}
            async with self._session.post(
                f"{self._ollama_url}/api/pull", json=payload
            ) as resp:
                if resp.status == 200:
                    async for line in resp.content:
                        decoded = line.decode("utf-8").strip()
                        if decoded:
                            try:
                                progress = json.loads(decoded)
                                status = progress.get("status", "")
                                if "pulling" in status or "downloading" in status:
                                    logger.debug(f"Pull progress for {model_name}: {status}")
                            except json.JSONDecodeError:
                                pass
                    await self._refresh_model_list()
                    await self._event_bus.emit(
                        "ai.model_pulled",
                        {"model": model_name},
                        source="ai_service",
                        category=EventCategory.SYSTEM,
                    )
                    logger.info(f"Model pulled successfully: {model_name}")
                    return True
                else:
                    body = await resp.text()
                    logger.error(f"Failed to pull model {model_name}: {resp.status} - {body}")
                    return False
        except Exception as exc:
            logger.error(f"Error pulling model {model_name}: {exc}")
            return False

    async def delete_model(self, model_name: str) -> bool:
        """
        Delete a model from local Ollama storage.

        Args:
            model_name: Name of the model to delete.

        Returns:
            True if deletion succeeded.
        """
        try:
            if not self._session:
                return False
            async with self._session.delete(
                f"{self._ollama_url}/api/delete", json={"name": model_name}
            ) as resp:
                if resp.status == 200:
                    await self._refresh_model_list()
                    logger.info(f"Model deleted: {model_name}")
                    return True
                else:
                    logger.error(f"Failed to delete model {model_name}: {resp.status}")
                    return False
        except Exception as exc:
            logger.error(f"Error deleting model {model_name}: {exc}")
            return False

    async def list_models(self) -> List[Dict[str, Any]]:
        """
        List all locally available models.

        Returns:
            List of model information dictionaries.
        """
        await self._refresh_model_list()
        return [m.to_dict() for m in self._available_models]

    async def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific model.

        Args:
            model_name: Name of the model.

        Returns:
            Model detail dict or None.
        """
        try:
            if not self._session:
                return None
            async with self._session.post(
                f"{self._ollama_url}/api/show", json={"name": model_name}
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return None
        except Exception as exc:
            logger.error(f"Error getting model info for {model_name}: {exc}")
            return None

    # ------------------------------------------------------------------
    # Chat Completion
    # ------------------------------------------------------------------

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None,
        stream: bool = False,
    ) -> Dict[str, Any]:
        """
        Send a chat completion request to Ollama.

        Args:
            messages: List of message dicts with 'role' and 'content'.
            model: Model to use; defaults to configured primary model.
            temperature: Sampling temperature (0.0–2.0).
            max_tokens: Maximum tokens in the response.
            system_prompt: Optional system-level instruction.
            conversation_id: Track in conversation memory when provided.
            stream: If True, returns an async generator instead.

        Returns:
            Dictionary with 'content', 'model', 'tokens', 'duration_ms'.
        """
        model = model or self._default_model
        start_time = time.monotonic()

        full_messages: List[Dict[str, str]] = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})

        if conversation_id:
            history = self._conversation_memory.get_history(conversation_id)
            full_messages.extend(history)

        full_messages.extend(messages)

        payload = {
            "model": model,
            "messages": full_messages,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
            "stream": False,
        }

        for attempt in range(1, self._max_retries + 1):
            try:
                if not self._session:
                    raise RuntimeError("AIService session not initialised")

                async with self._session.post(
                    f"{self._ollama_url}/api/chat", json=payload
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        elapsed_ms = (time.monotonic() - start_time) * 1000
                        content = data.get("message", {}).get("content", "")
                        tokens = data.get("eval_count", 0)

                        self._request_count += 1
                        self._total_tokens += tokens
                        self._total_inference_ms += elapsed_ms

                        if conversation_id:
                            for msg in messages:
                                self._conversation_memory.add_message(
                                    conversation_id, msg["role"], msg["content"]
                                )
                            self._conversation_memory.add_message(
                                conversation_id, "assistant", content
                            )

                        nexus_logger.log_agent_action(
                            "ai_service", "chat_completion",
                            input_data=messages[-1].get("content", "")[:200] if messages else "",
                            output_data=content[:200],
                            duration_ms=elapsed_ms,
                        )

                        return {
                            "content": content,
                            "model": model,
                            "tokens": tokens,
                            "duration_ms": round(elapsed_ms, 2),
                            "finish_reason": "stop",
                        }
                    else:
                        body = await resp.text()
                        logger.warning(
                            f"Chat completion attempt {attempt} failed ({resp.status}): {body}"
                        )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning(f"Chat completion attempt {attempt} error: {exc}")

            if attempt < self._max_retries:
                await asyncio.sleep(min(2 ** attempt, 10))

        self._error_count += 1
        logger.error("Chat completion failed after all retries")
        return {
            "content": "I'm sorry, I'm having trouble processing your request right now.",
            "model": model,
            "tokens": 0,
            "duration_ms": round((time.monotonic() - start_time) * 1000, 2),
            "finish_reason": "error",
            "error": "All retry attempts exhausted",
        }

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completion tokens one chunk at a time.

        Yields:
            Individual text chunks as they are generated.
        """
        model = model or self._default_model
        start_time = time.monotonic()

        full_messages: List[Dict[str, str]] = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        if conversation_id:
            history = self._conversation_memory.get_history(conversation_id)
            full_messages.extend(history)
        full_messages.extend(messages)

        payload = {
            "model": model,
            "messages": full_messages,
            "options": {"temperature": temperature, "num_predict": max_tokens},
            "stream": True,
        }

        collected_content = ""
        try:
            if not self._session:
                raise RuntimeError("AIService session not initialised")
            async with self._session.post(
                f"{self._ollama_url}/api/chat", json=payload
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.error(f"Stream chat error: {resp.status} — {body}")
                    yield f"[Error: {resp.status}]"
                    return

                async for line in resp.content:
                    decoded = line.decode("utf-8").strip()
                    if not decoded:
                        continue
                    try:
                        chunk = json.loads(decoded)
                        token = chunk.get("message", {}).get("content", "")
                        if token:
                            collected_content += token
                            yield token
                        if chunk.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue

            elapsed_ms = (time.monotonic() - start_time) * 1000
            self._request_count += 1
            self._total_inference_ms += elapsed_ms

            if conversation_id and collected_content:
                for msg in messages:
                    self._conversation_memory.add_message(
                        conversation_id, msg["role"], msg["content"]
                    )
                self._conversation_memory.add_message(
                    conversation_id, "assistant", collected_content
                )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self._error_count += 1
            logger.error(f"Stream chat completion error: {exc}")
            yield f"[Error: {exc}]"

    # ------------------------------------------------------------------
    # Embeddings
    # ------------------------------------------------------------------

    async def generate_embedding(
        self, text: str, model: Optional[str] = None
    ) -> List[float]:
        """
        Generate an embedding vector for the given text.

        Args:
            text: Input text to embed.
            model: Embedding model name; defaults to configured embedding model.

        Returns:
            List of floats representing the embedding vector.
        """
        model = model or self._embedding_model
        cached = self._embedding_cache.get(text, model)
        if cached is not None:
            return cached

        try:
            if not self._session:
                raise RuntimeError("AIService session not initialised")
            payload = {"model": model, "prompt": text}
            async with self._session.post(
                f"{self._ollama_url}/api/embeddings", json=payload
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    embedding = data.get("embedding", [])
                    if embedding:
                        self._embedding_cache.put(text, model, embedding)
                    return embedding
                else:
                    body = await resp.text()
                    logger.error(f"Embedding generation failed: {resp.status} — {body}")
                    return []
        except Exception as exc:
            logger.error(f"Embedding generation error: {exc}")
            return []

    async def generate_embeddings_batch(
        self, texts: List[str], model: Optional[str] = None, batch_size: int = 32
    ) -> List[List[float]]:
        """
        Generate embeddings for a batch of texts.

        Args:
            texts: List of input texts.
            model: Embedding model name.
            batch_size: Number of concurrent embedding requests.

        Returns:
            Corresponding list of embedding vectors.
        """
        results: List[List[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            tasks = [self.generate_embedding(t, model) for t in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            for res in batch_results:
                if isinstance(res, Exception):
                    logger.error(f"Batch embedding error: {res}")
                    results.append([])
                else:
                    results.append(res)
        return results

    # ------------------------------------------------------------------
    # RAG Pipeline
    # ------------------------------------------------------------------

    async def rag_query(
        self,
        query: str,
        context_documents: List[str],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrieval-Augmented Generation query.

        Combines retrieved context documents with the user query to generate
        a grounded response.

        Args:
            query: The user's question.
            context_documents: Pre-retrieved relevant documents.
            model: LLM model to use.
            temperature: Sampling temperature (lower for factuality).
            max_tokens: Maximum output tokens.
            system_prompt: Optional extra system instruction.

        Returns:
            Dict with 'content', 'sources_used', 'model', 'tokens', 'duration_ms'.
        """
        default_system = (
            "You are NEXUS, an advanced AI assistant. Answer the user's question "
            "using ONLY the provided context. If the context does not contain enough "
            "information, say so honestly. Cite which context section you used."
        )
        rag_system = system_prompt or default_system

        context_block = "\n\n---\n\n".join(
            f"[Document {i+1}]\n{doc}" for i, doc in enumerate(context_documents)
        )

        augmented_prompt = (
            f"### Context:\n{context_block}\n\n### Question:\n{query}\n\n### Answer:"
        )

        result = await self.chat_completion(
            messages=[{"role": "user", "content": augmented_prompt}],
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            system_prompt=rag_system,
        )

        result["sources_used"] = len(context_documents)
        result["query"] = query

        await self._event_bus.emit(
            "ai.rag_query",
            {"query": query[:200], "sources": len(context_documents)},
            source="ai_service",
            category=EventCategory.SYSTEM,
        )

        return result

    async def semantic_search(
        self, query: str, documents: List[str], top_k: int = 5
    ) -> List[Tuple[int, float, str]]:
        """
        Perform semantic search over a list of documents using cosine similarity.

        Args:
            query: Search query.
            documents: List of document strings to search.
            top_k: Number of top results to return.

        Returns:
            List of (index, similarity_score, document) tuples sorted by relevance.
        """
        if not documents:
            return []

        query_embedding = await self.generate_embedding(query)
        if not query_embedding:
            return []

        doc_embeddings = await self.generate_embeddings_batch(documents)
        scored: List[Tuple[int, float, str]] = []
        for idx, (doc, emb) in enumerate(zip(documents, doc_embeddings)):
            if emb:
                similarity = self._cosine_similarity(query_embedding, emb)
                scored.append((idx, round(similarity, 4), doc))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    @staticmethod
    def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if len(vec_a) != len(vec_b) or not vec_a:
            return 0.0
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = sum(a * a for a in vec_a) ** 0.5
        norm_b = sum(b * b for b in vec_b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    # ------------------------------------------------------------------
    # Vision
    # ------------------------------------------------------------------

    async def analyze_image(
        self, image_base64: str, prompt: str = "Describe this image in detail.",
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyse an image using a vision model.

        Args:
            image_base64: Base64-encoded image data.
            prompt: Textual prompt to accompany the image.
            model: Vision model to use.

        Returns:
            Dict with 'content', 'model', 'tokens', 'duration_ms'.
        """
        model = model or self._vision_model
        start_time = time.monotonic()
        try:
            if not self._session:
                raise RuntimeError("AIService session not initialised")
            payload = {
                "model": model,
                "prompt": prompt,
                "images": [image_base64],
                "stream": False,
            }
            async with self._session.post(
                f"{self._ollama_url}/api/generate", json=payload
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    elapsed_ms = (time.monotonic() - start_time) * 1000
                    self._request_count += 1
                    self._total_inference_ms += elapsed_ms
                    return {
                        "content": data.get("response", ""),
                        "model": model,
                        "tokens": data.get("eval_count", 0),
                        "duration_ms": round(elapsed_ms, 2),
                    }
                else:
                    body = await resp.text()
                    logger.error(f"Vision analysis failed: {resp.status} — {body}")
                    return {"content": "", "model": model, "tokens": 0, "duration_ms": 0, "error": body}
        except Exception as exc:
            logger.error(f"Vision analysis error: {exc}")
            return {"content": "", "model": model, "tokens": 0, "duration_ms": 0, "error": str(exc)}

    # ------------------------------------------------------------------
    # Text utilities
    # ------------------------------------------------------------------

    async def summarize(
        self, text: str, max_length: int = 200, model: Optional[str] = None
    ) -> str:
        """
        Summarize a piece of text.

        Args:
            text: Input text to summarize.
            max_length: Approximate maximum length of the summary in words.
            model: LLM model to use.

        Returns:
            Summarized text string.
        """
        prompt = (
            f"Summarize the following text in at most {max_length} words. "
            f"Be concise and preserve key information.\n\nText:\n{text}\n\nSummary:"
        )
        result = await self.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            temperature=0.3,
            max_tokens=max_length * 2,
        )
        return result.get("content", "").strip()

    async def classify_text(
        self, text: str, categories: List[str], model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Classify text into one of the provided categories.

        Args:
            text: Input text.
            categories: List of possible category labels.
            model: LLM model to use.

        Returns:
            Dict with 'category', 'confidence', 'reasoning'.
        """
        cats = ", ".join(categories)
        prompt = (
            f"Classify the following text into exactly ONE of these categories: {cats}.\n\n"
            f"Text: {text}\n\n"
            "Respond with ONLY a JSON object: {\"category\": \"...\", \"confidence\": 0.0-1.0, "
            "\"reasoning\": \"...\"}"
        )
        result = await self.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            temperature=0.1,
            max_tokens=256,
        )
        content = result.get("content", "")
        try:
            parsed = json.loads(content)
            return parsed
        except json.JSONDecodeError:
            return {"category": categories[0] if categories else "unknown",
                    "confidence": 0.0, "reasoning": content}

    async def extract_entities(
        self, text: str, entity_types: Optional[List[str]] = None,
        model: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """
        Extract named entities from text.

        Args:
            text: Input text.
            entity_types: Optional list of entity types to look for.
            model: LLM model to use.

        Returns:
            List of dicts with 'entity', 'type', 'context'.
        """
        types_str = ", ".join(entity_types) if entity_types else "person, organization, location, date, money, event"
        prompt = (
            f"Extract all named entities from the text below. "
            f"Entity types to look for: {types_str}.\n\n"
            f"Text: {text}\n\n"
            "Respond with ONLY a JSON array of objects: "
            "[{\"entity\": \"...\", \"type\": \"...\", \"context\": \"...\"}]"
        )
        result = await self.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            temperature=0.1,
            max_tokens=1024,
        )
        content = result.get("content", "")
        try:
            parsed = json.loads(content)
            if isinstance(parsed, list):
                return parsed
            return []
        except json.JSONDecodeError:
            return []

    # ------------------------------------------------------------------
    # Conversation Memory
    # ------------------------------------------------------------------

    def get_conversation_history(
        self, conversation_id: str, limit: Optional[int] = None
    ) -> List[Dict[str, str]]:
        """Retrieve conversation history from in-memory store."""
        return self._conversation_memory.get_history(conversation_id, limit)

    def clear_conversation(self, conversation_id: str) -> None:
        """Clear a single conversation from memory."""
        self._conversation_memory.clear(conversation_id)

    def clear_all_conversations(self) -> None:
        """Clear all conversations from memory."""
        self._conversation_memory.clear_all()

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def get_stats(self) -> Dict[str, Any]:
        """Return runtime statistics for the AI service."""
        return {
            "initialized": self._initialized,
            "healthy": self._healthy,
            "request_count": self._request_count,
            "error_count": self._error_count,
            "total_tokens": self._total_tokens,
            "total_inference_ms": round(self._total_inference_ms, 2),
            "avg_inference_ms": (
                round(self._total_inference_ms / self._request_count, 2)
                if self._request_count > 0 else 0.0
            ),
            "embedding_cache": self._embedding_cache.stats,
            "active_conversations": self._conversation_memory.active_conversations,
            "models_available": len(self._available_models),
        }
