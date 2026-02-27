"""Advanced Notification API routes."""
from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from services.advanced_notification_service import get_notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
service = get_notification_service()


class SendNotificationRequest(BaseModel):
    title: str
    message: str
    channel: str = "in_app"
    priority: str = "medium"
    category: str = "system"
    user_id: str = "admin"
    data: dict = {}
    template_id: str = ""


class UpdatePreferencesRequest(BaseModel):
    channel_preferences: dict = {}
    quiet_hours: dict = {}
    digest_settings: dict = {}


@router.get("/")
async def list_notifications(
    user_id: str = "admin",
    channel: Optional[str] = None,
    category: Optional[str] = None,
    unread_only: bool = False,
    limit: int = 50,
):
    return service.list_notifications(
        user_id=user_id,
        channel=channel,
        category=category,
        unread_only=unread_only,
        limit=limit,
    )


@router.get("/stats")
async def get_stats(user_id: str = "admin"):
    return service.get_stats(user_id)


@router.get("/preferences")
async def get_preferences(user_id: str = "admin"):
    return service.get_preferences(user_id)


@router.get("/templates")
async def list_templates():
    return service.list_templates()


@router.post("/send")
async def send_notification(req: SendNotificationRequest):
    result = service.send_notification(req.model_dump())
    return result


@router.post("/broadcast")
async def broadcast_notification(req: SendNotificationRequest, user_ids: str = "admin"):
    ids = [uid.strip() for uid in user_ids.split(",")]
    results = service.broadcast(req.model_dump(), ids)
    return {"sent": len(results), "results": results}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str):
    result = service.mark_read(notification_id)
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.post("/read-all")
async def mark_all_read(user_id: str = "admin"):
    count = service.mark_all_read(user_id)
    return {"success": True, "marked": count}


@router.put("/preferences")
async def update_preferences(user_id: str = "admin", req: UpdatePreferencesRequest = None):
    result = service.update_preferences(user_id, req.model_dump() if req else {})
    return result


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str):
    result = service.delete_notification(notification_id)
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}
