"""
Nexus AI OS - Daily Routine Automation
Morning briefing, model training triggers, health summaries, financial digests,
email digests, energy reports, system maintenance, backup, log rotation, memory consolidation.
"""

import asyncio
import logging
import os
import shutil
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger("nexus.scheduler.daily_routines")

# ---------------------------------------------------------------------------
# Routine result container
# ---------------------------------------------------------------------------


class RoutineResult:
    def __init__(self, name: str, success: bool, data: Any = None, error: Optional[str] = None) -> None:
        self.name = name
        self.success = success
        self.data = data
        self.error = error
        self.executed_at = datetime.now(timezone.utc).isoformat()
        self.duration_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "executed_at": self.executed_at,
            "duration_ms": self.duration_ms,
        }


# ---------------------------------------------------------------------------
# Individual routine implementations
# ---------------------------------------------------------------------------


async def morning_briefing(
    llm_manager: Any = None,
    health_agent: Any = None,
    financial_agent: Any = None,
    task_agent: Any = None,
    weather_data: Optional[Dict[str, Any]] = None,
    user_name: str = "User",
) -> Dict[str, Any]:
    """Generate a comprehensive morning briefing."""
    sections: Dict[str, Any] = {"user": user_name, "generated_at": datetime.now(timezone.utc).isoformat()}

    # Greeting based on time
    hour = datetime.now(timezone.utc).hour
    if hour < 12:
        greeting = f"Good morning, {user_name}!"
    elif hour < 17:
        greeting = f"Good afternoon, {user_name}!"
    else:
        greeting = f"Good evening, {user_name}!"
    sections["greeting"] = greeting

    # Weather
    if weather_data:
        sections["weather"] = weather_data
    else:
        sections["weather"] = {"note": "Weather data unavailable"}

    # Tasks due today
    if task_agent:
        try:
            tasks = await task_agent.get_today_tasks() if asyncio.iscoroutinefunction(getattr(task_agent, "get_today_tasks", None)) else []
            sections["tasks"] = tasks
        except Exception:
            sections["tasks"] = []
    else:
        sections["tasks"] = []

    # Health summary
    if health_agent:
        try:
            summary = await health_agent.get_daily_summary() if asyncio.iscoroutinefunction(getattr(health_agent, "get_daily_summary", None)) else {}
            sections["health"] = summary
        except Exception:
            sections["health"] = {}

    # Financial snapshot
    if financial_agent:
        try:
            snapshot = await financial_agent.get_daily_snapshot() if asyncio.iscoroutinefunction(getattr(financial_agent, "get_daily_snapshot", None)) else {}
            sections["finance"] = snapshot
        except Exception:
            sections["finance"] = {}

    # Generate natural-language briefing via LLM
    if llm_manager:
        prompt = (
            f"Generate a concise morning briefing for {user_name}.\n"
            f"Tasks today: {len(sections.get('tasks', []))}\n"
            f"Weather: {sections.get('weather', 'N/A')}\n"
            "Keep it under 200 words, friendly and motivating."
        )
        try:
            result = await llm_manager.generate(prompt, role="chat")
            sections["briefing_text"] = result.get("response", "")
        except Exception:
            sections["briefing_text"] = greeting

    return sections


async def daily_model_training_trigger(
    fine_tuner: Any = None,
    min_conversations: int = 50,
) -> Dict[str, Any]:
    """Check if enough data has been collected and trigger training if so."""
    if fine_tuner is None:
        return {"status": "skipped", "reason": "No fine-tuner"}
    stats = fine_tuner.get_data_stats()
    collected = stats.get("collected_conversations", 0)
    if collected < min_conversations:
        return {
            "status": "skipped",
            "reason": f"Only {collected}/{min_conversations} conversations collected",
        }
    job = fine_tuner.create_training_job()
    return {"status": "triggered", "job_id": job.job_id, "conversations": collected}


async def health_summary_compilation(
    health_agent: Any = None,
) -> Dict[str, Any]:
    """Compile a daily health summary."""
    if health_agent is None:
        return {"status": "skipped", "reason": "No health agent"}
    try:
        summary = await health_agent.get_daily_summary() if asyncio.iscoroutinefunction(getattr(health_agent, "get_daily_summary", None)) else {}
        return {"status": "completed", "summary": summary}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


