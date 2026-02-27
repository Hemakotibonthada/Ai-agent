"""
Backup Management Service for Nexus AI
Comprehensive backup, restore, and recovery system
"""

import asyncio
import hashlib
import json
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Callable
from pathlib import Path
from services.demo_data_manager import is_demo_data_enabled


class BackupType(str, Enum):
    FULL = "full"
    INCREMENTAL = "incremental"
    DIFFERENTIAL = "differential"
    SNAPSHOT = "snapshot"


class BackupStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    VERIFYING = "verifying"


class StorageTarget(str, Enum):
    LOCAL = "local"
    S3 = "s3"
    GCS = "gcs"
    AZURE_BLOB = "azure_blob"
    NAS = "nas"
    GIT = "git"


class RetentionPolicy(str, Enum):
    DAILY_7 = "daily_7"
    DAILY_30 = "daily_30"
    WEEKLY_12 = "weekly_12"
    MONTHLY_12 = "monthly_12"
    YEARLY = "yearly"
    CUSTOM = "custom"


@dataclass
class BackupSchedule:
    cron_expression: str
    backup_type: BackupType
    target: StorageTarget
    retention_policy: RetentionPolicy
    retention_days: int = 30
    compress: bool = True
    encrypt: bool = True
    notify_on_complete: bool = True
    notify_on_failure: bool = True
    max_concurrent: int = 1
    pre_backup_script: Optional[str] = None
    post_backup_script: Optional[str] = None
    include_patterns: List[str] = field(default_factory=lambda: ["*"])
    exclude_patterns: List[str] = field(default_factory=list)
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class BackupManifest:
    backup_id: str
    parent_id: Optional[str]
    backup_type: BackupType
    target: StorageTarget
    status: BackupStatus
    created_at: str
    completed_at: Optional[str]
    size_bytes: int
    compressed_size_bytes: int
    item_count: int
    checksum_sha256: str
    encryption_key_id: Optional[str]
    compression_algorithm: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    throughput_mbps: float = 0.0
    dedup_ratio: float = 1.0
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class BackupItem:
    path: str
    size: int
    modified_at: str
    checksum: str
    item_type: str  # file, directory, symlink, database
    permissions: str
    owner: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RestoreRequest:
    backup_id: str
    target_path: str
    include_patterns: List[str] = field(default_factory=lambda: ["*"])
    exclude_patterns: List[str] = field(default_factory=list)
    overwrite: bool = False
    verify_checksums: bool = True
    dry_run: bool = False
    point_in_time: Optional[str] = None


@dataclass
class RestoreResult:
    backup_id: str
    status: str
    items_restored: int
    items_skipped: int
    items_failed: int
    total_size: int
    duration_seconds: float
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class StorageInfo:
    target: StorageTarget
    name: str
    total_bytes: int
    used_bytes: int
    available_bytes: int
    backup_count: int
    oldest_backup: Optional[str] = None
    newest_backup: Optional[str] = None
    average_backup_size: int = 0
    estimated_days_remaining: int = 0

    @property
    def usage_percent(self) -> float:
        if self.total_bytes == 0:
            return 0.0
        return (self.used_bytes / self.total_bytes) * 100


