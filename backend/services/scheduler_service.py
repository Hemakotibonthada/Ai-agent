# NEXUS AI - Scheduler Service
"""
APScheduler-based task scheduling service with cron jobs, recurring tasks,
event-driven triggers, health monitoring schedules, and job lifecycle
management for the NEXUS AI OS.
"""

import asyncio
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional, Union

from apscheduler.events import (
    EVENT_JOB_ERROR,
    EVENT_JOB_EXECUTED,
    EVENT_JOB_MISSED,
    JobEvent,
    JobExecutionEvent,
)
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger

from core.config import NexusSettings, settings
from core.events import Event, EventBus, EventCategory, EventPriority, event_bus
from core.logger import nexus_logger


class JobType(str, Enum):
    """Types of scheduled jobs."""
    ONE_TIME = "one_time"
    INTERVAL = "interval"
    CRON = "cron"
    EVENT_DRIVEN = "event_driven"


class JobPriority(str, Enum):
    """Job priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class ScheduledJob:
    """Metadata container for a scheduled job."""

    def __init__(
        self,
        job_id: str,
        name: str,
        job_type: JobType,
        description: str = "",
        priority: JobPriority = JobPriority.NORMAL,
        tags: Optional[List[str]] = None,
        max_retries: int = 3,
        retry_delay_seconds: int = 60,
        enabled: bool = True,
    ):
        self.job_id: str = job_id
        self.name: str = name
        self.job_type: JobType = job_type
        self.description: str = description
        self.priority: JobPriority = priority
        self.tags: List[str] = tags or []
        self.max_retries: int = max_retries
        self.retry_delay_seconds: int = retry_delay_seconds
        self.enabled: bool = enabled
        self.created_at: datetime = datetime.utcnow()
        self.last_run: Optional[datetime] = None
        self.next_run: Optional[datetime] = None
        self.run_count: int = 0
        self.error_count: int = 0
        self.last_error: Optional[str] = None
        self.last_duration_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Serialize job metadata to dictionary."""
        return {
            "job_id": self.job_id,
            "name": self.name,
            "job_type": self.job_type.value,
            "description": self.description,
            "priority": self.priority.value,
            "tags": self.tags,
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat(),
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "run_count": self.run_count,
            "error_count": self.error_count,
            "last_error": self.last_error,
            "last_duration_ms": self.last_duration_ms,
        }


