"""
Nexus AI OS - Fine-Tuning Pipeline
Conversation data collection, LoRA-style preparation, Ollama Modelfile generation,
model versioning, A/B testing, and rollback capability.
"""

import copy
import hashlib
import json
import logging
import os
import random
import re
import shutil
import time
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("nexus.models.fine_tuner")

# ---------------------------------------------------------------------------
# Enums / data classes
# ---------------------------------------------------------------------------


class TrainingStatus(str, Enum):
    PENDING = "pending"
    COLLECTING = "collecting"
    VALIDATING = "validating"
    PREPARING = "preparing"
    TRAINING = "training"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ModelVersion:
    """Tracks a single model version created by fine-tuning."""

    def __init__(
        self,
        version_id: str,
        base_model: str,
        model_name: str,
        modelfile_content: str,
        training_samples: int = 0,
        created_at: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.version_id = version_id
        self.base_model = base_model
        self.model_name = model_name
        self.modelfile_content = modelfile_content
        self.training_samples = training_samples
        self.created_at = created_at or datetime.now(timezone.utc).isoformat()
        self.metadata = metadata or {}
        self.performance_score: float = 0.0
        self.is_active: bool = False
        self.ab_test_results: Dict[str, Any] = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version_id": self.version_id,
            "base_model": self.base_model,
            "model_name": self.model_name,
            "training_samples": self.training_samples,
            "created_at": self.created_at,
            "metadata": self.metadata,
            "performance_score": self.performance_score,
            "is_active": self.is_active,
            "ab_test_results": self.ab_test_results,
        }


class TrainingJob:
    """Represents a fine-tuning job."""

    def __init__(self, job_id: str, base_model: str) -> None:
        self.job_id = job_id
        self.base_model = base_model
        self.status: TrainingStatus = TrainingStatus.PENDING
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.started_at: Optional[str] = None
        self.completed_at: Optional[str] = None
        self.error: Optional[str] = None
        self.progress: float = 0.0
        self.training_data_path: Optional[str] = None
        self.result_version: Optional[str] = None
        self.config: Dict[str, Any] = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "base_model": self.base_model,
            "status": self.status.value,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "error": self.error,
            "progress": self.progress,
            "training_data_path": self.training_data_path,
            "result_version": self.result_version,
            "config": self.config,
        }


# ---------------------------------------------------------------------------
# Training data helpers
# ---------------------------------------------------------------------------


def format_conversation_for_training(
    messages: List[Dict[str, str]],
    system_prompt: str = "",
) -> Dict[str, Any]:
    """Format a conversation into an Ollama-compatible training sample."""
    formatted: List[Dict[str, str]] = []
    if system_prompt:
        formatted.append({"role": "system", "content": system_prompt})
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant", "system") and content.strip():
            formatted.append({"role": role, "content": content.strip()})
    return {"messages": formatted}


def validate_training_sample(sample: Dict[str, Any]) -> Tuple[bool, str]:
    """Validate a single training sample."""
    messages = sample.get("messages", [])
    if not messages:
        return False, "No messages in sample"
    if len(messages) < 2:
        return False, "Need at least 2 messages (user + assistant)"

    has_user = any(m.get("role") == "user" for m in messages)
    has_assistant = any(m.get("role") == "assistant" for m in messages)
    if not has_user:
        return False, "Missing user message"
    if not has_assistant:
        return False, "Missing assistant message"

    for m in messages:
        if m.get("role") not in ("system", "user", "assistant"):
            return False, f"Invalid role: {m.get('role')}"
        if not m.get("content", "").strip():
            return False, "Empty message content"

    total_chars = sum(len(m["content"]) for m in messages)
    if total_chars > 32768:
        return False, f"Sample too long: {total_chars} chars"
    if total_chars < 10:
        return False, "Sample too short"

    return True, "valid"