async def financial_daily_digest(
    financial_agent: Any = None,
) -> Dict[str, Any]:
    """Generate daily financial digest."""
    if financial_agent is None:
        return {"status": "skipped", "reason": "No financial agent"}
    try:
        digest = await financial_agent.get_daily_digest() if asyncio.iscoroutinefunction(getattr(financial_agent, "get_daily_digest", None)) else {}
        return {"status": "completed", "digest": digest}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


async def email_digest(
    email_service: Any = None,
    max_emails: int = 20,
) -> Dict[str, Any]:
    """Generate email digest of unread/important emails."""
    if email_service is None:
        return {"status": "skipped", "reason": "No email service"}
    try:
        emails = await email_service.get_unread(limit=max_emails) if asyncio.iscoroutinefunction(getattr(email_service, "get_unread", None)) else []
        return {
            "status": "completed",
            "unread_count": len(emails),
            "emails": emails,
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


async def home_energy_report(
    home_agent: Any = None,
) -> Dict[str, Any]:
    """Generate daily home energy usage report."""
    if home_agent is None:
        return {"status": "skipped", "reason": "No home agent"}
    try:
        report = await home_agent.get_energy_report() if asyncio.iscoroutinefunction(getattr(home_agent, "get_energy_report", None)) else {}
        return {"status": "completed", "report": report}
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


async def system_maintenance(
    data_dir: str = "./data",
    temp_dirs: Optional[List[str]] = None,
    max_age_days: int = 30,
) -> Dict[str, Any]:
    """Run system maintenance: clean temp files, check disk usage."""
    cleaned_files = 0
    cleaned_bytes = 0
    errors: List[str] = []

    # Clean temp directories
    for temp_dir in (temp_dirs or [os.path.join(data_dir, "tmp")]):
        if not os.path.exists(temp_dir):
            continue
        cutoff = time.time() - (max_age_days * 86400)
        try:
            for entry in os.scandir(temp_dir):
                if entry.is_file() and entry.stat().st_mtime < cutoff:
                    size = entry.stat().st_size
                    os.unlink(entry.path)
                    cleaned_files += 1
                    cleaned_bytes += size
        except Exception as exc:
            errors.append(f"Error cleaning {temp_dir}: {exc}")

    # Check disk usage
    try:
        usage = shutil.disk_usage(data_dir)
        disk_info = {
            "total_gb": round(usage.total / (1024**3), 2),
            "used_gb": round(usage.used / (1024**3), 2),
            "free_gb": round(usage.free / (1024**3), 2),
            "percent_used": round(usage.used / usage.total * 100, 1),
        }
    except Exception:
        disk_info = {}

    return {
        "status": "completed",
        "cleaned_files": cleaned_files,
        "cleaned_bytes": cleaned_bytes,
        "disk": disk_info,
        "errors": errors,
    }


async def backup_verification(
    backup_dir: str = "./data/backups",
    expected_backups: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Verify that recent backups exist and are not zero-size."""
    if not os.path.exists(backup_dir):
        return {"status": "warning", "message": "Backup directory does not exist", "path": backup_dir}

    backups: List[Dict[str, Any]] = []
    now = time.time()
    for entry in sorted(os.scandir(backup_dir), key=lambda e: e.stat().st_mtime, reverse=True):
        if entry.is_file():
            stat = entry.stat()
            age_hours = (now - stat.st_mtime) / 3600
            backups.append({
                "name": entry.name,
                "size_bytes": stat.st_size,
                "age_hours": round(age_hours, 1),
                "valid": stat.st_size > 0,
            })

    has_recent = any(b["age_hours"] < 25 for b in backups)
    all_valid = all(b["valid"] for b in backups[:5])

    return {
        "status": "ok" if has_recent and all_valid else "warning",
        "has_recent_backup": has_recent,
        "all_recent_valid": all_valid,
        "backup_count": len(backups),
        "recent_backups": backups[:10],
    }


async def log_rotation(
    log_dir: str = "./logs",
    max_log_files: int = 30,
    max_log_size_mb: int = 50,
) -> Dict[str, Any]:
    """Rotate and compress old log files."""
    if not os.path.exists(log_dir):
        return {"status": "skipped", "reason": "Log directory does not exist"}

    rotated = 0
    deleted = 0
    log_files = sorted(
        [e for e in os.scandir(log_dir) if e.is_file() and e.name.endswith(".log")],
        key=lambda e: e.stat().st_mtime,
        reverse=True,
    )

    # Delete old log files beyond max count
    if len(log_files) > max_log_files:
        for old in log_files[max_log_files:]:
            try:
                os.unlink(old.path)
                deleted += 1
            except Exception:
                pass

    # Check for oversized log files
    for lf in log_files[:max_log_files]:
        try:
            size_mb = lf.stat().st_size / (1024 * 1024)
            if size_mb > max_log_size_mb:
                # Truncate by keeping last 1MB
                with open(lf.path, "rb") as f:
                    f.seek(-min(1024 * 1024, lf.stat().st_size), 2)
                    tail = f.read()
                with open(lf.path, "wb") as f:
                    f.write(tail)
                rotated += 1
        except Exception:
            pass

    return {"status": "completed", "rotated": rotated, "deleted": deleted, "total_logs": len(log_files)}


async def memory_consolidation(
    memory_agent: Any = None,
    embedding_model: Any = None,
) -> Dict[str, Any]:
    """Consolidate and clean up memory storage."""
    results: Dict[str, Any] = {"status": "completed"}

    if memory_agent:
        try:
            if hasattr(memory_agent, "consolidate"):
                consolidation = await memory_agent.consolidate() if asyncio.iscoroutinefunction(memory_agent.consolidate) else memory_agent.consolidate()
                results["memory_consolidation"] = consolidation
        except Exception as exc:
            results["memory_error"] = str(exc)

    if embedding_model:
        try:
            embedding_model.save()
            results["embeddings_saved"] = True
            results["embedding_stats"] = embedding_model.stats()
        except Exception as exc:
            results["embedding_error"] = str(exc)

    return results


# ---------------------------------------------------------------------------
# Daily Routine Manager
# ---------------------------------------------------------------------------


class DailyRoutineManager:
    """Orchestrates all daily routines and integrates with the job manager."""

    def __init__(
        self,
        job_manager: Any = None,
        data_dir: str = "./data",
    ) -> None:
        self.job_manager = job_manager
        self.data_dir = data_dir
        self._agents: Dict[str, Any] = {}
        self._services: Dict[str, Any] = {}
        self._routine_results: List[RoutineResult] = []
        self._routines: Dict[str, Callable] = {}
        self._register_default_routines()

    def set_agent(self, name: str, agent: Any) -> None:
        self._agents[name] = agent

    def set_service(self, name: str, service: Any) -> None:
        self._services[name] = service

    def _register_default_routines(self) -> None:
        """Register all default daily routines."""
        self._routines = {
            "morning_briefing": self._run_morning_briefing,
            "model_training": self._run_model_training,
            "health_summary": self._run_health_summary,
            "financial_digest": self._run_financial_digest,
            "email_digest": self._run_email_digest,
            "energy_report": self._run_energy_report,
            "system_maintenance": self._run_system_maintenance,
            "backup_verification": self._run_backup_verification,
            "log_rotation": self._run_log_rotation,
            "memory_consolidation": self._run_memory_consolidation,
        }

    def register_routine(self, name: str, func: Callable) -> None:
        self._routines[name] = func

    # -- individual routine wrappers -----------------------------------------

    async def _run_morning_briefing(self) -> Dict[str, Any]:
        return await morning_briefing(
            llm_manager=self._agents.get("llm_manager"),
            health_agent=self._agents.get("health"),
            financial_agent=self._agents.get("financial"),
            task_agent=self._agents.get("task"),
        )

    async def _run_model_training(self) -> Dict[str, Any]:
        return await daily_model_training_trigger(
            fine_tuner=self._agents.get("fine_tuner"),
        )

    async def _run_health_summary(self) -> Dict[str, Any]:
        return await health_summary_compilation(
            health_agent=self._agents.get("health"),
        )

    async def _run_financial_digest(self) -> Dict[str, Any]:
        return await financial_daily_digest(
            financial_agent=self._agents.get("financial"),
        )

    async def _run_email_digest(self) -> Dict[str, Any]:
        return await email_digest(
            email_service=self._services.get("email"),
        )

    async def _run_energy_report(self) -> Dict[str, Any]:
        return await home_energy_report(
            home_agent=self._agents.get("home"),
        )

    async def _run_system_maintenance(self) -> Dict[str, Any]:
        return await system_maintenance(data_dir=self.data_dir)

    async def _run_backup_verification(self) -> Dict[str, Any]:
        return await backup_verification(
            backup_dir=os.path.join(self.data_dir, "backups"),
        )

    async def _run_log_rotation(self) -> Dict[str, Any]:
        return await log_rotation(log_dir="./logs")

    async def _run_memory_consolidation(self) -> Dict[str, Any]:
        return await memory_consolidation(
            memory_agent=self._agents.get("memory"),
            embedding_model=self._agents.get("embedding_model"),
        )

    # -- execution -----------------------------------------------------------

    async def run_routine(self, name: str) -> RoutineResult:
        func = self._routines.get(name)
        if not func:
            return RoutineResult(name=name, success=False, error=f"Unknown routine: {name}")

        start = time.monotonic()
        try:
            data = await func()
            result = RoutineResult(name=name, success=True, data=data)
        except Exception as exc:
            logger.error("Routine %s failed: %s", name, exc)
            result = RoutineResult(name=name, success=False, error=str(exc))
        result.duration_ms = round((time.monotonic() - start) * 1000, 2)
        self._routine_results.append(result)
        return result

    async def run_all_morning(self) -> List[Dict[str, Any]]:
        """Run all morning routines in order."""
        morning_sequence = [
            "system_maintenance",
            "log_rotation",
            "backup_verification",
            "memory_consolidation",
            "health_summary",
            "financial_digest",
            "email_digest",
            "energy_report",
            "morning_briefing",
        ]
        results: List[Dict[str, Any]] = []
        for name in morning_sequence:
            result = await self.run_routine(name)
            results.append(result.to_dict())
        return results

    async def run_all_evening(self) -> List[Dict[str, Any]]:
        """Run evening routines."""
        evening_sequence = [
            "memory_consolidation",
            "system_maintenance",
            "model_training",
        ]
        results: List[Dict[str, Any]] = []
        for name in evening_sequence:
            result = await self.run_routine(name)
            results.append(result.to_dict())
        return results

    async def run_custom(self, routine_names: List[str]) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for name in routine_names:
            result = await self.run_routine(name)
            results.append(result.to_dict())
        return results

    # -- scheduling integration ----------------------------------------------

    def schedule_daily_routines(self) -> List[str]:
        """Register daily routines with the job manager."""
        if not self.job_manager:
            return []

        scheduled: List[str] = []
        schedules = {
            "morning_briefing": "0 7 * * *",
            "model_training": "0 2 * * *",
            "health_summary": "0 21 * * *",
            "financial_digest": "0 18 * * *",
            "email_digest": "0 8 * * *",
            "energy_report": "0 22 * * *",
            "system_maintenance": "0 3 * * *",
            "backup_verification": "0 4 * * *",
            "log_rotation": "0 3 * * 0",
            "memory_consolidation": "0 1 * * *",
        }

        for routine_name, cron in schedules.items():
            func = self._routines.get(routine_name)
            if func:
                self.job_manager.register_function(f"routine_{routine_name}", func)
                self.job_manager.create_job(
                    name=f"Daily: {routine_name.replace('_', ' ').title()}",
                    func_name=f"routine_{routine_name}",
                    category="system",
                    cron=cron,
                    tags=["daily", "routine"],
                )
                scheduled.append(routine_name)

        return scheduled

    # -- history / stats -----------------------------------------------------

    def get_results(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [r.to_dict() for r in self._routine_results[-limit:]]

    def list_routines(self) -> List[str]:
        return list(self._routines.keys())

    def stats(self) -> Dict[str, Any]:
        total = len(self._routine_results)
        successes = sum(1 for r in self._routine_results if r.success)
        return {
            "registered_routines": list(self._routines.keys()),
            "total_executions": total,
            "successes": successes,
            "failures": total - successes,
            "success_rate": round(successes / max(total, 1) * 100, 1),
        }
