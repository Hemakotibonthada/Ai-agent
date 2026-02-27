"""
Plugin API Routes
Features: List, install, activate, deactivate, configure, marketplace
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ...services.plugin_service import (
    PluginService, get_plugin_service,
    PluginCategory, PluginState,
)

router = APIRouter(prefix="/api/plugins", tags=["Plugins"])


class InstallPluginRequest(BaseModel):
    plugin_id: str


class UpdateConfigRequest(BaseModel):
    config: Dict[str, Any]


@router.get("/")
async def list_plugins(
    category: Optional[str] = None,
    state: Optional[str] = None,
    search: Optional[str] = None,
):
    """List installed plugins."""
    service = get_plugin_service()
    cat = None
    if category:
        try:
            cat = PluginCategory(category)
        except ValueError:
            pass
    st = None
    if state:
        try:
            st = PluginState(state)
        except ValueError:
            pass
    return await service.list_plugins(category=cat, state=st, search=search)


@router.get("/marketplace")
async def get_marketplace(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("downloads", regex="^(downloads|rating|name)$"),
):
    """Browse plugin marketplace."""
    service = get_plugin_service()
    cat = None
    if category:
        try:
            cat = PluginCategory(category)
        except ValueError:
            pass
    return await service.get_marketplace(category=cat, search=search, sort_by=sort_by)


@router.get("/stats")
async def get_plugin_stats():
    """Get plugin system statistics."""
    service = get_plugin_service()
    return await service.get_plugin_stats()


@router.get("/health")
async def check_all_health():
    """Check health of all active plugins."""
    service = get_plugin_service()
    return await service.health_check_all()


@router.get("/{plugin_id}")
async def get_plugin(plugin_id: str):
    """Get plugin details."""
    service = get_plugin_service()
    info = await service.get_plugin_info(plugin_id)
    if not info:
        raise HTTPException(status_code=404, detail="Plugin not found")
    return info


@router.post("/install")
async def install_plugin(data: InstallPluginRequest):
    """Install a plugin."""
    service = get_plugin_service()
    try:
        info = await service.install_plugin(data.plugin_id)
        return {"status": "installed", "plugin": info.manifest.name}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{plugin_id}/activate")
async def activate_plugin(plugin_id: str):
    """Activate a plugin."""
    service = get_plugin_service()
    try:
        info = await service.activate_plugin(plugin_id)
        return {"status": "activated", "plugin": info.manifest.name}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{plugin_id}/deactivate")
async def deactivate_plugin(plugin_id: str):
    """Deactivate a plugin."""
    service = get_plugin_service()
    try:
        info = await service.deactivate_plugin(plugin_id)
        return {"status": "deactivated", "plugin": info.manifest.name}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{plugin_id}/config")
async def update_config(plugin_id: str, data: UpdateConfigRequest):
    """Update plugin configuration."""
    service = get_plugin_service()
    try:
        await service.update_plugin_config(plugin_id, data.config)
        return {"status": "updated"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{plugin_id}")
async def uninstall_plugin(plugin_id: str):
    """Uninstall a plugin."""
    service = get_plugin_service()
    try:
        await service.uninstall_plugin(plugin_id)
        return {"status": "uninstalled", "plugin_id": plugin_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
