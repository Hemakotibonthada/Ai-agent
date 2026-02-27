"""
Workflow API Routes
Features: CRUD workflows, execute, templates, history
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.workflow_service import (
    WorkflowEngine, get_workflow_engine,
)

router = APIRouter(prefix="/api/workflows", tags=["Workflows"])


class CreateWorkflowRequest(BaseModel):
    name: str
    description: str = ""
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    tags: List[str] = []


class ExecuteWorkflowRequest(BaseModel):
    context: Dict[str, Any] = {}
    triggered_by: str = "manual"


@router.get("/")
async def list_workflows(
    status: Optional[str] = None,
    tag: Optional[str] = None,
):
    """List all workflows."""
    engine = get_workflow_engine()
    return await engine.list_workflows(status=status, tag=tag)


@router.get("/templates")
async def get_templates():
    """Get workflow templates."""
    engine = get_workflow_engine()
    return await engine.get_templates()


@router.get("/stats")
async def get_workflow_stats():
    """Get workflow system statistics."""
    engine = get_workflow_engine()
    return await engine.get_stats()


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str):
    """Get a specific workflow."""
    engine = get_workflow_engine()
    workflow = await engine.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.post("/")
async def create_workflow(data: CreateWorkflowRequest):
    """Create a new workflow."""
    engine = get_workflow_engine()
    try:
        return await engine.create_workflow(
            name=data.name,
            description=data.description,
            nodes=data.nodes,
            edges=data.edges,
            tags=data.tags,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, data: ExecuteWorkflowRequest):
    """Execute a workflow."""
    engine = get_workflow_engine()
    try:
        return await engine.execute_workflow(
            workflow_id, data.context, data.triggered_by
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{workflow_id}/history")
async def get_execution_history(
    workflow_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    """Get workflow execution history."""
    engine = get_workflow_engine()
    return await engine.get_execution_history(workflow_id, limit)


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """Delete a workflow."""
    engine = get_workflow_engine()
    try:
        await engine.delete_workflow(workflow_id)
        return {"status": "deleted", "workflow_id": workflow_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