class SchedulerService:
    """
    Advanced scheduling service for NEXUS AI.

    Provides:
    - One-time, interval, and cron-based job scheduling
    - Event-driven triggers via event bus integration
    - Job lifecycle tracking (run count, errors, next run)
    - Built-in health monitoring schedules
    - Priority-based job management
    - Retry logic with configurable backoff
    - Tag-based job grouping and retrieval
    """

    def __init__(self, config: Optional[NexusSettings] = None,
                 event_bus_instance: Optional[EventBus] = None):
        self._config: NexusSettings = config or settings
        self._event_bus: EventBus = event_bus_instance or event_bus
        self._scheduler: Optional[AsyncIOScheduler] = None
        self._jobs: Dict[str, ScheduledJob] = {}
        self._job_functions: Dict[str, Callable] = {}
        self._event_triggers: Dict[str, List[str]] = {}
        self._initialized: bool = False
        self._running: bool = False
        self._total_executions: int = 0
        self._total_errors: int = 0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize APScheduler and register default health check jobs."""
        try:
            logger.info("Initializing SchedulerService...")
            job_stores = {"default": MemoryJobStore()}
            self._scheduler = AsyncIOScheduler(
                jobstores=job_stores,
                job_defaults={
                    "coalesce": True,
                    "max_instances": 3,
                    "misfire_grace_time": 60,
                },
            )
            self._scheduler.add_listener(self._on_job_executed, EVENT_JOB_EXECUTED)
            self._scheduler.add_listener(self._on_job_error, EVENT_JOB_ERROR)
            self._scheduler.add_listener(self._on_job_missed, EVENT_JOB_MISSED)

            self._scheduler.start()
            self._running = True
            self._initialized = True

            await self._register_default_jobs()

            await self._event_bus.emit(
                "scheduler.initialized",
                {"jobs_registered": len(self._jobs)},
                source="scheduler_service",
                category=EventCategory.SYSTEM,
            )
            logger.info(f"SchedulerService initialized — {len(self._jobs)} default jobs registered")
        except Exception as exc:
            logger.error(f"SchedulerService initialization failed: {exc}")
            self._initialized = True

    async def shutdown(self) -> None:
        """Gracefully shut down the scheduler."""
        try:
            logger.info("Shutting down SchedulerService...")
            if self._scheduler and self._running:
                self._scheduler.shutdown(wait=False)
            self._running = False
            self._initialized = False
            logger.info("SchedulerService shut down complete")
        except Exception as exc:
            logger.error(f"Error during SchedulerService shutdown: {exc}")

    # ------------------------------------------------------------------
    # Default Jobs
    # ------------------------------------------------------------------

    async def _register_default_jobs(self) -> None:
        """Set up built-in health monitoring and maintenance jobs."""
        await self.add_interval_job(
            name="system_health_check",
            func=self._default_health_check,
            seconds=300,
            description="Periodic system health check",
            tags=["system", "health"],
        )

        await self.add_cron_job(
            name="daily_cleanup",
            func=self._default_daily_cleanup,
            hour=4, minute=0,
            description="Daily data cleanup and optimization",
            tags=["system", "maintenance"],
        )

        await self.add_cron_job(
            name="daily_training",
            func=self._default_training_trigger,
            hour=self._config.scheduler.training_schedule_hour,
            minute=self._config.scheduler.training_schedule_minute,
            description="Daily model training trigger",
            tags=["ai", "training"],
        )

        await self.add_cron_job(
            name="daily_backup",
            func=self._default_backup_trigger,
            hour=self._config.scheduler.backup_schedule_hour,
            minute=self._config.scheduler.backup_schedule_minute,
            description="Daily database backup trigger",
            tags=["system", "backup"],
        )

        await self.add_interval_job(
            name="event_bus_stats",
            func=self._default_event_bus_stats,
            seconds=600,
            description="Log event bus statistics periodically",
            tags=["system", "monitoring"],
        )

    async def _default_health_check(self) -> None:
        """Default health check job — emits a health event."""
        await self._event_bus.emit(
            "scheduler.health_check",
            {"timestamp": datetime.utcnow().isoformat(), "jobs": len(self._jobs)},
            source="scheduler_service",
            category=EventCategory.SYSTEM,
        )
        logger.debug("Scheduler health check executed")

    async def _default_daily_cleanup(self) -> None:
        """Default daily cleanup — emits event for other services to handle."""
        await self._event_bus.emit(
            "system.daily_cleanup",
            {"timestamp": datetime.utcnow().isoformat()},
            source="scheduler_service",
            category=EventCategory.SYSTEM,
            priority=EventPriority.LOW,
        )
        logger.info("Daily cleanup trigger emitted")

    async def _default_training_trigger(self) -> None:
        """Default training trigger — emits training event."""
        await self._event_bus.emit(
            "training.daily_trigger",
            {"timestamp": datetime.utcnow().isoformat()},
            source="scheduler_service",
            category=EventCategory.TRAINING,
            priority=EventPriority.NORMAL,
        )
        logger.info("Daily training trigger emitted")

    async def _default_backup_trigger(self) -> None:
        """Default backup trigger — emits backup event."""
        await self._event_bus.emit(
            "system.daily_backup",
            {"timestamp": datetime.utcnow().isoformat()},
            source="scheduler_service",
            category=EventCategory.SYSTEM,
            priority=EventPriority.HIGH,
        )
        logger.info("Daily backup trigger emitted")

    async def _default_event_bus_stats(self) -> None:
        """Log event bus statistics."""
        stats = self._event_bus.get_stats()
        nexus_logger.log_system_event("event_bus_stats", json.dumps(stats) if isinstance(stats, dict) else str(stats))
        logger.debug(f"Event bus stats: {stats}")

    # ------------------------------------------------------------------
    # Job Scheduling — Interval
    # ------------------------------------------------------------------

    async def add_interval_job(
        self,
        name: str,
        func: Callable,
        seconds: int = 0,
        minutes: int = 0,
        hours: int = 0,
        description: str = "",
        priority: JobPriority = JobPriority.NORMAL,
        tags: Optional[List[str]] = None,
        max_retries: int = 3,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> str:
        """
        Schedule a recurring job at a fixed interval.

        Args:
            name: Human-readable job name.
            func: Async callable to execute.
            seconds: Interval seconds component.
            minutes: Interval minutes component.
            hours: Interval hours component.
            description: Job description.
            priority: Job priority level.
            tags: Tags for grouping and filtering.
            max_retries: Maximum retry attempts on failure.
            start_date: When to start scheduling.
            end_date: When to stop scheduling.

        Returns:
            Job ID.
        """
        job_id = f"interval_{name}_{uuid.uuid4().hex[:8]}"
        try:
            trigger = IntervalTrigger(
                seconds=seconds, minutes=minutes, hours=hours,
                start_date=start_date, end_date=end_date,
            )
            wrapper = self._create_job_wrapper(job_id, func)
            self._scheduler.add_job(
                wrapper, trigger, id=job_id, name=name,
                replace_existing=True,
            )
            meta = ScheduledJob(
                job_id=job_id, name=name, job_type=JobType.INTERVAL,
                description=description, priority=priority, tags=tags,
                max_retries=max_retries,
            )
            apscheduler_job = self._scheduler.get_job(job_id)
            if apscheduler_job and apscheduler_job.next_run_time:
                meta.next_run = apscheduler_job.next_run_time.replace(tzinfo=None)
            self._jobs[job_id] = meta
            self._job_functions[job_id] = func
            logger.info(f"Interval job added: {name} (every {hours}h {minutes}m {seconds}s)")
            return job_id
        except Exception as exc:
            logger.error(f"Failed to add interval job '{name}': {exc}")
            raise

    # ------------------------------------------------------------------
    # Job Scheduling — Cron
    # ------------------------------------------------------------------

    async def add_cron_job(
        self,
        name: str,
        func: Callable,
        year: Optional[Union[int, str]] = None,
        month: Optional[Union[int, str]] = None,
        day: Optional[Union[int, str]] = None,
        week: Optional[Union[int, str]] = None,
        day_of_week: Optional[Union[int, str]] = None,
        hour: Optional[Union[int, str]] = None,
        minute: Optional[Union[int, str]] = None,
        second: Optional[Union[int, str]] = None,
        description: str = "",
        priority: JobPriority = JobPriority.NORMAL,
        tags: Optional[List[str]] = None,
        max_retries: int = 3,
    ) -> str:
        """
        Schedule a job using cron-style timing.

        Args:
            name: Human-readable job name.
            func: Async callable to execute.
            year–second: Cron expression components.
            description: Job description.
            priority: Priority level.
            tags: Tags for grouping.
            max_retries: Maximum retry attempts.

        Returns:
            Job ID.
        """
        job_id = f"cron_{name}_{uuid.uuid4().hex[:8]}"
        try:
            trigger = CronTrigger(
                year=year, month=month, day=day, week=week,
                day_of_week=day_of_week, hour=hour, minute=minute, second=second,
            )
            wrapper = self._create_job_wrapper(job_id, func)
            self._scheduler.add_job(
                wrapper, trigger, id=job_id, name=name,
                replace_existing=True,
            )
            meta = ScheduledJob(
                job_id=job_id, name=name, job_type=JobType.CRON,
                description=description, priority=priority, tags=tags,
                max_retries=max_retries,
            )
            apscheduler_job = self._scheduler.get_job(job_id)
            if apscheduler_job and apscheduler_job.next_run_time:
                meta.next_run = apscheduler_job.next_run_time.replace(tzinfo=None)
            self._jobs[job_id] = meta
            self._job_functions[job_id] = func
            logger.info(f"Cron job added: {name}")
            return job_id
        except Exception as exc:
            logger.error(f"Failed to add cron job '{name}': {exc}")
            raise

    # ------------------------------------------------------------------
    # Job Scheduling — One-time
    # ------------------------------------------------------------------

    async def add_one_time_job(
        self,
        name: str,
        func: Callable,
        run_at: datetime,
        description: str = "",
        priority: JobPriority = JobPriority.NORMAL,
        tags: Optional[List[str]] = None,
    ) -> str:
        """
        Schedule a one-time job at a specific datetime.

        Args:
            name: Job name.
            func: Async callable.
            run_at: When to execute.
            description: Description.
            priority: Priority.
            tags: Tags.

        Returns:
            Job ID.
        """
        job_id = f"once_{name}_{uuid.uuid4().hex[:8]}"
        try:
            trigger = DateTrigger(run_date=run_at)
            wrapper = self._create_job_wrapper(job_id, func)
            self._scheduler.add_job(
                wrapper, trigger, id=job_id, name=name,
                replace_existing=True,
            )
            meta = ScheduledJob(
                job_id=job_id, name=name, job_type=JobType.ONE_TIME,
                description=description, priority=priority, tags=tags,
            )
            meta.next_run = run_at
            self._jobs[job_id] = meta
            self._job_functions[job_id] = func
            logger.info(f"One-time job added: {name} at {run_at.isoformat()}")
            return job_id
        except Exception as exc:
            logger.error(f"Failed to add one-time job '{name}': {exc}")
            raise

    # ------------------------------------------------------------------
    # Job Scheduling — Delayed
    # ------------------------------------------------------------------

    async def add_delayed_job(
        self,
        name: str,
        func: Callable,
        delay_seconds: int,
        description: str = "",
        priority: JobPriority = JobPriority.NORMAL,
        tags: Optional[List[str]] = None,
    ) -> str:
        """
        Schedule a job to run after a delay.

        Args:
            name: Job name.
            func: Async callable.
            delay_seconds: Seconds to wait before execution.
            description: Description.
            priority: Priority.
            tags: Tags.

        Returns:
            Job ID.
        """
        run_at = datetime.utcnow() + timedelta(seconds=delay_seconds)
        return await self.add_one_time_job(
            name=name, func=func, run_at=run_at,
            description=description, priority=priority, tags=tags,
        )

    # ------------------------------------------------------------------
    # Event-Driven Triggers
    # ------------------------------------------------------------------

    async def add_event_trigger(
        self,
        name: str,
        event_type: str,
        func: Callable,
        description: str = "",
        tags: Optional[List[str]] = None,
    ) -> str:
        """
        Register a job that fires when a specific event is emitted.

        Args:
            name: Job name.
            event_type: Event type to listen for.
            func: Async callable to invoke when event fires.
            description: Description.
            tags: Tags.

        Returns:
            Job ID.
        """
        job_id = f"event_{name}_{uuid.uuid4().hex[:8]}"
        try:
            meta = ScheduledJob(
                job_id=job_id, name=name, job_type=JobType.EVENT_DRIVEN,
                description=description, tags=tags,
            )
            self._jobs[job_id] = meta
            self._job_functions[job_id] = func

            if event_type not in self._event_triggers:
                self._event_triggers[event_type] = []
            self._event_triggers[event_type].append(job_id)

            async def _on_event(event: Event) -> None:
                if job_id in self._jobs and self._jobs[job_id].enabled:
                    await self._execute_job(job_id, event_data=event.data)

            self._event_bus.subscribe(
                event_type, _on_event, subscriber_id=f"scheduler_{job_id}",
            )
            logger.info(f"Event-driven job added: {name} — listening for '{event_type}'")
            return job_id
        except Exception as exc:
            logger.error(f"Failed to add event trigger '{name}': {exc}")
            raise

    # ------------------------------------------------------------------
    # Job Management
    # ------------------------------------------------------------------

    def remove_job(self, job_id: str) -> bool:
        """
        Remove a scheduled job.

        Args:
            job_id: Job ID to remove.

        Returns:
            True if removed.
        """
        try:
            if job_id in self._jobs:
                meta = self._jobs[job_id]
                if meta.job_type != JobType.EVENT_DRIVEN:
                    try:
                        self._scheduler.remove_job(job_id)
                    except Exception:
                        pass
                del self._jobs[job_id]
                self._job_functions.pop(job_id, None)
                logger.info(f"Job removed: {job_id}")
                return True
            return False
        except Exception as exc:
            logger.error(f"Error removing job {job_id}: {exc}")
            return False

    def pause_job(self, job_id: str) -> bool:
        """Pause a job (it stays registered but won't fire)."""
        if job_id in self._jobs:
            self._jobs[job_id].enabled = False
            try:
                self._scheduler.pause_job(job_id)
            except Exception:
                pass
            logger.info(f"Job paused: {job_id}")
            return True
        return False

    def resume_job(self, job_id: str) -> bool:
        """Resume a paused job."""
        if job_id in self._jobs:
            self._jobs[job_id].enabled = True
            try:
                self._scheduler.resume_job(job_id)
            except Exception:
                pass
            logger.info(f"Job resumed: {job_id}")
            return True
        return False

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job metadata by ID."""
        meta = self._jobs.get(job_id)
        return meta.to_dict() if meta else None

    def get_jobs(self, tag: Optional[str] = None,
                 job_type: Optional[JobType] = None) -> List[Dict[str, Any]]:
        """
        List all jobs with optional filtering.

        Args:
            tag: Filter by tag.
            job_type: Filter by job type.

        Returns:
            List of job metadata dicts.
        """
        result: List[Dict[str, Any]] = []
        for meta in self._jobs.values():
            if tag and tag not in meta.tags:
                continue
            if job_type and meta.job_type != job_type:
                continue
            result.append(meta.to_dict())
        return result

    async def trigger_job_now(self, job_id: str) -> bool:
        """
        Immediately execute a job regardless of its schedule.

        Args:
            job_id: Job to trigger.

        Returns:
            True if triggered.
        """
        if job_id in self._job_functions:
            await self._execute_job(job_id)
            return True
        return False

    # ------------------------------------------------------------------
    # Internal Helpers
    # ------------------------------------------------------------------

    def _create_job_wrapper(self, job_id: str, func: Callable) -> Callable:
        """Create a wrapper that tracks execution metrics."""
        async def wrapper() -> None:
            await self._execute_job(job_id)

        return wrapper

    async def _execute_job(self, job_id: str, event_data: Optional[Dict[str, Any]] = None) -> None:
        """Execute a job with timing, error handling, and retry logic."""
        meta = self._jobs.get(job_id)
        func = self._job_functions.get(job_id)
        if not meta or not func:
            return

        import time as _time
        start = _time.monotonic()
        attempt = 0
        last_error: Optional[str] = None

        while attempt <= meta.max_retries:
            try:
                if event_data is not None:
                    if asyncio.iscoroutinefunction(func):
                        await func(event_data)
                    else:
                        func(event_data)
                else:
                    if asyncio.iscoroutinefunction(func):
                        await func()
                    else:
                        func()

                elapsed_ms = (_time.monotonic() - start) * 1000
                meta.last_run = datetime.utcnow()
                meta.run_count += 1
                meta.last_duration_ms = round(elapsed_ms, 2)
                meta.last_error = None
                self._total_executions += 1

                nexus_logger.log_activity(
                    "scheduler_job_executed",
                    f"Job '{meta.name}' completed in {elapsed_ms:.0f}ms",
                    metadata={"job_id": job_id, "attempt": attempt},
                )
                return
            except Exception as exc:
                attempt += 1
                last_error = str(exc)
                logger.warning(
                    f"Job '{meta.name}' attempt {attempt} failed: {exc}"
                )
                if attempt <= meta.max_retries:
                    await asyncio.sleep(meta.retry_delay_seconds)

        meta.error_count += 1
        meta.last_error = last_error
        self._total_errors += 1
        logger.error(f"Job '{meta.name}' failed after {meta.max_retries} retries: {last_error}")
        await self._event_bus.emit(
            "scheduler.job_failed",
            {"job_id": job_id, "name": meta.name, "error": last_error},
            source="scheduler_service",
            category=EventCategory.SYSTEM,
            priority=EventPriority.HIGH,
        )

    # ------------------------------------------------------------------
    # APScheduler Event Listeners
    # ------------------------------------------------------------------

    def _on_job_executed(self, event: JobExecutionEvent) -> None:
        """Handle successful job execution from APScheduler."""
        job_id = event.job_id
        meta = self._jobs.get(job_id)
        if meta:
            apscheduler_job = self._scheduler.get_job(job_id)
            if apscheduler_job and apscheduler_job.next_run_time:
                meta.next_run = apscheduler_job.next_run_time.replace(tzinfo=None)

    def _on_job_error(self, event: JobExecutionEvent) -> None:
        """Handle job error from APScheduler."""
        job_id = event.job_id
        logger.error(f"APScheduler job error for {job_id}: {event.exception}")

    def _on_job_missed(self, event: JobEvent) -> None:
        """Handle missed job from APScheduler."""
        job_id = event.job_id
        logger.warning(f"APScheduler job missed: {job_id}")
        meta = self._jobs.get(job_id)
        if meta:
            meta.error_count += 1

    # ------------------------------------------------------------------
    # Health & Stats
    # ------------------------------------------------------------------

    async def health_check(self) -> Dict[str, Any]:
        """Return scheduler health status."""
        return {
            "service": "scheduler_service",
            "initialized": self._initialized,
            "running": self._running,
            "total_jobs": len(self._jobs),
            "active_jobs": sum(1 for j in self._jobs.values() if j.enabled),
            "total_executions": self._total_executions,
            "total_errors": self._total_errors,
            "event_triggers": sum(len(v) for v in self._event_triggers.values()),
        }

    def get_stats(self) -> Dict[str, Any]:
        """Return runtime statistics."""
        job_type_counts: Dict[str, int] = {}
        for meta in self._jobs.values():
            jt = meta.job_type.value
            job_type_counts[jt] = job_type_counts.get(jt, 0) + 1

        return {
            "initialized": self._initialized,
            "running": self._running,
            "total_jobs": len(self._jobs),
            "active_jobs": sum(1 for j in self._jobs.values() if j.enabled),
            "paused_jobs": sum(1 for j in self._jobs.values() if not j.enabled),
            "total_executions": self._total_executions,
            "total_errors": self._total_errors,
            "job_type_counts": job_type_counts,
            "event_trigger_types": list(self._event_triggers.keys()),
        }


# Need json import for _default_event_bus_stats
import json
