"""
Rate Limiting API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from enum import Enum

router = APIRouter(prefix="/api/v1/rate-limits", tags=["rate-limits"])


class CreateRuleRequest(BaseModel):
    name: str
    endpoint_pattern: str
    requests_per_window: int
    window_seconds: int
    burst_limit: int = 0
    enabled: bool = True


class CheckRateRequest(BaseModel):
    endpoint: str
    key: str
    ip_address: str = ""
    user_id: str = ""


@router.get("/rules")
async def list_rules(enabled_only: bool = False):
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    return {"rules": await svc.list_rules(enabled_only)}


@router.get("/rules/{rule_id}")
async def get_rule(rule_id: str):
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    rule = await svc.get_rule(rule_id)
    if not rule:
        raise HTTPException(404, "Rule not found")
    return rule


@router.post("/rules")
async def create_rule(req: CreateRuleRequest):
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    return await svc.create_rule(req.name, req.endpoint_pattern,
                                  req.requests_per_window, req.window_seconds,
                                  burst_limit=req.burst_limit, enabled=req.enabled)


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    if not await svc.delete_rule(rule_id):
        raise HTTPException(404, "Rule not found")
    return {"status": "deleted"}


@router.post("/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str):
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    result = await svc.toggle_rule(rule_id)
    if not result:
        raise HTTPException(404, "Rule not found")
    return result


@router.post("/check")
async def check_rate_limit(req: CheckRateRequest):
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    return await svc.check_rate_limit(req.endpoint, req.key, req.ip_address, req.user_id)


@router.get("/events")
async def get_events(rule_id: Optional[str] = None, limit: int = 100,
                     blocked_only: bool = False):
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    return {"events": await svc.get_events(rule_id, limit, blocked_only)}


@router.get("/analytics")
async def get_analytics():
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    return await svc.get_analytics()


@router.get("/quotas/plans")
async def list_quota_plans():
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    return {"plans": await svc.list_quota_plans()}


@router.get("/quotas/users/{user_id}")
async def get_user_quota(user_id: str):
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    return await svc.get_user_quota(user_id)


@router.get("/summary")
async def get_summary():
    from backend.services.rate_limit_service import RateLimitService
    svc = RateLimitService()
    await svc.initialize()
    return await svc.get_summary()
