"""API routes for Integration Management service."""
from fastapi import APIRouter, Query
from typing import Optional
from pydantic import BaseModel

router = APIRouter()


def _get_service():
    from services.integration_service import get_integration_service
    return get_integration_service()


class IntegrationCreateRequest(BaseModel):
    name: str
    description: str = ""
    provider: str = "custom"
    category: str = "custom"
    base_url: str = ""
    api_key: Optional[str] = None
    capabilities: list = []


class IntegrationUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    config: Optional[dict] = None
    sync_interval_minutes: Optional[int] = None
    enabled: Optional[bool] = None


class WebhookCreateRequest(BaseModel):
    url: str
    events: list = ["*"]
    headers: dict = {}
    retry_on_failure: bool = True
    max_retries: int = 3


@router.get("/integrations")
async def list_integrations(
    category: Optional[str] = None,
    status: Optional[str] = None,
    enabled: Optional[bool] = None,
    search: Optional[str] = None,
):
    from services.integration_service import IntegrationCategory, IntegrationStatus
    svc = _get_service()
    cat = IntegrationCategory(category) if category else None
    st = IntegrationStatus(status) if status else None
    return svc.list_integrations(category=cat, status=st, enabled=enabled, search=search)


@router.get("/integrations/stats")
async def integration_stats():
    return _get_service().get_stats()


@router.get("/integrations/events")
async def available_events():
    return _get_service().get_available_events()


@router.post("/integrations")
async def create_integration(req: IntegrationCreateRequest):
    return _get_service().create_integration(req.model_dump())


@router.get("/integrations/{integration_id}")
async def get_integration(integration_id: str):
    result = _get_service().get_integration(integration_id)
    if not result:
        return {"error": "Integration not found"}
    return result


@router.put("/integrations/{integration_id}")
async def update_integration(integration_id: str, req: IntegrationUpdateRequest):
    result = _get_service().update_integration(integration_id, req.model_dump(exclude_none=True))
    if not result:
        return {"error": "Integration not found"}
    return result


@router.delete("/integrations/{integration_id}")
async def delete_integration(integration_id: str):
    if _get_service().delete_integration(integration_id):
        return {"status": "deleted"}
    return {"error": "Integration not found"}


@router.post("/integrations/{integration_id}/connect")
async def connect_integration(integration_id: str):
    result = _get_service().connect(integration_id)
    if not result:
        return {"error": "Integration not found"}
    return result


@router.post("/integrations/{integration_id}/disconnect")
async def disconnect_integration(integration_id: str):
    result = _get_service().disconnect(integration_id)
    if not result:
        return {"error": "Integration not found"}
    return result


@router.post("/integrations/{integration_id}/test")
async def test_integration(integration_id: str):
    return _get_service().test_connection(integration_id)


@router.post("/integrations/{integration_id}/sync")
async def sync_integration(integration_id: str):
    result = _get_service().sync(integration_id)
    if not result:
        return {"error": "Integration not found"}
    return result


@router.get("/integrations/{integration_id}/webhooks")
async def list_webhooks(integration_id: str):
    return _get_service().list_webhooks(integration_id)


@router.post("/integrations/{integration_id}/webhooks")
async def create_webhook(integration_id: str, req: WebhookCreateRequest):
    result = _get_service().create_webhook(integration_id, req.model_dump())
    if not result:
        return {"error": "Integration not found"}
    return result


@router.delete("/integrations/{integration_id}/webhooks/{webhook_id}")
async def delete_webhook(integration_id: str, webhook_id: str):
    if _get_service().delete_webhook(integration_id, webhook_id):
        return {"status": "deleted"}
    return {"error": "Webhook not found"}
