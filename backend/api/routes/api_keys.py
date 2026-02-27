"""
API Key Management Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum

router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])


class KeyEnvironmentEnum(str, Enum):
    production = "production"
    staging = "staging"
    development = "development"
    testing = "testing"


class KeyStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"
    expired = "expired"
    revoked = "revoked"


class CreateKeyRequest(BaseModel):
    name: str
    environment: KeyEnvironmentEnum = KeyEnvironmentEnum.development
    scopes: List[Dict[str, Any]] = [{"resource": "*", "actions": ["read"]}]
    rate_limit: Optional[Dict[str, Any]] = None
    expires_in_days: Optional[int] = 365
    description: str = ""
    ip_whitelist: List[str] = []
    allowed_origins: List[str] = []
    tags: Dict[str, str] = {}


class UpdateKeyRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    ip_whitelist: Optional[List[str]] = None
    allowed_origins: Optional[List[str]] = None
    scopes: Optional[List[Dict[str, Any]]] = None
    rate_limit: Optional[Dict[str, Any]] = None
    tags: Optional[Dict[str, str]] = None


class RotateKeyRequest(BaseModel):
    expire_old_in_hours: int = 24


class RevokeKeyRequest(BaseModel):
    reason: str = ""


def _get_service():
    from backend.services.api_key_service import get_api_key_service
    return get_api_key_service()


@router.get("/")
async def list_api_keys(
    environment: Optional[KeyEnvironmentEnum] = None,
    status: Optional[KeyStatusEnum] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List all API keys"""
    service = _get_service()
    from backend.services.api_key_service import KeyEnvironment, KeyStatus
    return service.list_keys(
        environment=KeyEnvironment(environment.value) if environment else None,
        status=KeyStatus(status.value) if status else None,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/stats")
async def get_api_key_stats():
    """Get aggregated API key statistics"""
    service = _get_service()
    return service.get_aggregated_stats()


@router.get("/{key_id}")
async def get_api_key(key_id: str):
    """Get a specific API key"""
    service = _get_service()
    result = service.get_key(key_id)
    if not result:
        raise HTTPException(status_code=404, detail="API key not found")
    return result


@router.get("/{key_id}/usage")
async def get_key_usage(key_id: str, period: str = "24h"):
    """Get usage statistics for an API key"""
    service = _get_service()
    result = service.get_usage_summary(key_id, period=period)
    if not result:
        raise HTTPException(status_code=404, detail="API key not found")
    return result


@router.post("/")
async def create_api_key(request: CreateKeyRequest):
    """Create a new API key"""
    service = _get_service()
    from backend.services.api_key_service import KeyEnvironment
    return service.create_key(
        name=request.name,
        environment=KeyEnvironment(request.environment.value),
        scopes=request.scopes,
        rate_limit=request.rate_limit,
        expires_in_days=request.expires_in_days,
        description=request.description,
        ip_whitelist=request.ip_whitelist,
        allowed_origins=request.allowed_origins,
        tags=request.tags,
    )


@router.put("/{key_id}")
async def update_api_key(key_id: str, request: UpdateKeyRequest):
    """Update an API key"""
    service = _get_service()
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    result = service.update_key(key_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="API key not found")
    return result


@router.post("/{key_id}/rotate")
async def rotate_api_key(key_id: str, request: RotateKeyRequest):
    """Rotate an API key"""
    service = _get_service()
    result = service.rotate_key(key_id, expire_old_in_hours=request.expire_old_in_hours)
    if not result:
        raise HTTPException(status_code=404, detail="API key not found")
    return result


@router.post("/{key_id}/revoke")
async def revoke_api_key(key_id: str, request: RevokeKeyRequest):
    """Revoke an API key"""
    service = _get_service()
    if not service.revoke_key(key_id, reason=request.reason):
        raise HTTPException(status_code=404, detail="API key not found")
    return {"status": "revoked"}


@router.delete("/{key_id}")
async def delete_api_key(key_id: str):
    """Permanently delete an API key"""
    service = _get_service()
    if not service.delete_key(key_id):
        raise HTTPException(status_code=404, detail="API key not found")
    return {"status": "deleted"}
