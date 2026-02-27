"""
Backup Management API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from enum import Enum

router = APIRouter(prefix="/api/v1/backups", tags=["backups"])


class BackupTypeEnum(str, Enum):
    full = "full"
    incremental = "incremental"
    differential = "differential"
    snapshot = "snapshot"


class StorageTargetEnum(str, Enum):
    local = "local"
    s3 = "s3"
    gcs = "gcs"
    azure_blob = "azure_blob"
    nas = "nas"
    git = "git"


class BackupStatusEnum(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"


class CreateBackupRequest(BaseModel):
    backup_type: BackupTypeEnum = BackupTypeEnum.full
    target: StorageTargetEnum = StorageTargetEnum.local
    compress: bool = True
    encrypt: bool = True
    tags: dict = {}


class RestoreRequest(BaseModel):
    target_path: str = "/restore"
    overwrite: bool = False
    verify_checksums: bool = True
    dry_run: bool = False


class ScheduleRequest(BaseModel):
    cron_expression: str
    backup_type: BackupTypeEnum = BackupTypeEnum.full
    target: StorageTargetEnum = StorageTargetEnum.local
    retention_days: int = 30
    compress: bool = True
    encrypt: bool = True


def _get_service():
    from backend.services.backup_service import get_backup_service
    return get_backup_service()


@router.get("/")
async def list_backups(
    backup_type: Optional[BackupTypeEnum] = None,
    status: Optional[BackupStatusEnum] = None,
    target: Optional[StorageTargetEnum] = None,
    since: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List all backups with optional filtering"""
    service = _get_service()
    return service.list_backups(
        backup_type=backup_type,
        status=status,
        target=target,
        since=since,
        limit=limit,
        offset=offset,
    )


@router.get("/stats")
async def get_backup_stats():
    """Get backup statistics"""
    service = _get_service()
    return service.get_stats()


@router.get("/storage")
async def get_storage_info():
    """Get storage target information"""
    service = _get_service()
    return service.get_storage_info()


@router.get("/schedules")
async def list_schedules():
    """List all backup schedules"""
    service = _get_service()
    return service.list_schedules()


@router.get("/{backup_id}")
async def get_backup(backup_id: str):
    """Get a specific backup"""
    service = _get_service()
    result = service.get_backup(backup_id)
    if not result:
        raise HTTPException(status_code=404, detail="Backup not found")
    return result


@router.post("/")
async def create_backup(request: CreateBackupRequest):
    """Create a new backup"""
    service = _get_service()
    from backend.services.backup_service import BackupType, StorageTarget
    return await service.create_backup(
        backup_type=BackupType(request.backup_type.value),
        target=StorageTarget(request.target.value),
        compress=request.compress,
        encrypt=request.encrypt,
        tags=request.tags,
    )


@router.post("/{backup_id}/restore")
async def restore_backup(backup_id: str, request: RestoreRequest):
    """Restore from a backup"""
    service = _get_service()
    from backend.services.backup_service import RestoreRequest as RR
    restore_req = RR(
        backup_id=backup_id,
        target_path=request.target_path,
        overwrite=request.overwrite,
        verify_checksums=request.verify_checksums,
        dry_run=request.dry_run,
    )
    from dataclasses import asdict
    result = await service.restore_backup(restore_req)
    return asdict(result)


@router.post("/{backup_id}/verify")
async def verify_backup(backup_id: str):
    """Verify backup integrity"""
    service = _get_service()
    return await service.verify_backup(backup_id)


@router.delete("/{backup_id}")
async def delete_backup(backup_id: str):
    """Delete a backup"""
    service = _get_service()
    if not service.delete_backup(backup_id):
        raise HTTPException(status_code=404, detail="Backup not found")
    return {"status": "deleted"}


@router.post("/schedules/{schedule_id}")
async def create_schedule(schedule_id: str, request: ScheduleRequest):
    """Create or update a backup schedule"""
    service = _get_service()
    from backend.services.backup_service import BackupSchedule, BackupType, StorageTarget, RetentionPolicy
    schedule = BackupSchedule(
        cron_expression=request.cron_expression,
        backup_type=BackupType(request.backup_type.value),
        target=StorageTarget(request.target.value),
        retention_policy=RetentionPolicy.CUSTOM,
        retention_days=request.retention_days,
        compress=request.compress,
        encrypt=request.encrypt,
    )
    return service.create_schedule(schedule_id, schedule)


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Delete a backup schedule"""
    service = _get_service()
    if not service.delete_schedule(schedule_id):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"status": "deleted"}
