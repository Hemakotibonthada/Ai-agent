# NEXUS AI - System API Routes
"""
Endpoints for system information, resource monitoring,
log retrieval, settings management, and health checks.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.repositories import ActivityLogRepository
from api.dependencies import get_engine


# ============================================================
# Request / Response Models
# ============================================================

class SystemInfoResponse(BaseModel):
    """Comprehensive system information."""
    app_name: str
    version: str
    environment: str
    uptime_seconds: float = 0.0
    platform: str = ""
    architecture: str = ""
    python_version: str = ""
    hostname: str = ""
    cpu_count: Optional[int] = None
    memory_total_gb: Optional[float] = None
    memory_available_gb: Optional[float] = None
    disk_total_gb: Optional[float] = None
    disk_free_gb: Optional[float] = None
    gpu_info: Dict[str, Any] = {}
    agents_registered: int = 0
    services_registered: int = 0
    timestamp: str


class SystemResourcesResponse(BaseModel):
    """Current system resource usage."""
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    memory_used_gb: float = 0.0
    memory_total_gb: float = 0.0
    disk_percent: float = 0.0
    disk_used_gb: float = 0.0
    disk_total_gb: float = 0.0
    network: Dict[str, Any] = {}
    network_speed_mbps: float = 0.0
    network_speed_percent: float = 0.0
    network_link_speed_mbps: float = 0.0
    process_count: int = 0
    timestamp: str


class SystemLogEntry(BaseModel):
    """A single log entry."""
    id: str
    activity_type: str
    agent_name: Optional[str] = None
    description: str
    status: str = "success"
    duration_ms: Optional[float] = None
    metadata: Dict[str, Any] = {}
    created_at: str


class SystemLogsResponse(BaseModel):
    """Paginated system logs."""
    logs: List[SystemLogEntry]
    total: int
    stats: Dict[str, Any] = {}
    timestamp: str


class SettingsUpdateRequest(BaseModel):
    """Request to update system settings."""
    settings: Dict[str, Any] = Field(
        ..., description="Key-value pairs of settings to update"
    )


class SettingsUpdateResponse(BaseModel):
    """Response after updating settings."""
    success: bool
    updated_keys: List[str]
    message: str
    timestamp: str


class SystemHealthResponse(BaseModel):
    """System health check response."""
    status: str
    engine: Dict[str, Any] = {}
    database: Dict[str, Any] = {}
    agents: Dict[str, Any] = {}
    services: Dict[str, Any] = {}
    event_bus: Dict[str, Any] = {}
    timestamp: str


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/system", tags=["System"])


@router.get(
    "/info",
    response_model=SystemInfoResponse,
    summary="Get system information",
)
async def get_system_info(engine=Depends(get_engine)):
    """Get comprehensive system information including hardware and NEXUS status."""
    try:
        engine_status = engine.get_status()
        sys_info = engine.system_info

        return SystemInfoResponse(
            app_name=engine_status.get("app_name", "NEXUS AI"),
            version=engine_status.get("version", "1.0.0"),
            environment=engine_status.get("environment", "development"),
            uptime_seconds=engine_status.get("uptime_seconds", 0),
            platform=sys_info.get("platform", ""),
            architecture=sys_info.get("architecture", ""),
            python_version=sys_info.get("python_version", ""),
            hostname=sys_info.get("hostname", ""),
            cpu_count=sys_info.get("cpu_count"),
            memory_total_gb=sys_info.get("memory_total_gb"),
            memory_available_gb=sys_info.get("memory_available_gb"),
            disk_total_gb=sys_info.get("disk_total_gb"),
            disk_free_gb=sys_info.get("disk_free_gb"),
            gpu_info=engine.gpu_info,
            agents_registered=engine_status.get("agents_registered", 0),
            services_registered=engine_status.get("services_registered", 0),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching system info: {str(e)}",
        )


@router.get(
    "/resources",
    response_model=SystemResourcesResponse,
    summary="Get current resource usage",
)
async def get_system_resources():
    """Get real-time CPU, memory, disk, and network usage."""
    try:
        import psutil

        cpu = psutil.cpu_percent(interval=0.2)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        # Network — measure speed over a short interval
        net_before = psutil.net_io_counters()
        import asyncio
        await asyncio.sleep(0.3)
        net_after = psutil.net_io_counters()

        bytes_sent_sec = (net_after.bytes_sent - net_before.bytes_sent) / 0.3
        bytes_recv_sec = (net_after.bytes_recv - net_before.bytes_recv) / 0.3
        speed_mbps = round((bytes_sent_sec + bytes_recv_sec) * 8 / (1024 * 1024), 2)

        # Get NIC link speed (Mbps) for percentage calculation
        link_speed_mbps = 1000.0  # default 1 Gbps
        try:
            nic_stats = psutil.net_if_stats()
            for name, stat in nic_stats.items():
                if stat.isup and stat.speed > 0:
                    link_speed_mbps = float(stat.speed)
                    break
        except Exception:
            pass

        speed_percent = round(min(100.0, (speed_mbps / link_speed_mbps) * 100), 1)

        network = {
            "bytes_sent": net_after.bytes_sent,
            "bytes_recv": net_after.bytes_recv,
            "packets_sent": net_after.packets_sent,
            "packets_recv": net_after.packets_recv,
            "speed_mbps": speed_mbps,
        }

        return SystemResourcesResponse(
            cpu_percent=cpu,
            memory_percent=mem.percent,
            memory_used_gb=round((mem.total - mem.available) / (1024**3), 2),
            memory_total_gb=round(mem.total / (1024**3), 2),
            disk_percent=disk.percent,
            disk_used_gb=round(disk.used / (1024**3), 2),
            disk_total_gb=round(disk.total / (1024**3), 2),
            network=network,
            network_speed_mbps=speed_mbps,
            network_speed_percent=speed_percent,
            network_link_speed_mbps=link_speed_mbps,
            process_count=len(psutil.pids()),
            timestamp=datetime.utcnow().isoformat(),
        )

    except ImportError:
        return SystemResourcesResponse(
            cpu_percent=0.0,
            memory_percent=0.0,
            timestamp=datetime.utcnow().isoformat(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching resources: {str(e)}",
        )


@router.get(
    "/logs",
    response_model=SystemLogsResponse,
    summary="Get system activity logs",
)
async def get_system_logs(
    activity_type: Optional[str] = Query(None, description="Filter by activity type"),
    agent_name: Optional[str] = Query(None, description="Filter by agent name"),
    hours: int = Query(24, ge=1, le=720, description="Hours of logs to retrieve"),
    limit: int = Query(100, ge=1, le=1000, description="Max log entries"),
    db: AsyncSession = Depends(get_db),
):
    """Get system activity logs with optional filtering."""
    try:
        repo = ActivityLogRepository(db)
        logs = await repo.get_logs(
            activity_type=activity_type,
            agent_name=agent_name,
            hours=hours,
            limit=limit,
        )
        stats = await repo.get_stats(hours=hours)

        log_entries = [
            SystemLogEntry(
                id=log.id,
                activity_type=log.activity_type,
                agent_name=log.agent_name,
                description=log.description,
                status=log.status,
                duration_ms=log.duration_ms,
                metadata=log.metadata or {},
                created_at=log.created_at.isoformat() if log.created_at else "",
            )
            for log in logs
        ]

        return SystemLogsResponse(
            logs=log_entries,
            total=len(log_entries),
            stats=stats,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching logs: {str(e)}",
        )


@router.post(
    "/settings",
    response_model=SettingsUpdateResponse,
    summary="Update system settings",
)
async def update_settings(
    request: SettingsUpdateRequest,
    engine=Depends(get_engine),
):
    """Update runtime system settings. Changes are applied in-memory."""
    try:
        updated_keys: List[str] = []

        for key, value in request.settings.items():
            # Apply to engine config where applicable
            if hasattr(engine.config, key):
                try:
                    setattr(engine.config, key, value)
                    updated_keys.append(key)
                except Exception:
                    pass  # Skip read-only fields
            else:
                # Store in engine's internal config
                engine._services.setdefault("_runtime_settings", {})[key] = value
                updated_keys.append(key)

        return SettingsUpdateResponse(
            success=len(updated_keys) > 0,
            updated_keys=updated_keys,
            message=f"Updated {len(updated_keys)} setting(s)",
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating settings: {str(e)}",
        )


@router.get(
    "/health",
    response_model=SystemHealthResponse,
    summary="System health check",
)
async def system_health_check(
    engine=Depends(get_engine),
    db: AsyncSession = Depends(get_db),
):
    """Comprehensive system health check across all subsystems."""
    try:
        from database.connection import db_manager

        # Engine health
        engine_health = engine.get_health()

        # Database health
        db_health = await db_manager.health_check()

        # Agents
        agents_info: Dict[str, Any] = {}
        for name, agent in engine._agents.items():
            is_healthy = agent.is_healthy() if hasattr(agent, "is_healthy") else True
            agents_info[name] = {
                "status": agent.status.value if hasattr(agent.status, "value") else str(agent.status),
                "healthy": is_healthy,
            }

        # Services
        services_info: Dict[str, Any] = {}
        for name, service in engine._services.items():
            if isinstance(service, dict):
                continue
            is_running = True
            if hasattr(service, "is_running"):
                is_running = service.is_running() if callable(service.is_running) else service.is_running
            services_info[name] = {"running": is_running}

        # Event bus
        event_bus_stats = engine.event_bus.get_stats() if hasattr(engine.event_bus, "get_stats") else {}

        overall = "healthy"
        if db_health.get("status") != "healthy":
            overall = "degraded"
        if not engine_health.get("status") == "healthy":
            overall = "unhealthy"

        return SystemHealthResponse(
            status=overall,
            engine=engine_health,
            database=db_health,
            agents=agents_info,
            services=services_info,
            event_bus=event_bus_stats,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}",
        )
