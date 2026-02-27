"""Deployment Management API routes."""
from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from services.deployment_service import get_deployment_service

router = APIRouter(prefix="/api/deployments", tags=["deployments"])
service = get_deployment_service()


class CreateDeploymentRequest(BaseModel):
    name: str
    environment: str = "staging"
    version: str = "1.0.0"
    branch: str = "main"
    services: list = []
    description: str = ""


class ScaleRequest(BaseModel):
    replicas: int = 1


@router.get("/")
async def list_deployments(environment: Optional[str] = None, status: Optional[str] = None):
    return service.list_deployments(environment=environment, status=status)


@router.get("/stats")
async def get_stats():
    return service.get_stats()


@router.get("/pipelines")
async def list_pipelines():
    return service.list_pipelines()


@router.get("/{deployment_id}")
async def get_deployment(deployment_id: str):
    dep = service.get_deployment(deployment_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return dep


@router.get("/{deployment_id}/health")
async def get_health(deployment_id: str):
    health = service.check_health(deployment_id)
    if not health:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return health


@router.get("/{deployment_id}/logs")
async def get_logs(deployment_id: str, lines: int = 100):
    logs = service.get_logs(deployment_id, lines=lines)
    return {"deployment_id": deployment_id, "logs": logs}


@router.post("/")
async def create_deployment(req: CreateDeploymentRequest):
    return service.create_deployment(req.model_dump())


@router.post("/{deployment_id}/restart")
async def restart_deployment(deployment_id: str):
    result = service.restart_deployment(deployment_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{deployment_id}/stop")
async def stop_deployment(deployment_id: str):
    result = service.stop_deployment(deployment_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{deployment_id}/rollback")
async def rollback_deployment(deployment_id: str):
    result = service.rollback_deployment(deployment_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{deployment_id}/scale")
async def scale_deployment(deployment_id: str, req: ScaleRequest):
    result = service.scale_deployment(deployment_id, req.replicas)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