def validate_training_dataset(samples: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Validate an entire dataset."""
    valid_count = 0
    invalid_samples: List[Dict[str, Any]] = []
    total_tokens_estimate = 0

    for i, sample in enumerate(samples):
        ok, reason = validate_training_sample(sample)
        if ok:
            valid_count += 1
            chars = sum(len(m["content"]) for m in sample.get("messages", []))
            total_tokens_estimate += chars // 4
        else:
            invalid_samples.append({"index": i, "reason": reason})

    return {
        "total_samples": len(samples),
        "valid": valid_count,
        "invalid": len(invalid_samples),
        "invalid_details": invalid_samples[:20],
        "estimated_tokens": total_tokens_estimate,
        "usable": valid_count >= 10,
    }


# ---------------------------------------------------------------------------
# Modelfile generation
# ---------------------------------------------------------------------------


def generate_modelfile(
    base_model: str,
    system_prompt: str,
    temperature: float = 0.7,
    top_p: float = 0.9,
    top_k: int = 40,
    num_ctx: int = 4096,
    stop_tokens: Optional[List[str]] = None,
    template: Optional[str] = None,
    license_text: str = "",
) -> str:
    """Generate an Ollama Modelfile string."""
    lines: List[str] = [f"FROM {base_model}", ""]

    # parameters
    lines.append(f"PARAMETER temperature {temperature}")
    lines.append(f"PARAMETER top_p {top_p}")
    lines.append(f"PARAMETER top_k {top_k}")
    lines.append(f"PARAMETER num_ctx {num_ctx}")
    if stop_tokens:
        for st in stop_tokens:
            lines.append(f'PARAMETER stop "{st}"')
    lines.append("")

    # system prompt
    lines.append(f'SYSTEM """{system_prompt}"""')
    lines.append("")

    # optional template
    if template:
        lines.append(f'TEMPLATE """{template}"""')
        lines.append("")

    # license
    if license_text:
        lines.append(f'LICENSE """{license_text}"""')
        lines.append("")

    return "\n".join(lines)


def build_system_prompt_from_personality(
    personality_data: Dict[str, Any],
    user_name: str = "User",
    base_identity: str = "Nexus",
) -> str:
    """Build a system prompt incorporating learned personality traits."""
    big_five = personality_data.get("big_five", {})
    tone = personality_data.get("preferred_tone", "neutral")
    humor = personality_data.get("humor_level", 0.3)
    formality = personality_data.get("formality", 0.5)
    detail = personality_data.get("detail_preference", 0.5)

    parts: List[str] = [
        f"You are {base_identity}, an advanced AI operating system assistant "
        f"personalised for {user_name}.",
    ]

    # Tone
    tone_map = {
        "professional": "Communicate in a professional, polished manner.",
        "casual": "Be relaxed, friendly, and conversational.",
        "warm": "Be warm, approachable, and personable.",
        "neutral": "Be clear, helpful, and balanced in tone.",
    }
    parts.append(tone_map.get(tone, tone_map["neutral"]))

    # Detail
    if detail > 0.65:
        parts.append("Provide thorough, detailed explanations with examples.")
    elif detail < 0.35:
        parts.append("Be concise and get straight to the point.")

    # Humor
    if humor > 0.5:
        parts.append("Light humor and wit are appreciated by this user.")

    # Formality
    if formality < 0.35:
        parts.append("Contractions and informal language are fine.")
    elif formality > 0.7:
        parts.append("Use proper grammar and formal language.")

    # Big Five nuances
    if big_five.get("openness", 0.5) > 0.7:
        parts.append("Explore creative angles and novel perspectives.")
    if big_five.get("conscientiousness", 0.5) > 0.7:
        parts.append("Be organized and structured in your responses.")
    if big_five.get("agreeableness", 0.5) > 0.7:
        parts.append("Be supportive and affirming.")

    return " ".join(parts)


# ---------------------------------------------------------------------------
# Fine-tuner
# ---------------------------------------------------------------------------


class FineTuner:
    """Manages the fine-tuning pipeline: data → Modelfile → create → version → A/B test."""

    def __init__(
        self,
        llm_manager: Any = None,
        persist_dir: str = "./data/fine_tuning",
    ) -> None:
        self.llm_manager = llm_manager
        self.persist_dir = persist_dir
        self.data_dir = os.path.join(persist_dir, "data")
        self.modelfile_dir = os.path.join(persist_dir, "modelfiles")
        self.versions_dir = os.path.join(persist_dir, "versions")
        for d in (self.data_dir, self.modelfile_dir, self.versions_dir):
            os.makedirs(d, exist_ok=True)

        self.versions: Dict[str, ModelVersion] = {}
        self.jobs: Dict[str, TrainingJob] = {}
        self.collected_conversations: List[Dict[str, Any]] = []
        self._active_version: Optional[str] = None
        self._load_state()

    # -- persistence ---------------------------------------------------------

    def _state_path(self) -> str:
        return os.path.join(self.persist_dir, "fine_tuner_state.json")

    def _load_state(self) -> None:
        path = self._state_path()
        if not os.path.exists(path):
            return
        try:
            with open(path) as f:
                data = json.load(f)
            for vd in data.get("versions", []):
                mv = ModelVersion(
                    version_id=vd["version_id"],
                    base_model=vd["base_model"],
                    model_name=vd["model_name"],
                    modelfile_content="",
                    training_samples=vd.get("training_samples", 0),
                    created_at=vd.get("created_at"),
                    metadata=vd.get("metadata", {}),
                )
                mv.performance_score = vd.get("performance_score", 0.0)
                mv.is_active = vd.get("is_active", False)
                mv.ab_test_results = vd.get("ab_test_results", {})
                self.versions[mv.version_id] = mv
                if mv.is_active:
                    self._active_version = mv.version_id
            self._active_version = data.get("active_version")
            logger.info("FineTuner loaded %d versions", len(self.versions))
        except Exception as exc:
            logger.error("Failed to load fine-tuner state: %s", exc)

    def _save_state(self) -> None:
        data = {
            "versions": [v.to_dict() for v in self.versions.values()],
            "active_version": self._active_version,
        }
        with open(self._state_path(), "w") as f:
            json.dump(data, f, indent=2)

    # -- data collection -----------------------------------------------------

    def collect_conversation(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str = "",
        quality_score: float = 1.0,
    ) -> Dict[str, Any]:
        sample = format_conversation_for_training(messages, system_prompt)
        ok, reason = validate_training_sample(sample)
        if not ok:
            return {"status": "rejected", "reason": reason}
        sample["quality_score"] = quality_score
        sample["collected_at"] = datetime.now(timezone.utc).isoformat()
        self.collected_conversations.append(sample)
        return {"status": "collected", "total": len(self.collected_conversations)}

    def export_training_data(
        self,
        min_quality: float = 0.5,
        max_samples: Optional[int] = None,
    ) -> str:
        """Export collected conversations to a JSONL file."""
        filtered = [
            c for c in self.collected_conversations
            if c.get("quality_score", 1.0) >= min_quality
        ]
        if max_samples:
            filtered = filtered[:max_samples]

        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"training_data_{ts}.jsonl"
        path = os.path.join(self.data_dir, filename)
        with open(path, "w") as f:
            for sample in filtered:
                f.write(json.dumps(sample) + "\n")

        logger.info("Exported %d training samples to %s", len(filtered), path)
        return path

    def import_training_data(self, file_path: str) -> Dict[str, Any]:
        """Import training data from JSONL."""
        imported = 0
        errors = 0
        with open(file_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    sample = json.loads(line)
                    ok, _ = validate_training_sample(sample)
                    if ok:
                        self.collected_conversations.append(sample)
                        imported += 1
                    else:
                        errors += 1
                except json.JSONDecodeError:
                    errors += 1
        return {"imported": imported, "errors": errors}

    def get_data_stats(self) -> Dict[str, Any]:
        validation = validate_training_dataset(self.collected_conversations)
        return {
            "collected_conversations": len(self.collected_conversations),
            "validation": validation,
        }

    # -- Modelfile & training ------------------------------------------------

    def create_training_job(
        self,
        base_model: str = "llama3",
        personality_data: Optional[Dict[str, Any]] = None,
        user_name: str = "User",
        temperature: float = 0.7,
        num_ctx: int = 4096,
    ) -> TrainingJob:
        job_id = f"job_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{random.randint(1000, 9999)}"
        job = TrainingJob(job_id=job_id, base_model=base_model)

        # Build system prompt
        if personality_data:
            system_prompt = build_system_prompt_from_personality(personality_data, user_name)
        else:
            system_prompt = (
                f"You are Nexus, an advanced AI operating system assistant for {user_name}. "
                "Be helpful, proactive, and personable."
            )

        job.config = {
            "system_prompt": system_prompt,
            "temperature": temperature,
            "num_ctx": num_ctx,
            "personality_data": personality_data,
        }
        self.jobs[job_id] = job
        return job

    async def run_training_job(self, job_id: str) -> Dict[str, Any]:
        job = self.jobs.get(job_id)
        if not job:
            return {"error": "Job not found"}

        job.status = TrainingStatus.COLLECTING
        job.started_at = datetime.now(timezone.utc).isoformat()

        # Export data
        job.status = TrainingStatus.VALIDATING
        job.progress = 0.2
        data_path = self.export_training_data()
        job.training_data_path = data_path

        # Generate Modelfile
        job.status = TrainingStatus.PREPARING
        job.progress = 0.4
        cfg = job.config
        modelfile = generate_modelfile(
            base_model=job.base_model,
            system_prompt=cfg["system_prompt"],
            temperature=cfg.get("temperature", 0.7),
            num_ctx=cfg.get("num_ctx", 4096),
        )

        version_id = f"v_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        model_name = f"nexus-custom-{version_id}"

        # Save Modelfile
        modelfile_path = os.path.join(self.modelfile_dir, f"{version_id}.modelfile")
        with open(modelfile_path, "w") as f:
            f.write(modelfile)

        # Create model via Ollama
        job.status = TrainingStatus.TRAINING
        job.progress = 0.6

        if self.llm_manager is not None:
            try:
                async for chunk in self.llm_manager.create_model_from_modelfile(model_name, modelfile):
                    status = chunk.get("status", "")
                    if "success" in status.lower():
                        job.progress = 1.0
            except Exception as exc:
                job.status = TrainingStatus.FAILED
                job.error = str(exc)
                return {"error": str(exc), "job": job.to_dict()}

        # Register version
        mv = ModelVersion(
            version_id=version_id,
            base_model=job.base_model,
            model_name=model_name,
            modelfile_content=modelfile,
            training_samples=len(self.collected_conversations),
            metadata=cfg,
        )
        self.versions[version_id] = mv

        job.status = TrainingStatus.COMPLETED
        job.completed_at = datetime.now(timezone.utc).isoformat()
        job.result_version = version_id
        job.progress = 1.0

        self._save_state()
        logger.info("Training job %s completed → version %s", job_id, version_id)
        return {"status": "completed", "version": mv.to_dict(), "job": job.to_dict()}

    # -- version management --------------------------------------------------

    def list_versions(self) -> List[Dict[str, Any]]:
        return [v.to_dict() for v in self.versions.values()]

    def get_version(self, version_id: str) -> Optional[Dict[str, Any]]:
        v = self.versions.get(version_id)
        return v.to_dict() if v else None

    def activate_version(self, version_id: str) -> Dict[str, Any]:
        if version_id not in self.versions:
            return {"error": "Version not found"}
        for v in self.versions.values():
            v.is_active = False
        self.versions[version_id].is_active = True
        self._active_version = version_id
        self._save_state()
        return {"status": "activated", "version": version_id}

    def get_active_version(self) -> Optional[ModelVersion]:
        if self._active_version:
            return self.versions.get(self._active_version)
        return None

    def rollback(self, version_id: str) -> Dict[str, Any]:
        """Rollback to a previous version."""
        if version_id not in self.versions:
            return {"error": "Version not found"}
        return self.activate_version(version_id)

    async def delete_version(self, version_id: str) -> Dict[str, Any]:
        v = self.versions.get(version_id)
        if not v:
            return {"error": "Version not found"}
        if v.is_active:
            self._active_version = None
        if self.llm_manager is not None:
            try:
                await self.llm_manager.delete_model(v.model_name)
            except Exception:
                pass
        del self.versions[version_id]
        self._save_state()
        return {"status": "deleted", "version": version_id}

    # -- A/B testing ---------------------------------------------------------

    def start_ab_test(
        self,
        version_a: str,
        version_b: str,
    ) -> Dict[str, Any]:
        va = self.versions.get(version_a)
        vb = self.versions.get(version_b)
        if not va or not vb:
            return {"error": "One or both versions not found"}
        test_id = f"ab_{int(time.time())}"
        for v in (va, vb):
            v.ab_test_results[test_id] = {
                "wins": 0,
                "losses": 0,
                "ties": 0,
                "total_comparisons": 0,
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
        self._save_state()
        return {
            "test_id": test_id,
            "version_a": version_a,
            "version_b": version_b,
            "status": "running",
        }

    def record_ab_result(
        self,
        test_id: str,
        winner: str,
        loser: str,
    ) -> Dict[str, Any]:
        vw = self.versions.get(winner)
        vl = self.versions.get(loser)
        if not vw or not vl:
            return {"error": "Version not found"}

        if test_id in vw.ab_test_results:
            vw.ab_test_results[test_id]["wins"] += 1
            vw.ab_test_results[test_id]["total_comparisons"] += 1
        if test_id in vl.ab_test_results:
            vl.ab_test_results[test_id]["losses"] += 1
            vl.ab_test_results[test_id]["total_comparisons"] += 1

        # update performance scores
        for v in (vw, vl):
            total_wins = sum(r.get("wins", 0) for r in v.ab_test_results.values())
            total_comp = sum(r.get("total_comparisons", 0) for r in v.ab_test_results.values())
            v.performance_score = total_wins / max(total_comp, 1)

        self._save_state()
        return {"status": "recorded", "winner": winner, "loser": loser}

    def get_ab_test_summary(self, test_id: str) -> Dict[str, Any]:
        results: Dict[str, Any] = {}
        for vid, v in self.versions.items():
            if test_id in v.ab_test_results:
                results[vid] = v.ab_test_results[test_id]
        return {"test_id": test_id, "results": results}

    def select_model_for_request(self) -> str:
        """Select the best model, preferring the active version or highest-performing."""
        active = self.get_active_version()
        if active:
            return active.model_name
        if self.versions:
            best = max(self.versions.values(), key=lambda v: v.performance_score)
            return best.model_name
        return "llama3"

    # -- stats ---------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        return {
            "versions": len(self.versions),
            "active_version": self._active_version,
            "collected_conversations": len(self.collected_conversations),
            "training_jobs": len(self.jobs),
            "jobs_by_status": {
                s.value: sum(1 for j in self.jobs.values() if j.status == s)
                for s in TrainingStatus
            },
        }
