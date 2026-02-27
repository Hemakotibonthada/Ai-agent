"""
Search API Routes
Features: Full-text search, suggestions, recent searches, stats
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ...services.search_service import (
    SearchService, get_search_service,
    SearchFilter, SearchIndex, SortOrder,
)

router = APIRouter(prefix="/api/search", tags=["Search"])


class SearchRequest(BaseModel):
    query: str
    index: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    sort: str = "relevance"
    page: int = 1
    page_size: int = 20
    fuzzy: bool = True


class IndexDocumentRequest(BaseModel):
    id: str
    index: str = "notes"
    title: str
    content: str
    tags: List[str] = []
    category: str = ""
    url: str = ""
    icon: str = ""
    metadata: Dict[str, Any] = {}


@router.post("/")
async def search(data: SearchRequest):
    """Perform a full-text search."""
    service = get_search_service()

    idx = None
    if data.index:
        try:
            idx = SearchIndex(data.index)
        except ValueError:
            idx = SearchIndex.ALL

    filters = SearchFilter(
        index=idx,
        tags=data.tags,
        category=data.category,
    )

    try:
        sort = SortOrder(data.sort)
    except ValueError:
        sort = SortOrder.RELEVANCE

    response = await service.search(
        query=data.query,
        filters=filters,
        sort=sort,
        page=data.page,
        page_size=data.page_size,
        fuzzy=data.fuzzy,
    )

    return {
        "results": [
            {
                "id": r.document.id,
                "title": r.document.title,
                "content": r.document.content[:200],
                "score": round(r.score, 4),
                "highlights": r.highlights,
                "matched_terms": r.matched_terms,
                "category": r.document.category,
                "icon": r.document.icon,
                "url": r.document.url,
                "tags": r.document.tags,
                "index": r.document.index.value,
            }
            for r in response.results
        ],
        "total": response.total,
        "page": response.page,
        "page_size": response.page_size,
        "took_ms": response.took_ms,
        "facets": response.facets,
        "suggestions": response.suggestions,
        "did_you_mean": response.did_you_mean,
    }


@router.get("/suggest")
async def suggest(
    prefix: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    """Get search suggestions."""
    service = get_search_service()
    return await service.suggest(prefix, limit)


@router.get("/recent")
async def get_recent_searches(limit: int = Query(20, ge=1, le=100)):
    """Get recent search history."""
    service = get_search_service()
    return await service.get_recent_searches(limit)


@router.get("/popular")
async def get_popular_searches(limit: int = Query(10, ge=1, le=50)):
    """Get popular searches."""
    service = get_search_service()
    return await service.get_popular_searches(limit)


@router.get("/stats")
async def get_search_stats():
    """Get search statistics."""
    service = get_search_service()
    return await service.get_search_stats()


@router.post("/index")
async def index_document(data: IndexDocumentRequest):
    """Add a document to the search index."""
    from ...services.search_service import SearchDocument

    service = get_search_service()
    try:
        idx = SearchIndex(data.index)
    except ValueError:
        idx = SearchIndex.NOTES

    doc = SearchDocument(
        id=data.id,
        index=idx,
        title=data.title,
        content=data.content,
        tags=data.tags,
        category=data.category,
        url=data.url,
        icon=data.icon,
        metadata=data.metadata,
    )
    service.index_document(doc)
    return {"status": "indexed", "id": data.id}


@router.delete("/index/{doc_id}")
async def remove_document(doc_id: str):
    """Remove a document from the search index."""
    service = get_search_service()
    removed = service.remove_document(doc_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "removed", "id": doc_id}
