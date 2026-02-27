"""API routes for Cron Job Management service."""
from fastapi import APIRouter, Query
from typing import Optional
from pydantic import BaseModel

router = APIRouter()


def _get_service():
    from ...services.cron_job_service import get_cron_job_service
    return get_cron_job_service()


class CronJobCreateRequest(BaseModel):
    name: str
    description: str = ""
    schedule: str = "0 * * * *"
    command: str = ""
    category: str = "general"
    tags: list = []
    timeout_seconds: int = 300
    max_retries: int = 3
    environment: dict = {}
    notifications_enabled: bool = True


class CronJobUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[str] = None
    command: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list] = None
    timeout_seconds: Optional[int] = None
    max_retries: Optional[int] = None
    notifications_enabled: Optional[bool] = None


@router.get("/cron-jobs")
async def list_cron_jobs(
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    from ...services.cron_job_service import CronJobStatus
    svc = _get_service()
    job_status = CronJobStatus(status) if status else None
    return svc.list_jobs(category=category, status=job_status, search=search)


@router.get("/cron-jobs/stats")
async def cron_job_stats():
    return _get_service().get_stats()


@router.get("/cron-jobs/upcoming")
async def upcoming_executions(limit: int = Query(default=10, le=50)):
    return _get_service().get_upcoming_executions(limit)


@router.post("/cron-jobs")
async def create_cron_job(req: CronJobCreateRequest):
    return _get_service().create_job(req.model_dump())


@router.get("/cron-jobs/{job_id}")
async def get_cron_job(job_id: str):
    result = _get_service().get_job(job_id)
    if not result:
        return {"error": "Job not found"}
    return result


@router.put("/cron-jobs/{job_id}")
async def update_cron_job(job_id: str, req: CronJobUpdateRequest):
    result = _get_service().update_job(job_id, req.model_dump(exclude_none=True))
    if not result:
        return {"error": "Job not found"}
    return result


@router.delete("/cron-jobs/{job_id}")
async def delete_cron_job(job_id: str):
    if _get_service().delete_job(job_id):
        return {"status": "deleted"}
    return {"error": "Job not found"}


@router.post("/cron-jobs/{job_id}/pause")
async def pause_cron_job(job_id: str):
    result = _get_service().pause_job(job_id)
    if not result:
        return {"error": "Job not found"}
    return result


@router.post("/cron-jobs/{job_id}/resume")
async def resume_cron_job(job_id: str):
    result = _get_service().resume_job(job_id)
    if not result:
        return {"error": "Job not found or not paused"}
    return result


@router.post("/cron-jobs/{job_id}/run")
async def run_cron_job(job_id: str):
    result = await _get_service().run_job(job_id, trigger="manual")
    if not result:
        return {"error": "Job not found"}
    return result


@router.get("/cron-jobs/{job_id}/history")
async def get_execution_history(job_id: str, limit: int = Query(default=50, le=200)):
    return _get_service().get_execution_history(job_id, limit)
