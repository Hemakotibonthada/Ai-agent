"""
Nexus AI OS - Local LLM Manager
Ollama integration for running local language models with multi-model routing,
streaming responses, conversation context, and health monitoring.
"""

import asyncio
import json
import time
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import (
    Any,
    AsyncGenerator,
    Dict,
    List,
    Optional,
    Tuple,
)
from dataclasses import dataclass, field

import aiohttp

logger = logging.getLogger("nexus.models.local_llm")

# ---------------------------------------------------------------------------
# Constants / defaults
# ---------------------------------------------------------------------------

OLLAMA_BASE_URL = "http://localhost:11434"

DEFAULT_MODELS = {
    "chat": "llama3",
    "code": "codellama",
    "embedding": "nomic-embed-text",
    "small": "phi3",
    "reasoning": "mistral",
}

DEFAULT_GENERATION_PARAMS = {
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40,
    "num_predict": 2048,
    "repeat_penalty": 1.1,
    "stop": None,
}

MAX_CONTEXT_MESSAGES = 50


class ModelRole(str, Enum):
    CHAT = "chat"
    CODE = "code"
    EMBEDDING = "embedding"
    SMALL = "small"
    REASONING = "reasoning"


@dataclass
class ModelInfo:
    name: str
    role: ModelRole
    size_bytes: int = 0
    parameter_count: str = ""
    quantization: str = ""
    loaded: bool = False
    last_used: Optional[datetime] = None
    request_count: int = 0
    avg_tokens_per_sec: float = 0.0
    errors: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "role": self.role.value,
            "size_bytes": self.size_bytes,
            "parameter_count": self.parameter_count,
            "quantization": self.quantization,
            "loaded": self.loaded,
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "request_count": self.request_count,
            "avg_tokens_per_sec": self.avg_tokens_per_sec,
            "errors": self.errors,
        }


@dataclass
class ConversationContext:
    conversation_id: str
    messages: List[Dict[str, str]] = field(default_factory=list)
    system_prompt: str = ""
    model: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    token_count_estimate: int = 0

    def add_message(self, role: str, content: str) -> None:
        self.messages.append({"role": role, "content": content})
        self.updated_at = datetime.now(timezone.utc)
        self.token_count_estimate += len(content.split()) * 2
        if len(self.messages) > MAX_CONTEXT_MESSAGES:
            removed = self.messages[:2]
            self.messages = self.messages[2:]
            for msg in removed:
                self.token_count_estimate -= len(msg["content"].split()) * 2

    def get_ollama_messages(self) -> List[Dict[str, str]]:
        msgs: List[Dict[str, str]] = []
        if self.system_prompt:
            msgs.append({"role": "system", "content": self.system_prompt})
        msgs.extend(self.messages)
        return msgs

    def clear(self) -> None:
        self.messages.clear()
        self.token_count_estimate = 0


# ---------------------------------------------------------------------------
# System prompt templates
# ---------------------------------------------------------------------------

SYSTEM_PROMPTS: Dict[str, str] = {
    "default": (
        "You are Nexus, a highly capable AI operating system assistant. "
        "Be concise, helpful, and proactive. Format answers with markdown when useful."
    ),
    "code": (
        "You are Nexus Code, an expert programming assistant. "
        "Provide clean, well-commented code. Explain your reasoning. "
        "Use best practices and modern patterns."
    ),
    "reasoning": (
        "You are Nexus Reason, a logical reasoning engine. "
        "Think step-by-step. Show your chain of thought clearly. "
        "Verify conclusions before presenting them."
    ),
    "creative": (
        "You are Nexus Creative, a creative writing and ideation assistant. "
        "Be imaginative, expressive, and original."
    ),
    "concise": (
        "You are Nexus. Answer in as few words as possible while remaining accurate."
    ),
}


def build_system_prompt(
    base_key: str = "default",
    user_name: str = "User",
    personality_traits: Optional[Dict[str, float]] = None,
    extra_context: str = "",
) -> str:
    prompt = SYSTEM_PROMPTS.get(base_key, SYSTEM_PROMPTS["default"])
    prompt += f"\nThe user's name is {user_name}."
    if personality_traits:
        style_hints: List[str] = []
        if personality_traits.get("formality", 0.5) < 0.4:
            style_hints.append("Use a casual, friendly tone.")
        elif personality_traits.get("formality", 0.5) > 0.7:
            style_hints.append("Maintain a professional, formal tone.")
        if personality_traits.get("humor", 0.5) > 0.6:
            style_hints.append("Feel free to be witty or humorous when appropriate.")
        if personality_traits.get("detail", 0.5) > 0.7:
            style_hints.append("Provide detailed, thorough explanations.")
        elif personality_traits.get("detail", 0.5) < 0.3:
            style_hints.append("Keep explanations brief.")
        if style_hints:
            prompt += "\nCommunication style: " + " ".join(style_hints)
    if extra_context:
        prompt += f"\nAdditional context: {extra_context}"
    return prompt


