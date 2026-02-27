"""
Snippet Management API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum

router = APIRouter(prefix="/api/v1/snippets", tags=["snippets"])


class LanguageEnum(str, Enum):
    python = "python"
    typescript = "typescript"
    javascript = "javascript"
    rust = "rust"
    go = "go"
    java = "java"
    cpp = "cpp"
    c = "c"
    csharp = "csharp"
    ruby = "ruby"
    php = "php"
    sql = "sql"
    bash = "bash"
    yaml = "yaml"
    json = "json"
    html = "html"
    css = "css"
    markdown = "markdown"
    dockerfile = "dockerfile"
    other = "other"


class VisibilityEnum(str, Enum):
    private = "private"
    team = "team"
    public = "public"


class CreateSnippetRequest(BaseModel):
    title: str
    code: str
    language: LanguageEnum = LanguageEnum.python
    description: str = ""
    folder: str = "Uncategorized"
    tags: List[str] = []
    visibility: VisibilityEnum = VisibilityEnum.private


class UpdateSnippetRequest(BaseModel):
    title: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    folder: Optional[str] = None
    tags: Optional[List[str]] = None
    visibility: Optional[str] = None
    version_note: Optional[str] = None


class CommentRequest(BaseModel):
    content: str
    user_id: str = "system"
    user_name: str = "System"
    line_number: Optional[int] = None


def _get_service():
    from backend.services.snippet_service import get_snippet_service
    return get_snippet_service()


@router.get("/")
async def list_snippets(
    language: Optional[LanguageEnum] = None,
    folder: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    visibility: Optional[VisibilityEnum] = None,
    starred: Optional[bool] = None,
    sort_by: str = "updated_at",
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List snippets with filtering"""
    service = _get_service()
    from backend.services.snippet_service import SnippetLanguage, SnippetVisibility
    return service.list_snippets(
        language=SnippetLanguage(language.value) if language else None,
        folder=folder,
        tag=tag,
        search=search,
        visibility=SnippetVisibility(visibility.value) if visibility else None,
        starred=starred,
        sort_by=sort_by,
        limit=limit,
        offset=offset,
    )


@router.get("/stats")
async def get_snippet_stats():
    """Get snippet statistics"""
    service = _get_service()
    return service.get_stats()


@router.get("/folders")
async def list_folders():
    """List all snippet folders"""
    service = _get_service()
    return service.list_folders()


@router.get("/tags")
async def list_tags():
    """List all tags"""
    service = _get_service()
    return service.list_tags()


@router.get("/{snippet_id}")
async def get_snippet(snippet_id: str):
    """Get a specific snippet"""
    service = _get_service()
    result = service.get_snippet(snippet_id)
    if not result:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return result


@router.get("/{snippet_id}/versions/{version_number}")
async def get_snippet_version(snippet_id: str, version_number: int):
    """Get a specific version of a snippet"""
    service = _get_service()
    result = service.get_version(snippet_id, version_number)
    if not result:
        raise HTTPException(status_code=404, detail="Version not found")
    return result


@router.post("/")
async def create_snippet(request: CreateSnippetRequest):
    """Create a new snippet"""
    service = _get_service()
    from backend.services.snippet_service import SnippetLanguage, SnippetVisibility
    return service.create_snippet(
        title=request.title,
        code=request.code,
        language=SnippetLanguage(request.language.value),
        description=request.description,
        folder=request.folder,
        tags=request.tags,
        visibility=SnippetVisibility(request.visibility.value),
    )


@router.put("/{snippet_id}")
async def update_snippet(snippet_id: str, request: UpdateSnippetRequest):
    """Update a snippet"""
    service = _get_service()
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    result = service.update_snippet(snippet_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return result


@router.delete("/{snippet_id}")
async def delete_snippet(snippet_id: str):
    """Delete a snippet"""
    service = _get_service()
    if not service.delete_snippet(snippet_id):
        raise HTTPException(status_code=404, detail="Snippet not found")
    return {"status": "deleted"}


@router.post("/{snippet_id}/star")
async def toggle_star(snippet_id: str):
    """Toggle star on a snippet"""
    service = _get_service()
    result = service.toggle_star(snippet_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return {"starred": result}


@router.post("/{snippet_id}/copy")
async def copy_snippet(snippet_id: str):
    """Copy snippet code (increments copy count)"""
    service = _get_service()
    code = service.copy_snippet(snippet_id)
    if code is None:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return {"code": code}


@router.post("/{snippet_id}/comments")
async def add_comment(snippet_id: str, request: CommentRequest):
    """Add a comment to a snippet"""
    service = _get_service()
    result = service.add_comment(
        snippet_id=snippet_id,
        user_id=request.user_id,
        user_name=request.user_name,
        content=request.content,
        line_number=request.line_number,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return result
