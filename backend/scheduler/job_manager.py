"""
Nexus AI OS - Job Manager
APScheduler integration with job CRUD, cron parsing, history tracking,
dependencies, retry logic, priority queue, and execution statistics.
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional, Tuple

logger = logging.getLogger("nexus.scheduler.job_manager")

# ---------------------------------------------------------------------------
# Enums / data types
# ---------------------------------------------------------------------------

class JobCategory(str, Enum):
    SYSTEM = "system"
    USER = "user"
    TRAINING = "training"
    MONITORING = "monitoring"
    AUTOMATION = "automation"


class JobStatus(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class JobPriority(int, Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


class JobRecord:
    """Full record of a scheduled job."""

    def __init__(
        self,
        job_id: str,
        name: str,
        func_name: str,
        category: JobCategory = JobCategory.USER,
        priority: JobPriority = JobPriority.NORMAL,
        cron: Optional[str] = None,
        interval_seconds: Optional[int] = None,
        run_date: Optional[str] = None,
        max_retries: int = 3,
        retry_backoff: float = 2.0,
        timeout_seconds: Optional[int] = None,
        depends_on: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        kwargs: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.job_id = job_id
        self.name = name
        self.func_name = func_name
        self.category = category
        self.priority = priority
        self.cron = cron
        self.interval_seconds = interval_seconds
        self.run_date = run_date
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff
        self.timeout_seconds = timeout_seconds
        self.depends_on = depends_on or []
        self.tags = tags or []
        self.kwargs = kwargs or {}

        self.status: JobStatus = JobStatus.PENDING
        self.created_at: str = datetime.now(timezone.utc).isoformat()
        self.last_run: Optional[str] = None
        self.next_run: Optional[str] = None
        self.run_count: int = 0
        self.success_count: int = 0
        self.fail_count: int = 0
        self.retry_count: int = 0
        self.last_error: Optional[str] = None
        self.last_duration_ms: float = 0.0
        self.avg_duration_ms: float = 0.0
        self.enabled: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "name": self.name,
            "func_name": self.func_name,
            "category": self.category.value,
            "priority": self.priority.value,
            "cron": self.cron,
            "interval_seconds": self.interval_seconds,
            "run_date": self.run_date,
            "max_retries": self.max_retries,
            "status": self.status.value,
            "created_at": self.created_at,
            "last_run": self.last_run,
            "next_run": self.next_run,
            "run_count": self.run_count,
            "success_count": self.success_count,
            "fail_count": self.fail_count,
            "retry_count": self.retry_count,
            "last_error": self.last_error,
            "last_duration_ms": self.last_duration_ms,
            "avg_duration_ms": self.avg_duration_ms,
            "enabled": self.enabled,
            "depends_on": self.depends_on,
            "tags": self.tags,
        }


class JobHistoryEntry:
    def __init__(
        self,
        job_id: str,
        status: JobStatus,
        started_at: str,
        finished_at: str,
        duration_ms: float,
        error: Optional[str] = None,
        result: Any = None,
    ) -> None:
        self.job_id = job_id
        self.status = status
        self.started_at = started_at
        self.finished_at = finished_at
        self.duration_ms = duration_ms
        self.error = error
        self.result = result

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status.value,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_ms": self.duration_ms,
            "error": self.error,
        }


# ---------------------------------------------------------------------------
# Cron expression helper
# ---------------------------------------------------------------------------


def parse_cron_expression(cron_str: str) -> Dict[str, Any]:
    """Parse a 5-field cron expression into APScheduler CronTrigger kwargs."""
    parts = cron_str.strip().split()
    if len(parts) != 5:
        raise ValueError(f"Expected 5 fields in cron expression, got {len(parts)}: {cron_str}")

    field_names = ["minute", "hour", "day", "month", "day_of_week"]
    kwargs: Dict[str, Any] = {}
    for name, value in zip(field_names, parts):
        if value != "*":
            kwargs[name] = value
    return kwargs


# ---------------------------------------------------------------------------
# Job Manager
# ---------------------------------------------------------------------------


class JobManager:
    """Manages scheduled jobs using APScheduler (or a lightweight fallback)."""

    def __init__(
        self,
        max_concurrent: int = 5,
        history_limit: int = 1000,
    ) -> None:
        self.max_concurrent = max_concurrent
        self.history_limit = history_limit
        self.jobs: Dict[str, JobRecord] = {}
        self.history: List[JobHistoryEntry] = []
        self._func_registry: Dict[str, Callable] = {}
        self._scheduler: Any = None
        self._running_count = 0
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._started = False

    # -- scheduler lifecycle -------------------------------------------------

    async def start(self) -> None:
        """Start the underlying APScheduler (or init the fallback loop)."""
        if self._started:
            return
        self._semaphore = asyncio.Semaphore(self.max_concurrent)
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore
            from apscheduler.triggers.cron import CronTrigger  # type: ignore
            from apscheduler.triggers.interval import IntervalTrigger  # type: ignore
            from apscheduler.triggers.date import DateTrigger  # type: ignore

            self._scheduler = AsyncIOScheduler()
            self._scheduler.start()
            logger.info("APScheduler started")
        except ImportError:
            logger.warning("APScheduler not installed; using simple loop fallback")
            self._scheduler = None
        self._started = True
        # Re-schedule existing enabled jobs
        for rec in self.jobs.values():
            if rec.enabled and rec.status in (JobStatus.PENDING, JobStatus.SCHEDULED):
                self._schedule_with_backend(rec)

    async def stop(self) -> None:
        if self._scheduler is not None:
            self._scheduler.shutdown(wait=False)
        self._started = False

    # -- function registry ---------------------------------------------------

    def register_function(self, name: str, func: Callable) -> None:
        self._func_registry[name] = func

    def get_function(self, name: str) -> Optional[Callable]:
        return self._func_registry.get(name)

    # -- CRUD ----------------------------------------------------------------

    def create_job(
        self,
        name: str,
        func_name: str,
        category: JobCategory = JobCategory.USER,
        priority: JobPriority = JobPriority.NORMAL,
        cron: Optional[str] = None,
        interval_seconds: Optional[int] = None,
        run_date: Optional[str] = None,
        max_retries: int = 3,
        retry_backoff: float = 2.0,
        timeout_seconds: Optional[int] = None,
        depends_on: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        kwargs: Optional[Dict[str, Any]] = None,
    ) -> JobRecord:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        rec = JobRecord(
            job_id=job_id,
            name=name,
            func_name=func_name,
            category=category,
            priority=priority,
            cron=cron,
            interval_seconds=interval_seconds,
            run_date=run_date,
            max_retries=max_retries,
            retry_backoff=retry_backoff,
            timeout_seconds=timeout_seconds,
            depends_on=depends_on,
            tags=tags,
            kwargs=kwargs,
        )
        rec.status = JobStatus.SCHEDULED
        self.jobs[job_id] = rec

        if self._started:
            self._schedule_with_backend(rec)

        logger.info("Created job %s (%s)", name, job_id)
        return rec

    def update_job(self, job_id: str, **updates: Any) -> Optional[JobRecord]:
        rec = self.jobs.get(job_id)
        if not rec:
            return None
        for key, value in updates.items():
            if hasattr(rec, key):
                setattr(rec, key, value)
        if self._started:
            self._reschedule(rec)
        return rec

    def delete_job(self, job_id: str) -> bool:
        rec = self.jobs.pop(job_id, None)
        if not rec:
            return False
        self._remove_from_backend(job_id)
        rec.status = JobStatus.CANCELLED
        return True

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        rec = self.jobs.get(job_id)
        return rec.to_dict() if rec else None

    def list_jobs(
        self,
        category: Optional[JobCategory] = None,
        status: Optional[JobStatus] = None,
        tag: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for rec in self.jobs.values():
            if category and rec.category != category:
                continue
            if status and rec.status != status:
                continue
            if tag and tag not in rec.tags:
                continue
            results.append(rec.to_dict())
        results.sort(key=lambda j: j["priority"], reverse=True)
        return results

    def pause_job(self, job_id: str) -> bool:
        rec = self.jobs.get(job_id)
        if not rec:
            return False
        rec.enabled = False
        rec.status = JobStatus.PAUSED
        self._remove_from_backend(job_id)
        return True

    def resume_job(self, job_id: str) -> bool:
        rec = self.jobs.get(job_id)
        if not rec:
            return False
        rec.enabled = True
        rec.status = JobStatus.SCHEDULED
        if self._started:
            self._schedule_with_backend(rec)
        return True

    # -- backend scheduling --------------------------------------------------

    def _schedule_with_backend(self, rec: JobRecord) -> None:
        if self._scheduler is None:
            return
        try:
            from apscheduler.triggers.cron import CronTrigger  # type: ignore
            from apscheduler.triggers.interval import IntervalTrigger  # type: ignore
            from apscheduler.triggers.date import DateTrigger  # type: ignore

            trigger: Any = None
            if rec.cron:
                cron_kwargs = parse_cron_expression(rec.cron)
                trigger = CronTrigger(**cron_kwargs)
            elif rec.interval_seconds:
                trigger = IntervalTrigger(seconds=rec.interval_seconds)
            elif rec.run_date:
                trigger = DateTrigger(run_date=rec.run_date)
            else:
                return

            self._scheduler.add_job(
                self._execute_job_wrapper,
                trigger=trigger,
                id=rec.job_id,
                args=[rec.job_id],
                replace_existing=True,
                name=rec.name,
            )
            job = self._scheduler.get_job(rec.job_id)
            if job and job.next_run_time:
                rec.next_run = job.next_run_time.isoformat()
        except Exception as exc:
            logger.error("Failed to schedule job %s: %s", rec.job_id, exc)

    def _reschedule(self, rec: JobRecord) -> None:
        self._remove_from_backend(rec.job_id)
        if rec.enabled:
            self._schedule_with_backend(rec)

    def _remove_from_backend(self, job_id: str) -> None:
        if self._scheduler is None:
            return
        try:
            self._scheduler.remove_job(job_id)
        except Exception:
            pass

    # -- execution -----------------------------------------------------------

    async def _execute_job_wrapper(self, job_id: str) -> None:
        rec = self.jobs.get(job_id)
        if not rec or not rec.enabled:
            return

        # check dependencies
        for dep_id in rec.depends_on:
            dep = self.jobs.get(dep_id)
            if dep and dep.status != JobStatus.COMPLETED:
                logger.info("Job %s waiting on dependency %s", job_id, dep_id)
                return

        assert self._semaphore is not None
        async with self._semaphore:
            await self._run_job(rec)

    async def _run_job(self, rec: JobRecord, attempt: int = 0) -> None:
        func = self.get_function(rec.func_name)
        if not func:
            rec.status = JobStatus.FAILED
            rec.last_error = f"Function '{rec.func_name}' not registered"
            logger.error(rec.last_error)
            return

        rec.status = JobStatus.RUNNING
        start = time.monotonic()
        started_at = datetime.now(timezone.utc).isoformat()
        rec.last_run = started_at

        try:
            if rec.timeout_seconds:
                result = await asyncio.wait_for(
                    self._invoke(func, rec.kwargs),
                    timeout=rec.timeout_seconds,
                )
            else:
                result = await self._invoke(func, rec.kwargs)

            elapsed_ms = (time.monotonic() - start) * 1000
            rec.status = JobStatus.COMPLETED
            rec.run_count += 1
            rec.success_count += 1
            rec.last_duration_ms = elapsed_ms
            rec.avg_duration_ms = (
                (rec.avg_duration_ms * (rec.run_count - 1) + elapsed_ms) / rec.run_count
            )
            rec.last_error = None

            self._record_history(rec.job_id, JobStatus.COMPLETED, started_at, elapsed_ms, result=result)
            logger.info("Job %s completed in %.1fms", rec.name, elapsed_ms)

            # If it's a recurring job, set status back to scheduled
            if rec.cron or rec.interval_seconds:
                rec.status = JobStatus.SCHEDULED

        except asyncio.TimeoutError:
            elapsed_ms = (time.monotonic() - start) * 1000
            rec.last_error = "Timeout"
            await self._handle_failure(rec, attempt, started_at, elapsed_ms, "Timeout")

        except Exception as exc:
            elapsed_ms = (time.monotonic() - start) * 1000
            rec.last_error = str(exc)
            await self._handle_failure(rec, attempt, started_at, elapsed_ms, str(exc))

    async def _invoke(self, func: Callable, kwargs: Dict[str, Any]) -> Any:
        if asyncio.iscoroutinefunction(func):
            return await func(**kwargs)
        return func(**kwargs)

    async def _handle_failure(
        self,
        rec: JobRecord,
        attempt: int,
        started_at: str,
        elapsed_ms: float,
        error: str,
    ) -> None:
        rec.run_count += 1
        rec.fail_count += 1
        self._record_history(rec.job_id, JobStatus.FAILED, started_at, elapsed_ms, error=error)

        if attempt < rec.max_retries:
            rec.status = JobStatus.RETRYING
            rec.retry_count += 1
            delay = rec.retry_backoff ** attempt
            logger.warning("Job %s failed (attempt %d/%d), retrying in %.1fs: %s",
                           rec.name, attempt + 1, rec.max_retries, delay, error)
            await asyncio.sleep(delay)
            await self._run_job(rec, attempt + 1)
        else:
            rec.status = JobStatus.FAILED
            logger.error("Job %s failed permanently after %d attempts: %s",
                         rec.name, rec.max_retries, error)

    def _record_history(
        self,
        job_id: str,
        status: JobStatus,
        started_at: str,
        elapsed_ms: float,
        error: Optional[str] = None,
        result: Any = None,
    ) -> None:
        entry = JobHistoryEntry(
            job_id=job_id,
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc).isoformat(),
            duration_ms=round(elapsed_ms, 2),
            error=error,
            result=result,
        )
        self.history.append(entry)
        if len(self.history) > self.history_limit:
            self.history = self.history[-self.history_limit:]

    # -- manual execution ----------------------------------------------------

    async def run_now(self, job_id: str) -> Dict[str, Any]:
        rec = self.jobs.get(job_id)
        if not rec:
            return {"error": "Job not found"}
        await self._run_job(rec)
        return rec.to_dict()

    # -- history / stats -----------------------------------------------------

    def get_history(
        self,
        job_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        entries = self.history
        if job_id:
            entries = [e for e in entries if e.job_id == job_id]
        return [e.to_dict() for e in entries[-limit:]]

    def get_stats(self) -> Dict[str, Any]:
        total = len(self.jobs)
        by_status: Dict[str, int] = {}
        by_category: Dict[str, int] = {}
        for rec in self.jobs.values():
            by_status[rec.status.value] = by_status.get(rec.status.value, 0) + 1
            by_category[rec.category.value] = by_category.get(rec.category.value, 0) + 1

        total_runs = sum(r.run_count for r in self.jobs.values())
        total_successes = sum(r.success_count for r in self.jobs.values())
        total_failures = sum(r.fail_count for r in self.jobs.values())

        return {
            "total_jobs": total,
            "by_status": by_status,
            "by_category": by_category,
            "total_runs": total_runs,
            "total_successes": total_successes,
            "total_failures": total_failures,
            "success_rate": round(total_successes / max(total_runs, 1) * 100, 1),
            "history_entries": len(self.history),
            "max_concurrent": self.max_concurrent,
            "registered_functions": list(self._func_registry.keys()),
        }

    def get_upcoming(self, limit: int = 10) -> List[Dict[str, Any]]:
        scheduled = [
            r for r in self.jobs.values()
            if r.next_run and r.enabled and r.status == JobStatus.SCHEDULED
        ]
        scheduled.sort(key=lambda r: r.next_run or "")
        return [r.to_dict() for r in scheduled[:limit]]

    def clear_history(self) -> int:
        count = len(self.history)
        self.history.clear()
        return count

    def clear_completed(self) -> int:
        completed = [jid for jid, r in self.jobs.items() if r.status == JobStatus.COMPLETED and not r.cron and not r.interval_seconds]
        for jid in completed:
            del self.jobs[jid]
        return len(completed)