# ---------------------------------------------------------------------------
# Main manager class
# ---------------------------------------------------------------------------

class LocalLLMManager:
    """Manages local LLM instances via the Ollama HTTP API."""

    def __init__(
        self,
        base_url: str = OLLAMA_BASE_URL,
        model_mapping: Optional[Dict[str, str]] = None,
        default_params: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model_mapping: Dict[str, str] = {**DEFAULT_MODELS, **(model_mapping or {})}
        self.default_params: Dict[str, Any] = {**DEFAULT_GENERATION_PARAMS, **(default_params or {})}
        self.models: Dict[str, ModelInfo] = {}
        self.conversations: Dict[str, ConversationContext] = {}
        self._session: Optional[aiohttp.ClientSession] = None
        self._health_ok: bool = False
        self._stats: Dict[str, Any] = {
            "total_requests": 0,
            "total_tokens_generated": 0,
            "total_errors": 0,
            "uptime_since": None,
        }

    # -- session management --------------------------------------------------

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=600, connect=10)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    # -- health / status -----------------------------------------------------

    async def check_health(self) -> Dict[str, Any]:
        session = await self._get_session()
        try:
            async with session.get(f"{self.base_url}/api/version") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self._health_ok = True
                    self._stats["uptime_since"] = self._stats["uptime_since"] or datetime.now(timezone.utc).isoformat()
                    return {"healthy": True, "version": data.get("version"), "stats": self._stats}
                self._health_ok = False
                return {"healthy": False, "error": f"HTTP {resp.status}"}
        except Exception as exc:
            self._health_ok = False
            return {"healthy": False, "error": str(exc)}

    async def is_healthy(self) -> bool:
        result = await self.check_health()
        return result["healthy"]

    # -- model lifecycle -----------------------------------------------------

    async def list_local_models(self) -> List[Dict[str, Any]]:
        session = await self._get_session()
        async with session.get(f"{self.base_url}/api/tags") as resp:
            resp.raise_for_status()
            data = await resp.json()
            models = data.get("models", [])
            for m in models:
                name = m.get("name", "")
                if name not in self.models:
                    role = self._infer_role(name)
                    self.models[name] = ModelInfo(
                        name=name,
                        role=role,
                        size_bytes=m.get("size", 0),
                        parameter_count=m.get("details", {}).get("parameter_size", ""),
                        quantization=m.get("details", {}).get("quantization_level", ""),
                    )
            return models

    def _infer_role(self, name: str) -> ModelRole:
        lower = name.lower()
        if "code" in lower:
            return ModelRole.CODE
        if "embed" in lower:
            return ModelRole.EMBEDDING
        if "phi" in lower:
            return ModelRole.SMALL
        if "mistral" in lower:
            return ModelRole.REASONING
        return ModelRole.CHAT

    async def pull_model(self, model_name: str) -> AsyncGenerator[Dict[str, Any], None]:
        session = await self._get_session()
        payload = {"name": model_name, "stream": True}
        async with session.post(f"{self.base_url}/api/pull", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.content:
                if line:
                    try:
                        chunk = json.loads(line)
                        yield chunk
                        if chunk.get("status") == "success":
                            role = self._infer_role(model_name)
                            self.models[model_name] = ModelInfo(name=model_name, role=role)
                    except json.JSONDecodeError:
                        continue

    async def load_model(self, model_name: str) -> Dict[str, Any]:
        session = await self._get_session()
        payload = {"model": model_name}
        async with session.post(f"{self.base_url}/api/generate", json={**payload, "prompt": "", "keep_alive": "10m"}) as resp:
            resp.raise_for_status()
            if model_name in self.models:
                self.models[model_name].loaded = True
            else:
                self.models[model_name] = ModelInfo(name=model_name, role=self._infer_role(model_name), loaded=True)
            return {"status": "loaded", "model": model_name}

    async def unload_model(self, model_name: str) -> Dict[str, Any]:
        session = await self._get_session()
        payload = {"model": model_name, "keep_alive": 0}
        async with session.post(f"{self.base_url}/api/generate", json={**payload, "prompt": ""}) as resp:
            resp.raise_for_status()
            if model_name in self.models:
                self.models[model_name].loaded = False
            return {"status": "unloaded", "model": model_name}

    async def delete_model(self, model_name: str) -> Dict[str, Any]:
        session = await self._get_session()
        async with session.delete(f"{self.base_url}/api/delete", json={"name": model_name}) as resp:
            resp.raise_for_status()
            self.models.pop(model_name, None)
            return {"status": "deleted", "model": model_name}

    # -- model routing -------------------------------------------------------

    def get_model_for_role(self, role: str) -> str:
        return self.model_mapping.get(role, self.model_mapping["chat"])

    def set_model_for_role(self, role: str, model_name: str) -> None:
        self.model_mapping[role] = model_name

    def resolve_model(self, model: Optional[str] = None, role: str = "chat") -> str:
        if model:
            return model
        return self.get_model_for_role(role)

    # -- conversation context ------------------------------------------------

    def get_or_create_conversation(
        self,
        conversation_id: str,
        system_prompt: str = "",
        model: str = "",
    ) -> ConversationContext:
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = ConversationContext(
                conversation_id=conversation_id,
                system_prompt=system_prompt or SYSTEM_PROMPTS["default"],
                model=model,
            )
        return self.conversations[conversation_id]

    def delete_conversation(self, conversation_id: str) -> bool:
        return self.conversations.pop(conversation_id, None) is not None

    def list_conversations(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": c.conversation_id,
                "model": c.model,
                "messages": len(c.messages),
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
                "token_estimate": c.token_count_estimate,
            }
            for c in self.conversations.values()
        ]

    # -- generation ----------------------------------------------------------

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        role: str = "chat",
        system: Optional[str] = None,
        conversation_id: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        resolved_model = self.resolve_model(model, role)
        gen_params = {**self.default_params, **(params or {})}

        messages: Optional[List[Dict[str, str]]] = None
        if conversation_id:
            ctx = self.get_or_create_conversation(conversation_id, system or "", resolved_model)
            ctx.add_message("user", prompt)
            messages = ctx.get_ollama_messages()

        session = await self._get_session()
        self._stats["total_requests"] += 1

        if messages:
            payload: Dict[str, Any] = {
                "model": resolved_model,
                "messages": messages,
                "stream": False,
                "options": gen_params,
            }
            endpoint = f"{self.base_url}/api/chat"
        else:
            payload = {
                "model": resolved_model,
                "prompt": prompt,
                "system": system or SYSTEM_PROMPTS.get(role, SYSTEM_PROMPTS["default"]),
                "stream": False,
                "options": gen_params,
            }
            endpoint = f"{self.base_url}/api/generate"

        try:
            async with session.post(endpoint, json=payload) as resp:
                resp.raise_for_status()
                data = await resp.json()

                response_text = data.get("message", {}).get("content", "") if messages else data.get("response", "")
                tokens_generated = data.get("eval_count", 0)
                duration_ns = data.get("eval_duration", 1)
                tokens_per_sec = (tokens_generated / (duration_ns / 1e9)) if duration_ns else 0

                self._stats["total_tokens_generated"] += tokens_generated

                if resolved_model in self.models:
                    mi = self.models[resolved_model]
                    mi.request_count += 1
                    mi.last_used = datetime.now(timezone.utc)
                    mi.avg_tokens_per_sec = (
                        (mi.avg_tokens_per_sec * (mi.request_count - 1) + tokens_per_sec) / mi.request_count
                    )

                if conversation_id:
                    ctx = self.conversations[conversation_id]
                    ctx.add_message("assistant", response_text)

                return {
                    "response": response_text,
                    "model": resolved_model,
                    "tokens_generated": tokens_generated,
                    "tokens_per_sec": round(tokens_per_sec, 2),
                    "total_duration_ms": round(data.get("total_duration", 0) / 1e6, 2),
                    "conversation_id": conversation_id,
                }
        except Exception as exc:
            self._stats["total_errors"] += 1
            if resolved_model in self.models:
                self.models[resolved_model].errors += 1
            logger.error("Generation error: %s", exc)
            raise

    async def generate_stream(
        self,
        prompt: str,
        model: Optional[str] = None,
        role: str = "chat",
        system: Optional[str] = None,
        conversation_id: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[str, None]:
        resolved_model = self.resolve_model(model, role)
        gen_params = {**self.default_params, **(params or {})}

        messages: Optional[List[Dict[str, str]]] = None
        if conversation_id:
            ctx = self.get_or_create_conversation(conversation_id, system or "", resolved_model)
            ctx.add_message("user", prompt)
            messages = ctx.get_ollama_messages()

        session = await self._get_session()
        self._stats["total_requests"] += 1

        if messages:
            payload: Dict[str, Any] = {
                "model": resolved_model,
                "messages": messages,
                "stream": True,
                "options": gen_params,
            }
            endpoint = f"{self.base_url}/api/chat"
        else:
            payload = {
                "model": resolved_model,
                "prompt": prompt,
                "system": system or SYSTEM_PROMPTS.get(role, SYSTEM_PROMPTS["default"]),
                "stream": True,
                "options": gen_params,
            }
            endpoint = f"{self.base_url}/api/generate"

        full_response: List[str] = []
        try:
            async with session.post(endpoint, json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.content:
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    token = ""
                    if messages:
                        token = chunk.get("message", {}).get("content", "")
                    else:
                        token = chunk.get("response", "")
                    if token:
                        full_response.append(token)
                        yield token
                    if chunk.get("done"):
                        tokens_generated = chunk.get("eval_count", 0)
                        self._stats["total_tokens_generated"] += tokens_generated
        except Exception as exc:
            self._stats["total_errors"] += 1
            logger.error("Streaming error: %s", exc)
            raise
        finally:
            if conversation_id and full_response:
                ctx = self.conversations[conversation_id]
                ctx.add_message("assistant", "".join(full_response))

    # -- batch inference -----------------------------------------------------

    async def batch_generate(
        self,
        prompts: List[str],
        model: Optional[str] = None,
        role: str = "chat",
        system: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        max_concurrent: int = 3,
    ) -> List[Dict[str, Any]]:
        semaphore = asyncio.Semaphore(max_concurrent)
        results: List[Optional[Dict[str, Any]]] = [None] * len(prompts)

        async def _run(index: int, prompt: str) -> None:
            async with semaphore:
                try:
                    result = await self.generate(prompt, model=model, role=role, system=system, params=params)
                    results[index] = result
                except Exception as exc:
                    results[index] = {"error": str(exc), "prompt": prompt}

        await asyncio.gather(*[_run(i, p) for i, p in enumerate(prompts)])
        return [r for r in results if r is not None]

    # -- embeddings via Ollama -----------------------------------------------

    async def get_embedding(self, text: str, model: Optional[str] = None) -> List[float]:
        resolved_model = model or self.get_model_for_role("embedding")
        session = await self._get_session()
        payload = {"model": resolved_model, "prompt": text}
        async with session.post(f"{self.base_url}/api/embeddings", json=payload) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data.get("embedding", [])

    async def get_embeddings_batch(
        self,
        texts: List[str],
        model: Optional[str] = None,
        max_concurrent: int = 5,
    ) -> List[List[float]]:
        semaphore = asyncio.Semaphore(max_concurrent)
        results: List[Optional[List[float]]] = [None] * len(texts)

        async def _embed(index: int, text: str) -> None:
            async with semaphore:
                results[index] = await self.get_embedding(text, model)

        await asyncio.gather(*[_embed(i, t) for i, t in enumerate(texts)])
        return [r for r in results if r is not None]

    # -- utility -------------------------------------------------------------

    def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        info = self.models.get(model_name)
        return info.to_dict() if info else None

    def get_all_models_info(self) -> List[Dict[str, Any]]:
        return [m.to_dict() for m in self.models.values()]

    def get_stats(self) -> Dict[str, Any]:
        return {
            **self._stats,
            "active_conversations": len(self.conversations),
            "tracked_models": len(self.models),
            "model_mapping": dict(self.model_mapping),
        }

    async def show_model_details(self, model_name: str) -> Dict[str, Any]:
        session = await self._get_session()
        async with session.post(f"{self.base_url}/api/show", json={"name": model_name}) as resp:
            resp.raise_for_status()
            return await resp.json()

    async def copy_model(self, source: str, destination: str) -> Dict[str, Any]:
        session = await self._get_session()
        async with session.post(
            f"{self.base_url}/api/copy",
            json={"source": source, "destination": destination},
        ) as resp:
            resp.raise_for_status()
            return {"status": "copied", "source": source, "destination": destination}

    async def create_model_from_modelfile(
        self, model_name: str, modelfile: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        session = await self._get_session()
        payload = {"name": model_name, "modelfile": modelfile, "stream": True}
        async with session.post(f"{self.base_url}/api/create", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.content:
                if line:
                    try:
                        yield json.loads(line)
                    except json.JSONDecodeError:
                        continue

    async def monitor_models(self) -> Dict[str, Any]:
        health = await self.check_health()
        models = await self.list_local_models() if health["healthy"] else []
        return {
            "health": health,
            "models_available": len(models),
            "models": self.get_all_models_info(),
            "stats": self.get_stats(),
        }
