"""
Feature Flags API Routes
Features: CRUD flags, evaluate, A/B testing, audit log
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.feature_flag_service import (
    FeatureFlagService, get_feature_flag_service,
    FlagType, FlagStatus, FeatureFlag,
)

router = APIRouter(prefix="/api/feature-flags", tags=["Feature Flags"])


class CreateFlagRequest(BaseModel):
    id: str
    name: str
    description: str = ""
    flag_type: str = "boolean"
    enabled: bool = False
    percentage: float = 0.0
    allowed_users: List[str] = []
    environments: List[str] = []
    variants: Dict[str, float] = {}
    tags: List[str] = []
    category: str = "general"


class UpdateFlagRequest(BaseModel):
    updates: Dict[str, Any]


class EvaluateFlagRequest(BaseModel):
    user_id: str = "anonymous"
    context: Dict[str, Any] = {}


@router.get("/")
async def list_flags(
    category: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
):
    """List all feature flags."""
    service = get_feature_flag_service()
    st = None
    if status:
        try:
            st = FlagStatus(status)
        except ValueError:
            pass
    return await service.list_flags(category=category, status=st, tag=tag)


@router.get("/stats")
async def get_evaluation_stats(flag_id: Optional[str] = None):
    """Get feature flag evaluation statistics."""
    service = get_feature_flag_service()
    return await service.get_evaluation_stats(flag_id)


@router.get("/audit-log")
async def get_audit_log(
    flag_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    """Get audit log."""
    service = get_feature_flag_service()
    return await service.get_audit_log(flag_id, limit)


@router.get("/{flag_id}")
async def get_flag(flag_id: str):
    """Get a specific feature flag."""
    service = get_feature_flag_service()
    flag = await service.get_flag(flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    return flag


@router.post("/")
async def create_flag(data: CreateFlagRequest):
    """Create a new feature flag."""
    service = get_feature_flag_service()
    try:
        flag_type = FlagType(data.flag_type)
    except ValueError:
        flag_type = FlagType.BOOLEAN

    flag = FeatureFlag(
        id=data.id,
        name=data.name,
        description=data.description,
        flag_type=flag_type,
        enabled=data.enabled,
        percentage=data.percentage,
        allowed_users=data.allowed_users,
        environments=data.environments,
        variants=data.variants,
        tags=data.tags,
        category=data.category,
    )
    try:
        return await service.create_flag(flag)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{flag_id}")
async def update_flag(flag_id: str, data: UpdateFlagRequest):
    """Update a feature flag."""
    service = get_feature_flag_service()
    try:
        flag = await service.update_flag(flag_id, data.updates)
        return await service.get_flag(flag_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{flag_id}/evaluate")
async def evaluate_flag(flag_id: str, data: EvaluateFlagRequest):
    """Evaluate a feature flag for a user."""
    service = get_feature_flag_service()
    evaluation = await service.evaluate(flag_id, data.user_id, data.context)
    return {
        "flag_id": evaluation.flag_id,
        "user_id": evaluation.user_id,
        "enabled": evaluation.enabled,
        "variant": evaluation.variant,
        "reason": evaluation.reason,
    }


@router.post("/{flag_id}/evaluate-bulk")
async def evaluate_bulk(flag_id: str):
    """Evaluate all flags for a user (batch)."""
    service = get_feature_flag_service()
    flags = await service.list_flags()
    results = {}
    for flag_data in flags:
        evaluation = await service.evaluate(flag_data["id"], "anonymous")
        results[flag_data["id"]] = {
            "enabled": evaluation.enabled,
            "variant": evaluation.variant,
        }
    return results


@router.get("/{flag_id}/ab-results")
async def get_ab_results(flag_id: str):
    """Get A/B test results."""
    service = get_feature_flag_service()
    results = await service.get_ab_test_results(flag_id)
    if not results:
        raise HTTPException(status_code=404, detail="No A/B test data found")
    return results


@router.post("/{flag_id}/conversion")
async def track_conversion(flag_id: str, data: EvaluateFlagRequest):
    """Track an A/B test conversion."""
    service = get_feature_flag_service()
    await service.track_conversion(flag_id, data.user_id)
    return {"status": "tracked"}


@router.delete("/{flag_id}")
async def delete_flag(flag_id: str):
    """Delete a feature flag."""
    service = get_feature_flag_service()
    try:
        await service.delete_flag(flag_id)
        return {"status": "deleted", "flag_id": flag_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
