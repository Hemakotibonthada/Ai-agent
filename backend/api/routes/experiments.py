"""Experiment Tracking & A/B Testing API routes."""
from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from services.experiment_service import get_experiment_service

router = APIRouter(prefix="/api/experiments", tags=["experiments"])
service = get_experiment_service()


class CreateExperimentRequest(BaseModel):
    name: str
    hypothesis: str = ""
    description: str = ""
    type: str = "a/b"
    metric: str = "conversion_rate"
    variants: list = []
    traffic_percentage: float = 100.0
    min_sample_size: int = 1000
    significance_level: float = 0.05
    minimum_detectable_effect: float = 5.0
    tags: list = []
    owner: str = "admin"


class RecordEventRequest(BaseModel):
    experiment_id: str
    variant_id: str = ""
    user_id: str
    event_type: str = "exposure"
    value: float = 1.0
    metadata: dict = {}


@router.get("/")
async def list_experiments(status: Optional[str] = None, type: Optional[str] = None):
    return service.list_experiments(status=status, type_filter=type)


@router.get("/stats")
async def get_stats():
    return service.get_stats()


@router.get("/{experiment_id}")
async def get_experiment(experiment_id: str):
    exp = service.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


@router.get("/{experiment_id}/results")
async def get_results(experiment_id: str):
    results = service.get_results(experiment_id)
    if not results:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return results


@router.post("/")
async def create_experiment(req: CreateExperimentRequest):
    return service.create_experiment(req.model_dump())


@router.post("/{experiment_id}/start")
async def start_experiment(experiment_id: str):
    result = service.start_experiment(experiment_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{experiment_id}/pause")
async def pause_experiment(experiment_id: str):
    result = service.pause_experiment(experiment_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{experiment_id}/complete")
async def complete_experiment(experiment_id: str):
    result = service.complete_experiment(experiment_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/events")
async def record_event(req: RecordEventRequest):
    result = service.record_event(req.model_dump())
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
    return result


@router.delete("/{experiment_id}")
async def delete_experiment(experiment_id: str):
    if not service.delete_experiment(experiment_id):
        raise HTTPException(status_code=404, detail="Experiment not found")
    return {"success": True}
