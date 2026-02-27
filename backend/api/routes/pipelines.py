"""
Data Pipeline API Routes
Features: Pipeline CRUD, execution, data sources, lineage, quality checks
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.data_pipeline_service import (
    DataPipelineService, get_data_pipeline_service,
    Pipeline, PipelineStep, PipelineStatus,
)

router = APIRouter(prefix="/api/pipelines", tags=["Data Pipelines"])


class CreatePipelineRequest(BaseModel):
    name: str
    description: str = ""
    category: str = "general"
    tags: List[str] = []
    steps: List[Dict[str, Any]] = []


class ExecutePipelineRequest(BaseModel):
    triggered_by: str = "manual"


@router.get("/")
async def list_pipelines(
    category: Optional[str] = None,
    status: Optional[str] = None,
):
    """List all data pipelines."""
    service = get_data_pipeline_service()
    st = None
    if status:
        try:
            st = PipelineStatus(status)
        except ValueError:
            pass
    return await service.list_pipelines(category=category, status=st)


@router.get("/stats")
async def get_pipeline_stats():
    """Get pipeline system statistics."""
    service = get_data_pipeline_service()
    return await service.get_pipeline_stats()


@router.get("/data-sources")
async def list_data_sources():
    """List available data sources."""
    service = get_data_pipeline_service()
    return await service.list_data_sources()


@router.get("/data-sources/{source_name}/preview")
async def preview_data(source_name: str, limit: int = Query(10, ge=1, le=100)):
    """Preview data from a source."""
    service = get_data_pipeline_service()
    return await service.preview_data(source_name, limit)


@router.get("/lineage")
async def get_data_lineage(pipeline_id: Optional[str] = None):
    """Get data lineage information."""
    service = get_data_pipeline_service()
    return await service.get_data_lineage(pipeline_id)


@router.get("/executions")
async def get_all_executions(
    pipeline_id: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
):
    """Get execution history across all pipelines."""
    service = get_data_pipeline_service()
    return await service.get_execution_history(pipeline_id, limit)


@router.get("/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    """Get pipeline details."""
    service = get_data_pipeline_service()
    pipeline = await service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.post("/")
async def create_pipeline(data: CreatePipelineRequest):
    """Create a new pipeline."""
    import uuid
    service = get_data_pipeline_service()
    steps = []
    for i, step_data in enumerate(data.steps):
        from services.data_pipeline_service import StepType
        steps.append(PipelineStep(
            id=step_data.get("id", f"step-{i}"),
            name=step_data.get("name", f"Step {i + 1}"),
            step_type=StepType(step_data.get("step_type", "transform")),
            config=step_data.get("config", {}),
            order=step_data.get("order", i),
            input_step_ids=step_data.get("input_step_ids", []),
        ))

    pipeline = Pipeline(
        id=str(uuid.uuid4())[:8],
        name=data.name,
        description=data.description,
        category=data.category,
        tags=data.tags,
        steps=steps,
    )

    try:
        created = await service.create_pipeline(pipeline)
        return await service.get_pipeline(created.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{pipeline_id}/execute")
async def execute_pipeline(pipeline_id: str, data: ExecutePipelineRequest = None):
    """Execute a pipeline."""
    service = get_data_pipeline_service()
    triggered_by = data.triggered_by if data else "manual"
    try:
        execution = await service.execute_pipeline(pipeline_id, triggered_by)
        return {
            "execution_id": execution.id,
            "pipeline_id": execution.pipeline_id,
            "status": execution.status.value,
            "duration_ms": round(execution.duration_ms, 2),
            "total_records_processed": execution.total_records_processed,
            "error_message": execution.error_message,
            "steps": [
                {
                    "step_id": se.step_id,
                    "step_name": se.step_name,
                    "status": se.status,
                    "duration_ms": round(se.duration_ms, 2),
                    "input_records": se.input_records,
                    "output_records": se.output_records,
                    "quality_results": [
                        {
                            "rule_id": qr.rule_id,
                            "passed": qr.passed,
                            "details": qr.details,
                        }
                        for qr in se.quality_results
                    ],
                }
                for se in execution.step_executions
            ],
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{pipeline_id}/history")
async def get_execution_history(
    pipeline_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    """Get pipeline execution history."""
    service = get_data_pipeline_service()
    return await service.get_execution_history(pipeline_id, limit)
