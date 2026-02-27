"""
Message Queue API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/queues", tags=["queues"])


class CreateQueueRequest(BaseModel):
    name: str
    queue_type: str = "standard"
    max_size: int = 100000
    message_ttl: int = 86400
    max_retries: int = 3
    dead_letter_queue: str = ""


class PublishMessageRequest(BaseModel):
    body: dict
    priority: int = 0
    delay_seconds: int = 0
    headers: dict = {}


@router.get("/dashboard")
async def get_dashboard():
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    return await svc.get_dashboard()


@router.get("")
async def list_queues(status: Optional[str] = None, queue_type: Optional[str] = None):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    return {"queues": await svc.list_queues(status, queue_type)}


@router.get("/{queue_id}")
async def get_queue(queue_id: str):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    queue = await svc.get_queue(queue_id)
    if not queue:
        raise HTTPException(404, "Queue not found")
    return queue


@router.post("")
async def create_queue(req: CreateQueueRequest):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    return await svc.create_queue(
        req.name, req.queue_type, req.max_size,
        req.message_ttl, req.max_retries, req.dead_letter_queue
    )


@router.delete("/{queue_id}")
async def delete_queue(queue_id: str):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    if not await svc.delete_queue(queue_id):
        raise HTTPException(404, "Queue not found")
    return {"status": "deleted"}


@router.post("/{queue_id}/purge")
async def purge_queue(queue_id: str):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    result = await svc.purge_queue(queue_id)
    if not result:
        raise HTTPException(404, "Queue not found")
    return result


@router.post("/{queue_id}/pause")
async def pause_queue(queue_id: str):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    result = await svc.pause_queue(queue_id)
    if not result:
        raise HTTPException(404, "Queue not found")
    return result


@router.post("/{queue_id}/resume")
async def resume_queue(queue_id: str):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    result = await svc.resume_queue(queue_id)
    if not result:
        raise HTTPException(404, "Queue not found")
    return result


@router.get("/{queue_id}/consumers")
async def list_consumers(queue_id: str):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    consumers = await svc.list_consumers(queue_id)
    if consumers is None:
        raise HTTPException(404, "Queue not found")
    return {"consumers": consumers}


@router.delete("/{queue_id}/consumers/{consumer_id}")
async def disconnect_consumer(queue_id: str, consumer_id: str):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    if not await svc.disconnect_consumer(queue_id, consumer_id):
        raise HTTPException(404, "Consumer not found")
    return {"status": "disconnected"}


@router.get("/{queue_id}/messages")
async def list_messages(queue_id: str, status: Optional[str] = None, limit: int = 50):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    return {"messages": await svc.list_messages(queue_id, status, limit)}


@router.post("/{queue_id}/messages")
async def publish_message(queue_id: str, req: PublishMessageRequest):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    return await svc.publish_message(queue_id, req.body, req.priority,
                                      req.delay_seconds, req.headers)


@router.post("/{queue_id}/messages/{msg_id}/retry")
async def retry_message(queue_id: str, msg_id: str):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    if not await svc.retry_message(queue_id, msg_id):
        raise HTTPException(404, "Message not found")
    return {"status": "retried"}


@router.delete("/{queue_id}/messages/{msg_id}")
async def delete_message(queue_id: str, msg_id: str):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    if not await svc.delete_message(queue_id, msg_id):
        raise HTTPException(404, "Message not found")
    return {"status": "deleted"}


@router.get("/exchanges/list")
async def list_exchanges():
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    return {"exchanges": await svc.list_exchanges()}


@router.get("/metrics/timeseries")
async def get_metrics(queue_id: Optional[str] = None, hours: int = 24):
    from backend.services.queue_service import QueueMonitorService
    svc = QueueMonitorService()
    await svc.initialize()
    return await svc.get_metrics(queue_id, hours)
