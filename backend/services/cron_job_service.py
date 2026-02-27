"""
Cron Job Service - Schedule and manage recurring tasks with cron expressions.
Supports creation, monitoring, execution history, pause/resume, and notifications.
"""

import asyncio
import re
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple
from collections import defaultdict


class CronJobStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    RUNNING = "running"
    ERROR = "error"
    DISABLED = "disabled"


class ExecutionResult(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    SKIPPED = "skipped"


@dataclass
class CronExpression:
    """Parsed cron expression with validation."""
    raw: str
    minute: str = "*"
    hour: str = "*"
    day_of_month: str = "*"
    month: str = "*"
    day_of_week: str = "*"

    def __post_init__(self):
        parts = self.raw.strip().split()
        if len(parts) == 5:
            self.minute, self.hour, self.day_of_month, self.month, self.day_of_week = parts
        elif len(parts) == 1:
            presets = {
                "@yearly": "0 0 1 1 *",
                "@annually": "0 0 1 1 *",
                "@monthly": "0 0 1 * *",
                "@weekly": "0 0 * * 0",
                "@daily": "0 0 * * *",
                "@midnight": "0 0 * * *",
                "@hourly": "0 * * * *",
            }
            if self.raw in presets:
                resolved = presets[self.raw].split()
                self.minute, self.hour, self.day_of_month, self.month, self.day_of_week = resolved

    @property
    def human_readable(self) -> str:
        """Convert cron expression to human-readable string."""
        if self.raw == "* * * * *":
            return "Every minute"
        if self.raw == "0 * * * *" or self.raw == "@hourly":
            return "Every hour"
        if self.raw == "0 0 * * *" or self.raw == "@daily":
            return "Every day at midnight"
        if self.raw == "0 0 * * 0" or self.raw == "@weekly":
            return "Every Sunday at midnight"
        if self.raw == "0 0 1 * *" or self.raw == "@monthly":
            return "First day of every month"

        parts = []
        if self.minute != "*":
            parts.append(f"at minute {self.minute}")
        if self.hour != "*":
            parts.append(f"at hour {self.hour}")
        if self.day_of_month != "*":
            parts.append(f"on day {self.day_of_month}")
        if self.month != "*":
            parts.append(f"in month {self.month}")
        if self.day_of_week != "*":
            days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            try:
                parts.append(f"on {days[int(self.day_of_week)]}")
            except (ValueError, IndexError):
                parts.append(f"on day-of-week {self.day_of_week}")

        return ", ".join(parts) if parts else self.raw

    def validate(self) -> Tuple[bool, str]:
        """Validate the cron expression."""
        ranges = [
            (self.minute, 0, 59, "minute"),
            (self.hour, 0, 23, "hour"),
            (self.day_of_month, 1, 31, "day of month"),
            (self.month, 1, 12, "month"),
            (self.day_of_week, 0, 7, "day of week"),
        ]
        for value, low, high, name in ranges:
            if value == "*":
                continue
            # Handle ranges like "1-5", lists like "1,3,5", steps like "*/5"
            pattern = r'^(\*|[0-9]+(-[0-9]+)?)(,[0-9]+(-[0-9]+)?)*(\/[0-9]+)?$'
            if not re.match(pattern, value):
                return False, f"Invalid {name} value: {value}"
        return True, "Valid"


@dataclass
class ExecutionRecord:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str = ""
    started_at: str = field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None
    duration_ms: float = 0
    result: ExecutionResult = ExecutionResult.SUCCESS
    output: str = ""
    error: Optional[str] = None
    trigger: str = "scheduled"  # scheduled, manual, retry


@dataclass
class CronJob:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    schedule: str = "0 * * * *"
    command: str = ""
    category: str = "general"
    status: CronJobStatus = CronJobStatus.ACTIVE
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    run_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    average_duration_ms: float = 0
    max_duration_ms: float = 0
    timeout_seconds: int = 300
    retry_count: int = 0
    max_retries: int = 3
    retry_delay_seconds: int = 60
    tags: List[str] = field(default_factory=list)
    environment: Dict[str, str] = field(default_factory=dict)
    notifications_enabled: bool = True
    notify_on_failure: bool = True
    notify_on_success: bool = False
    created_by: str = "admin"
    execution_history: List[ExecutionRecord] = field(default_factory=list)

    @property
    def cron(self) -> CronExpression:
        return CronExpression(self.schedule)

    @property
    def success_rate(self) -> float:
        if self.run_count == 0:
            return 100.0
        return round(self.success_count / self.run_count * 100, 1)


class CronJobService:
    """Manages scheduled cron jobs with execution tracking and monitoring."""

    def __init__(self):
        self.jobs: Dict[str, CronJob] = {}
        self._handlers: Dict[str, Callable] = {}
        self._running_jobs: set = set()
        self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Create sample cron jobs."""
        now = datetime.now()
        sample_jobs = [
            {
                "name": "Database Backup",
                "description": "Full database backup to cloud storage",
                "schedule": "0 2 * * *",
                "command": "python scripts/backup_db.py --full --compress",
                "category": "database",
                "run_count": 142,
                "success_count": 140,
                "failure_count": 2,
                "average_duration_ms": 185000,
                "tags": ["backup", "database", "critical"],
            },
            {
                "name": "ML Model Retraining",
                "description": "Retrain NLP and vision models with new data",
                "schedule": "0 3 * * 0",
                "command": "python train.py --all-models --epochs 20",
                "category": "ai",
                "run_count": 24,
                "success_count": 22,
                "failure_count": 2,
                "average_duration_ms": 3600000,
                "tags": ["ml", "training", "weekly"],
            },
            {
                "name": "System Health Check",
                "description": "Run comprehensive health checks on all services",
                "schedule": "*/5 * * * *",
                "command": "python scripts/health_check.py --verbose",
                "category": "monitoring",
                "run_count": 8640,
                "success_count": 8635,
                "failure_count": 5,
                "average_duration_ms": 2500,
                "tags": ["health", "monitoring", "frequent"],
            },
            {
                "name": "Log Rotation",
                "description": "Rotate and compress log files older than 7 days",
                "schedule": "0 0 * * *",
                "command": "python scripts/rotate_logs.py --days 7 --compress",
                "category": "maintenance",
                "run_count": 90,
                "success_count": 90,
                "failure_count": 0,
                "average_duration_ms": 45000,
                "tags": ["logs", "cleanup", "maintenance"],
            },
            {
                "name": "Analytics Aggregation",
                "description": "Aggregate daily analytics and generate reports",
                "schedule": "30 1 * * *",
                "command": "python scripts/aggregate_analytics.py --daily",
                "category": "analytics",
                "run_count": 87,
                "success_count": 85,
                "failure_count": 2,
                "average_duration_ms": 120000,
                "tags": ["analytics", "reports", "daily"],
            },
            {
                "name": "Cache Cleanup",
                "description": "Clear expired cache entries and rebuild indexes",
                "schedule": "0 */4 * * *",
                "command": "python scripts/cache_cleanup.py --expired --rebuild-index",
                "category": "maintenance",
                "status": CronJobStatus.ACTIVE,
                "run_count": 540,
                "success_count": 538,
                "failure_count": 2,
                "average_duration_ms": 8000,
                "tags": ["cache", "cleanup"],
            },
            {
                "name": "Security Scan",
                "description": "Run vulnerability scan on all endpoints",
                "schedule": "0 4 * * 1",
                "command": "python scripts/security_scan.py --full --report",
                "category": "security",
                "run_count": 12,
                "success_count": 12,
                "failure_count": 0,
                "average_duration_ms": 900000,
                "tags": ["security", "scan", "weekly"],
            },
            {
                "name": "Email Digest",
                "description": "Send daily summary email to admin",
                "schedule": "0 8 * * 1-5",
                "command": "python scripts/send_digest.py --format html",
                "category": "communication",
                "status": CronJobStatus.PAUSED,
                "run_count": 65,
                "success_count": 63,
                "failure_count": 2,
                "average_duration_ms": 5000,
                "tags": ["email", "digest", "weekday"],
            },
        ]

        for data in sample_jobs:
            job = CronJob(
                name=data["name"],
                description=data["description"],
                schedule=data["schedule"],
                command=data["command"],
                category=data["category"],
                status=data.get("status", CronJobStatus.ACTIVE),
                run_count=data["run_count"],
                success_count=data["success_count"],
                failure_count=data["failure_count"],
                average_duration_ms=data["average_duration_ms"],
                tags=data["tags"],
                last_run=(now - timedelta(hours=2)).isoformat(),
                next_run=(now + timedelta(hours=1)).isoformat(),
            )

            # Generate execution history
            for i in range(min(10, data["run_count"])):
                exec_time = now - timedelta(hours=i * 24)
                success = i != 3 or data["failure_count"] == 0
                record = ExecutionRecord(
                    job_id=job.id,
                    started_at=exec_time.isoformat(),
                    completed_at=(exec_time + timedelta(milliseconds=data["average_duration_ms"])).isoformat(),
                    duration_ms=data["average_duration_ms"] + (i * 100 - 500),
                    result=ExecutionResult.SUCCESS if success else ExecutionResult.FAILURE,
                    output=f"Job '{data['name']}' completed successfully" if success else f"Job '{data['name']}' failed",
                    error=None if success else "Connection timeout",
                    trigger="scheduled",
                )
                job.execution_history.append(record)

            self.jobs[job.id] = job

    def list_jobs(
        self,
        category: Optional[str] = None,
        status: Optional[CronJobStatus] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List all cron jobs with optional filtering."""
        jobs = list(self.jobs.values())

        if category:
            jobs = [j for j in jobs if j.category == category]
        if status:
            jobs = [j for j in jobs if j.status == status]
        if tags:
            jobs = [j for j in jobs if any(t in j.tags for t in tags)]
        if search:
            q = search.lower()
            jobs = [j for j in jobs if q in j.name.lower() or q in j.description.lower() or q in j.command.lower()]

        result = []
        for job in jobs:
            d = asdict(job)
            d["cron_readable"] = job.cron.human_readable
            d["success_rate"] = job.success_rate
            d["execution_history"] = d["execution_history"][:5]
            result.append(d)
        return result

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job details including full execution history."""
        job = self.jobs.get(job_id)
        if not job:
            return None
        d = asdict(job)
        d["cron_readable"] = job.cron.human_readable
        d["success_rate"] = job.success_rate
        valid, msg = job.cron.validate()
        d["schedule_valid"] = valid
        d["schedule_message"] = msg
        return d

    def create_job(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new cron job."""
        cron = CronExpression(data.get("schedule", "0 * * * *"))
        valid, msg = cron.validate()
        if not valid:
            return {"error": msg}

        job = CronJob(
            name=data.get("name", "Untitled Job"),
            description=data.get("description", ""),
            schedule=data.get("schedule", "0 * * * *"),
            command=data.get("command", ""),
            category=data.get("category", "general"),
            tags=data.get("tags", []),
            timeout_seconds=data.get("timeout_seconds", 300),
            max_retries=data.get("max_retries", 3),
            environment=data.get("environment", {}),
            notifications_enabled=data.get("notifications_enabled", True),
        )
        self.jobs[job.id] = job
        d = asdict(job)
        d["cron_readable"] = job.cron.human_readable
        return d

    def update_job(self, job_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing cron job."""
        job = self.jobs.get(job_id)
        if not job:
            return None

        updatable = ["name", "description", "schedule", "command", "category",
                      "tags", "timeout_seconds", "max_retries", "retry_delay_seconds",
                      "environment", "notifications_enabled", "notify_on_failure", "notify_on_success"]
        for key in updatable:
            if key in data:
                setattr(job, key, data[key])

        if "schedule" in data:
            valid, msg = CronExpression(data["schedule"]).validate()
            if not valid:
                return {"error": msg}

        job.updated_at = datetime.now().isoformat()
        d = asdict(job)
        d["cron_readable"] = job.cron.human_readable
        return d

    def delete_job(self, job_id: str) -> bool:
        """Delete a cron job."""
        if job_id in self.jobs:
            del self.jobs[job_id]
            return True
        return False

    def pause_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Pause a cron job."""
        job = self.jobs.get(job_id)
        if job:
            job.status = CronJobStatus.PAUSED
            job.updated_at = datetime.now().isoformat()
            return asdict(job)
        return None

    def resume_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Resume a paused cron job."""
        job = self.jobs.get(job_id)
        if job and job.status == CronJobStatus.PAUSED:
            job.status = CronJobStatus.ACTIVE
            job.updated_at = datetime.now().isoformat()
            return asdict(job)
        return None

    async def run_job(self, job_id: str, trigger: str = "manual") -> Optional[Dict[str, Any]]:
        """Manually trigger a job execution."""
        job = self.jobs.get(job_id)
        if not job:
            return None

        if job_id in self._running_jobs:
            return {"error": "Job is already running"}

        self._running_jobs.add(job_id)
        job.status = CronJobStatus.RUNNING
        start = datetime.now()

        record = ExecutionRecord(
            job_id=job_id,
            started_at=start.isoformat(),
            trigger=trigger,
        )

        # Simulate execution
        await asyncio.sleep(0.1)
        success = True  # Simulate success
        end = datetime.now()
        duration = (end - start).total_seconds() * 1000

        record.completed_at = end.isoformat()
        record.duration_ms = duration
        record.result = ExecutionResult.SUCCESS if success else ExecutionResult.FAILURE
        record.output = f"Job '{job.name}' completed in {duration:.0f}ms"

        job.execution_history.insert(0, record)
        job.run_count += 1
        if success:
            job.success_count += 1
        else:
            job.failure_count += 1
        job.last_run = end.isoformat()
        job.status = CronJobStatus.ACTIVE
        job.average_duration_ms = (
            (job.average_duration_ms * (job.run_count - 1) + duration) / job.run_count
        )
        if duration > job.max_duration_ms:
            job.max_duration_ms = duration

        self._running_jobs.discard(job_id)
        return asdict(record)

    def get_execution_history(self, job_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get execution history for a specific job."""
        job = self.jobs.get(job_id)
        if not job:
            return []
        return [asdict(r) for r in job.execution_history[:limit]]

    def get_stats(self) -> Dict[str, Any]:
        """Get overall cron job statistics."""
        jobs = list(self.jobs.values())
        return {
            "total_jobs": len(jobs),
            "active": sum(1 for j in jobs if j.status == CronJobStatus.ACTIVE),
            "paused": sum(1 for j in jobs if j.status == CronJobStatus.PAUSED),
            "running": len(self._running_jobs),
            "error": sum(1 for j in jobs if j.status == CronJobStatus.ERROR),
            "total_executions": sum(j.run_count for j in jobs),
            "total_successes": sum(j.success_count for j in jobs),
            "total_failures": sum(j.failure_count for j in jobs),
            "overall_success_rate": round(
                sum(j.success_count for j in jobs) / max(1, sum(j.run_count for j in jobs)) * 100, 1
            ),
            "categories": list(set(j.category for j in jobs)),
            "by_category": dict(defaultdict(int, {j.category: 1 for j in jobs})),
        }

    def get_upcoming_executions(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get upcoming job executions."""
        active_jobs = [j for j in self.jobs.values() if j.status == CronJobStatus.ACTIVE and j.next_run]
        active_jobs.sort(key=lambda j: j.next_run or "")
        return [
            {
                "job_id": j.id,
                "job_name": j.name,
                "next_run": j.next_run,
                "schedule": j.schedule,
                "category": j.category,
            }
            for j in active_jobs[:limit]
        ]


# Singleton
_cron_job_service: Optional[CronJobService] = None


def get_cron_job_service() -> CronJobService:
    global _cron_job_service
    if _cron_job_service is None:
        _cron_job_service = CronJobService()
    return _cron_job_service
