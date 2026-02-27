"""API routes for Media Management service."""
from fastapi import APIRouter, Query
from typing import Optional
from pydantic import BaseModel

router = APIRouter()


def _get_service():
    from services.media_service import get_media_service
    return get_media_service()


class MediaCreateRequest(BaseModel):
    name: str
    folder: str = "Uncategorized"
    tags: list = []
    description: str = ""
    alt_text: str = ""
    size_bytes: int = 0


class MediaUpdateRequest(BaseModel):
    name: Optional[str] = None
    folder: Optional[str] = None
    tags: Optional[list] = None
    description: Optional[str] = None
    alt_text: Optional[str] = None
    starred: Optional[bool] = None


class BulkActionRequest(BaseModel):
    item_ids: list
    action: str
    folder: Optional[str] = None
    tags: Optional[list] = None


class FolderCreateRequest(BaseModel):
    name: str
    parent_id: Optional[str] = None
    color: str = "#8B5CF6"


class CollectionCreateRequest(BaseModel):
    name: str
    description: str = ""
    item_ids: list = []
    tags: list = []


@router.get("/media")
async def list_media(
    type: Optional[str] = None,
    folder: Optional[str] = None,
    starred: Optional[bool] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    from services.media_service import MediaType
    svc = _get_service()
    media_type = MediaType(type) if type else None
    items, total = svc.list_items(media_type, folder, None, starred, search, sort_by, sort_order, limit, offset)
    return {"items": items, "total": total}


@router.get("/media/stats")
async def media_stats():
    return _get_service().get_stats()


@router.get("/media/folders")
async def list_folders():
    return _get_service().list_folders()


@router.post("/media/folders")
async def create_folder(req: FolderCreateRequest):
    return _get_service().create_folder(req.name, req.parent_id, req.color)


@router.get("/media/collections")
async def list_collections():
    return _get_service().list_collections()


@router.post("/media/collections")
async def create_collection(req: CollectionCreateRequest):
    return _get_service().create_collection(req.model_dump())


@router.get("/media/search")
async def search_media(q: str = ""):
    return _get_service().search(q)


@router.post("/media")
async def create_media(req: MediaCreateRequest):
    return _get_service().create_item(req.model_dump())


@router.get("/media/{item_id}")
async def get_media(item_id: str):
    item = _get_service().get_item(item_id)
    if not item:
        return {"error": "Media item not found"}
    return item


@router.put("/media/{item_id}")
async def update_media(item_id: str, req: MediaUpdateRequest):
    result = _get_service().update_item(item_id, req.model_dump(exclude_none=True))
    if not result:
        return {"error": "Media item not found"}
    return result


@router.delete("/media/{item_id}")
async def delete_media(item_id: str):
    if _get_service().delete_item(item_id):
        return {"status": "deleted"}
    return {"error": "Media item not found"}


@router.post("/media/{item_id}/star")
async def toggle_star(item_id: str):
    result = _get_service().toggle_star(item_id)
    if not result:
        return {"error": "Media item not found"}
    return result


@router.post("/media/{item_id}/move")
async def move_media(item_id: str, folder: str = "Uncategorized"):
    result = _get_service().move_item(item_id, folder)
    if not result:
        return {"error": "Media item not found"}
    return result


@router.post("/media/bulk")
async def bulk_action(req: BulkActionRequest):
    return _get_service().bulk_action(req.item_ids, req.action, folder=req.folder, tags=req.tags)