class BackupService:
    """Comprehensive backup management service"""

    def __init__(self):
        self.backups: Dict[str, BackupManifest] = {}
        self.schedules: Dict[str, BackupSchedule] = {}
        self.storage_targets: Dict[str, StorageInfo] = {}
        self.backup_items: Dict[str, List[BackupItem]] = {}
        self.listeners: List[Callable] = []
        if is_demo_data_enabled():
            self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Initialize with sample backup data"""
        # Storage targets
        self.storage_targets = {
            "local_nas": StorageInfo(
                target=StorageTarget.LOCAL, name="Local NAS",
                total_bytes=100 * 1024**3, used_bytes=45 * 1024**3,
                available_bytes=55 * 1024**3, backup_count=120,
                oldest_backup="2024-01-01T02:00:00Z",
                newest_backup="2024-03-20T14:00:00Z",
                average_backup_size=380 * 1024**2,
                estimated_days_remaining=145,
            ),
            "aws_s3": StorageInfo(
                target=StorageTarget.S3, name="AWS S3",
                total_bytes=500 * 1024**3, used_bytes=148 * 1024**3,
                available_bytes=352 * 1024**3, backup_count=85,
                oldest_backup="2024-01-15T03:00:00Z",
                newest_backup="2024-03-20T02:00:00Z",
                average_backup_size=1740 * 1024**2,
                estimated_days_remaining=202,
            ),
            "s3_glacier": StorageInfo(
                target=StorageTarget.S3, name="S3 Glacier",
                total_bytes=2000 * 1024**3, used_bytes=320 * 1024**3,
                available_bytes=1680 * 1024**3, backup_count=24,
                oldest_backup="2023-06-01T04:00:00Z",
                newest_backup="2024-03-17T03:00:00Z",
                average_backup_size=13 * 1024**3,
                estimated_days_remaining=1050,
            ),
        }

        # Sample backup manifests
        sample_backups = [
            BackupManifest(
                backup_id="bk_001", parent_id=None,
                backup_type=BackupType.FULL, target=StorageTarget.LOCAL,
                status=BackupStatus.COMPLETED,
                created_at="2024-03-20T02:00:00Z",
                completed_at="2024-03-20T02:30:45Z",
                size_bytes=4_200_000_000, compressed_size_bytes=2_100_000_000,
                item_count=12450, checksum_sha256="a" * 64,
                encryption_key_id="key_prod_001",
                compression_algorithm="zstd",
                duration_seconds=1845.0, throughput_mbps=18.2,
                dedup_ratio=0.72,
                tags={"environment": "production", "schedule": "daily"},
            ),
            BackupManifest(
                backup_id="bk_002", parent_id="bk_001",
                backup_type=BackupType.INCREMENTAL, target=StorageTarget.LOCAL,
                status=BackupStatus.COMPLETED,
                created_at="2024-03-20T13:00:00Z",
                completed_at="2024-03-20T13:00:45Z",
                size_bytes=125_000_000, compressed_size_bytes=62_000_000,
                item_count=342, checksum_sha256="b" * 64,
                encryption_key_id=None,
                compression_algorithm="zstd",
                duration_seconds=45.0, throughput_mbps=22.2,
                dedup_ratio=0.85,
                tags={"environment": "production", "schedule": "hourly"},
            ),
            BackupManifest(
                backup_id="bk_003", parent_id=None,
                backup_type=BackupType.SNAPSHOT, target=StorageTarget.LOCAL,
                status=BackupStatus.IN_PROGRESS,
                created_at="2024-03-20T14:00:00Z",
                completed_at=None,
                size_bytes=450_000_000, compressed_size_bytes=0,
                item_count=0, checksum_sha256="",
                encryption_key_id="key_prod_001",
                compression_algorithm="none",
                tags={"type": "database", "engine": "postgresql"},
            ),
            BackupManifest(
                backup_id="bk_004", parent_id=None,
                backup_type=BackupType.DIFFERENTIAL, target=StorageTarget.S3,
                status=BackupStatus.COMPLETED,
                created_at="2024-03-17T03:00:00Z",
                completed_at="2024-03-17T03:12:00Z",
                size_bytes=1_800_000_000, compressed_size_bytes=900_000_000,
                item_count=5670, checksum_sha256="d" * 64,
                encryption_key_id="key_prod_001",
                compression_algorithm="zstd",
                duration_seconds=720.0, throughput_mbps=20.0,
                dedup_ratio=0.68,
                tags={"environment": "production", "schedule": "weekly"},
            ),
            BackupManifest(
                backup_id="bk_005", parent_id=None,
                backup_type=BackupType.FULL, target=StorageTarget.GIT,
                status=BackupStatus.COMPLETED,
                created_at="2024-03-20T12:00:00Z",
                completed_at="2024-03-20T12:00:08Z",
                size_bytes=15_000_000, compressed_size_bytes=15_000_000,
                item_count=89, checksum_sha256="e" * 64,
                encryption_key_id=None,
                compression_algorithm="none",
                duration_seconds=8.0, throughput_mbps=15.0,
                tags={"type": "configuration"},
            ),
            BackupManifest(
                backup_id="bk_006", parent_id=None,
                backup_type=BackupType.FULL, target=StorageTarget.S3,
                status=BackupStatus.FAILED,
                created_at="2024-03-19T02:00:00Z",
                completed_at="2024-03-19T03:00:00Z",
                size_bytes=0, compressed_size_bytes=0,
                item_count=0, checksum_sha256="",
                encryption_key_id="key_prod_001",
                compression_algorithm="zstd",
                duration_seconds=3600.0,
                errors=["S3 connection timeout after 3 retries", "Upload failed: bucket quota exceeded"],
                tags={"type": "media"},
            ),
            BackupManifest(
                backup_id="bk_007", parent_id=None,
                backup_type=BackupType.FULL, target=StorageTarget.S3,
                status=BackupStatus.COMPLETED,
                created_at="2024-03-18T04:00:00Z",
                completed_at="2024-03-18T04:40:00Z",
                size_bytes=8_500_000_000, compressed_size_bytes=3_400_000_000,
                item_count=45, checksum_sha256="g" * 64,
                encryption_key_id="key_prod_001",
                compression_algorithm="zstd",
                duration_seconds=2400.0, throughput_mbps=28.3,
                dedup_ratio=0.60,
                tags={"type": "ml_models", "retention": "long_term"},
            ),
        ]
        for bk in sample_backups:
            self.backups[bk.backup_id] = bk

        # Sample schedules
        self.schedules = {
            "sched_daily_full": BackupSchedule(
                cron_expression="0 2 * * *",
                backup_type=BackupType.FULL,
                target=StorageTarget.LOCAL,
                retention_policy=RetentionPolicy.DAILY_30,
                retention_days=30,
                compress=True, encrypt=True,
                tags={"environment": "production"},
            ),
            "sched_hourly_inc": BackupSchedule(
                cron_expression="0 * * * *",
                backup_type=BackupType.INCREMENTAL,
                target=StorageTarget.LOCAL,
                retention_policy=RetentionPolicy.DAILY_7,
                retention_days=7,
                compress=True, encrypt=False,
                tags={"environment": "production"},
            ),
            "sched_weekly_diff": BackupSchedule(
                cron_expression="0 3 * * 0",
                backup_type=BackupType.DIFFERENTIAL,
                target=StorageTarget.S3,
                retention_policy=RetentionPolicy.WEEKLY_12,
                retention_days=84,
                compress=True, encrypt=True,
                tags={"environment": "production"},
            ),
        }

    # ---- CRUD Operations ----

    def list_backups(
        self,
        backup_type: Optional[BackupType] = None,
        status: Optional[BackupStatus] = None,
        target: Optional[StorageTarget] = None,
        since: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """List backups with filtering"""
        results = list(self.backups.values())

        if backup_type:
            results = [b for b in results if b.backup_type == backup_type]
        if status:
            results = [b for b in results if b.status == status]
        if target:
            results = [b for b in results if b.target == target]
        if since:
            results = [b for b in results if b.created_at >= since]

        results.sort(key=lambda b: b.created_at, reverse=True)
        total = len(results)
        results = results[offset:offset + limit]

        return {
            "items": [asdict(b) for b in results],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get_backup(self, backup_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific backup"""
        backup = self.backups.get(backup_id)
        return asdict(backup) if backup else None

    async def create_backup(
        self,
        backup_type: BackupType,
        target: StorageTarget,
        compress: bool = True,
        encrypt: bool = True,
        tags: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Create a new backup"""
        backup_id = f"bk_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        parent_id = None

        if backup_type in (BackupType.INCREMENTAL, BackupType.DIFFERENTIAL):
            # Find the latest full backup as parent
            full_backups = [
                b for b in self.backups.values()
                if b.backup_type == BackupType.FULL
                and b.status == BackupStatus.COMPLETED
                and b.target == target
            ]
            if full_backups:
                full_backups.sort(key=lambda b: b.created_at, reverse=True)
                parent_id = full_backups[0].backup_id

        manifest = BackupManifest(
            backup_id=backup_id,
            parent_id=parent_id,
            backup_type=backup_type,
            target=target,
            status=BackupStatus.IN_PROGRESS,
            created_at=datetime.utcnow().isoformat() + "Z",
            completed_at=None,
            size_bytes=0,
            compressed_size_bytes=0,
            item_count=0,
            checksum_sha256="",
            encryption_key_id="key_prod_001" if encrypt else None,
            compression_algorithm="zstd" if compress else "none",
            tags=tags or {},
        )

        self.backups[backup_id] = manifest
        self._notify("backup_started", manifest)

        # Simulate backup completion
        await asyncio.sleep(0.5)
        manifest.status = BackupStatus.COMPLETED
        manifest.completed_at = datetime.utcnow().isoformat() + "Z"
        manifest.size_bytes = 500_000_000
        manifest.compressed_size_bytes = 250_000_000 if compress else 500_000_000
        manifest.item_count = 1500
        manifest.checksum_sha256 = hashlib.sha256(backup_id.encode()).hexdigest()
        manifest.duration_seconds = 0.5
        manifest.throughput_mbps = 800.0

        self._notify("backup_completed", manifest)
        return asdict(manifest)

    def delete_backup(self, backup_id: str) -> bool:
        """Delete a backup"""
        if backup_id in self.backups:
            backup = self.backups.pop(backup_id)
            self.backup_items.pop(backup_id, None)
            self._notify("backup_deleted", backup)
            return True
        return False

    # ---- Restore Operations ----

    async def restore_backup(self, request: RestoreRequest) -> RestoreResult:
        """Restore from a backup"""
        backup = self.backups.get(request.backup_id)
        if not backup:
            return RestoreResult(
                backup_id=request.backup_id, status="failed",
                items_restored=0, items_skipped=0, items_failed=0,
                total_size=0, duration_seconds=0,
                errors=["Backup not found"],
            )

        if backup.status != BackupStatus.COMPLETED:
            return RestoreResult(
                backup_id=request.backup_id, status="failed",
                items_restored=0, items_skipped=0, items_failed=0,
                total_size=0, duration_seconds=0,
                errors=["Backup is not in completed state"],
            )

        # Simulate restore
        await asyncio.sleep(0.3)

        result = RestoreResult(
            backup_id=request.backup_id,
            status="completed" if not request.dry_run else "dry_run",
            items_restored=backup.item_count,
            items_skipped=0,
            items_failed=0,
            total_size=backup.size_bytes,
            duration_seconds=0.3,
        )

        self._notify("restore_completed", result)
        return result

    # ---- Verification ----

    async def verify_backup(self, backup_id: str) -> Dict[str, Any]:
        """Verify a backup's integrity"""
        backup = self.backups.get(backup_id)
        if not backup:
            return {"valid": False, "errors": ["Backup not found"]}

        await asyncio.sleep(0.2)

        return {
            "backup_id": backup_id,
            "valid": backup.status == BackupStatus.COMPLETED and len(backup.checksum_sha256) > 0,
            "checksum_verified": True,
            "items_verified": backup.item_count,
            "corrupted_items": 0,
            "missing_items": 0,
            "verified_at": datetime.utcnow().isoformat() + "Z",
        }

    # ---- Schedule Management ----

    def list_schedules(self) -> List[Dict[str, Any]]:
        """List all backup schedules"""
        return [
            {"id": sid, **self._schedule_to_dict(sched)}
            for sid, sched in self.schedules.items()
        ]

    def create_schedule(self, schedule_id: str, schedule: BackupSchedule) -> Dict[str, Any]:
        """Create or update a backup schedule"""
        self.schedules[schedule_id] = schedule
        return {"id": schedule_id, **self._schedule_to_dict(schedule)}

    def delete_schedule(self, schedule_id: str) -> bool:
        """Delete a backup schedule"""
        return self.schedules.pop(schedule_id, None) is not None

    # ---- Storage Info ----

    def get_storage_info(self) -> List[Dict[str, Any]]:
        """Get storage target information"""
        return [
            {
                "id": sid,
                **asdict(info),
                "usage_percent": info.usage_percent,
                "total_human": self._format_bytes(info.total_bytes),
                "used_human": self._format_bytes(info.used_bytes),
                "available_human": self._format_bytes(info.available_bytes),
            }
            for sid, info in self.storage_targets.items()
        ]

    # ---- Statistics ----

    def get_stats(self) -> Dict[str, Any]:
        """Get backup statistics"""
        all_backups = list(self.backups.values())
        completed = [b for b in all_backups if b.status == BackupStatus.COMPLETED]
        failed = [b for b in all_backups if b.status == BackupStatus.FAILED]

        total_size = sum(b.size_bytes for b in completed)
        total_compressed = sum(b.compressed_size_bytes for b in completed)

        return {
            "total_backups": len(all_backups),
            "completed": len(completed),
            "failed": len(failed),
            "in_progress": len([b for b in all_backups if b.status == BackupStatus.IN_PROGRESS]),
            "total_size_bytes": total_size,
            "total_size_human": self._format_bytes(total_size),
            "total_compressed_bytes": total_compressed,
            "compression_ratio": round(total_compressed / total_size, 2) if total_size > 0 else 1.0,
            "success_rate": round(len(completed) / max(len(completed) + len(failed), 1) * 100, 1),
            "average_duration": round(sum(b.duration_seconds for b in completed) / max(len(completed), 1), 1),
            "average_throughput": round(sum(b.throughput_mbps for b in completed if b.throughput_mbps > 0) / max(len([b for b in completed if b.throughput_mbps > 0]), 1), 1),
            "storage_targets": len(self.storage_targets),
            "schedules": len(self.schedules),
            "by_type": {
                t.value: len([b for b in all_backups if b.backup_type == t])
                for t in BackupType
            },
            "by_status": {
                s.value: len([b for b in all_backups if b.status == s])
                for s in BackupStatus
            },
        }

    # ---- Helpers ----

    def _schedule_to_dict(self, schedule: BackupSchedule) -> Dict[str, Any]:
        return {
            "cron_expression": schedule.cron_expression,
            "backup_type": schedule.backup_type.value,
            "target": schedule.target.value,
            "retention_policy": schedule.retention_policy.value,
            "retention_days": schedule.retention_days,
            "compress": schedule.compress,
            "encrypt": schedule.encrypt,
            "notify_on_complete": schedule.notify_on_complete,
            "notify_on_failure": schedule.notify_on_failure,
            "tags": schedule.tags,
        }

    @staticmethod
    def _format_bytes(bytes_val: int) -> str:
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if bytes_val < 1024.0:
                return f"{bytes_val:.1f} {unit}"
            bytes_val /= 1024.0
        return f"{bytes_val:.1f} PB"

    def _notify(self, event: str, data: Any):
        for listener in self.listeners:
            try:
                listener(event, data)
            except Exception:
                pass

    def subscribe(self, listener: Callable):
        self.listeners.append(listener)


# Singleton instance
_backup_service: Optional[BackupService] = None


def get_backup_service() -> BackupService:
    global _backup_service
    if _backup_service is None:
        _backup_service = BackupService()
    return _backup_service
