# NEXUS AI - Agent Management API Routes
"""
Endpoints for managing, monitoring, and interacting with NEXUS AI agents.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.dependencies import get_engine


# ============================================================
# Request / Response Models
# ============================================================

class AgentInfo(BaseModel):
    """Summary information about a single agent."""
    name: str
    agent_id: str
    display_name: str = ""
    description: str
    status: str
    capabilities: List[str] = []
    icon: str = "bot"
    action_count: int = 0
    success_count: int = 0
    error_count: int = 0
    tasks_completed: int = 0
    uptime_seconds: float = 0.0
    error_rate: float = 0.0
    avg_processing_time_ms: float = 0.0
    last_action_at: Optional[str] = None
    created_at: str


class AgentStatusResponse(BaseModel):
    """Detailed status information for a single agent."""
    name: str
    agent_id: str
    description: str
    status: str
    capabilities: List[str] = []
    action_count: int = 0
    success_count: int = 0
    error_count: int = 0
    total_processing_time_ms: float = 0.0
    avg_processing_time_ms: float = 0.0
    last_action_at: Optional[str] = None
    config: Dict[str, Any] = {}
    is_healthy: bool = True
    uptime_seconds: float = 0.0


class AgentActionRequest(BaseModel):
    """Request to trigger an action on an agent."""
    action: str = Field(..., description="Action to perform: start, stop, restart, configure")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Action parameters")


class AgentActionResponse(BaseModel):
    """Response after performing an agent action."""
    agent_name: str
    action: str
    success: bool
    message: str
    timestamp: str


class AgentHealthSummary(BaseModel):
    """Health summary for all agents."""
    total_agents: int
    healthy_agents: int
    unhealthy_agents: int
    agents: List[Dict[str, Any]]
    timestamp: str


class AgentListResponse(BaseModel):
    """Response listing all agents."""
    total: int
    agents: List[AgentInfo]


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/agents", tags=["Agents"])


# Icon mapping for agent names
_ICON_MAP = {
    "orchestrator": "brain", "personal": "user", "home": "home",
    "task": "list-todo", "health": "heart", "finance": "dollar-sign",
    "security": "shield-check", "voice": "mic", "learning": "book-open",
    "report": "file-text", "communication": "message-square",
    "automation": "zap", "work": "briefcase", "memory": "database",
    "vision": "camera",
}


def _display_name(name: str) -> str:
    """Convert agent name to a human-friendly display name."""
    words = name.replace("_", " ").replace("-", " ").split()
    return " ".join(w.capitalize() for w in words)


def _build_agent_info(agent) -> AgentInfo:
    """Build AgentInfo from an agent instance."""
    avg_time = 0.0
    action_count = getattr(agent, "_action_count", 0)
    success_count = getattr(agent, "_success_count", 0)
    error_count = getattr(agent, "_error_count", 0)

    if action_count > 0:
        avg_time = getattr(agent, "_total_processing_time_ms", 0.0) / action_count

    # Compute uptime
    uptime = 0.0
    if hasattr(agent, "_created_at") and agent._created_at:
        uptime = (datetime.utcnow() - agent._created_at).total_seconds()

    # tasks_completed = success_count (real metric)
    tasks_completed = success_count

    # error_rate = error_count / max(action_count,1) * 100
    error_rate = round((error_count / max(action_count, 1)) * 100, 2)

    # Determine icon
    agent_name = agent.name.lower()
    icon = _ICON_MAP.get(agent_name, "bot")
    for key, val in _ICON_MAP.items():
        if key in agent_name:
            icon = val
            break

    return AgentInfo(
        name=agent.name,
        agent_id=getattr(agent, "agent_id", ""),
        display_name=getattr(agent, "display_name", _display_name(agent.name)),
        description=getattr(agent, "description", ""),
        status=agent.status.value if hasattr(agent.status, "value") else str(agent.status),
        capabilities=[
            c.value if hasattr(c, "value") else str(c)
            for c in (agent.get_capabilities() if hasattr(agent, "get_capabilities") else [])
        ],
        icon=icon,
        action_count=action_count,
        success_count=success_count,
        error_count=error_count,
        tasks_completed=tasks_completed,
        uptime_seconds=round(uptime, 2),
        error_rate=error_rate,
        avg_processing_time_ms=round(avg_time, 2),
        last_action_at=(
            agent._last_action_at.isoformat()
            if getattr(agent, "_last_action_at", None) else None
        ),
        created_at=(
            agent._created_at.isoformat()
            if getattr(agent, "_created_at", None)
            else datetime.utcnow().isoformat()
        ),
    )


@router.get(
    "",
    response_model=AgentListResponse,
    summary="List all registered agents",
    description="Returns information about every agent currently registered with the engine.",
)
async def list_agents(engine=Depends(get_engine)):
    """List all registered agents with their current status."""
    agents_dict = engine._agents
    agent_list: List[AgentInfo] = []

    for name, agent in agents_dict.items():
        agent_list.append(_build_agent_info(agent))

    return AgentListResponse(total=len(agent_list), agents=agent_list)


@router.get(
    "/health",
    response_model=AgentHealthSummary,
    summary="Get health summary for all agents",
)
async def agents_health(engine=Depends(get_engine)):
    """Get a health summary across all registered agents."""
    agents_dict = engine._agents
    agent_health_list: List[Dict[str, Any]] = []
    healthy = 0
    unhealthy = 0

    for name, agent in agents_dict.items():
        is_healthy = agent.is_healthy() if hasattr(agent, "is_healthy") else True
        if is_healthy:
            healthy += 1
        else:
            unhealthy += 1

        agent_health_list.append({
            "name": name,
            "status": agent.status.value if hasattr(agent.status, "value") else str(agent.status),
            "is_healthy": is_healthy,
            "error_count": getattr(agent, "_error_count", 0),
            "action_count": getattr(agent, "_action_count", 0),
        })

    return AgentHealthSummary(
        total_agents=len(agents_dict),
        healthy_agents=healthy,
        unhealthy_agents=unhealthy,
        agents=agent_health_list,
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get(
    "/{agent_name}/status",
    response_model=AgentStatusResponse,
    summary="Get detailed status for a specific agent",
)
async def get_agent_status(agent_name: str, engine=Depends(get_engine)):
    """Get detailed status information for a single agent."""
    agent = engine.get_agent(agent_name)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_name}' not found",
        )

    avg_time = 0.0
    if hasattr(agent, "_action_count") and agent._action_count > 0:
        avg_time = agent._total_processing_time_ms / agent._action_count

    uptime = 0.0
    if hasattr(agent, "_created_at") and agent._created_at:
        uptime = (datetime.utcnow() - agent._created_at).total_seconds()

    return AgentStatusResponse(
        name=agent.name,
        agent_id=getattr(agent, "agent_id", ""),
        description=getattr(agent, "description", ""),
        status=agent.status.value if hasattr(agent.status, "value") else str(agent.status),
        capabilities=[
            c.value if hasattr(c, "value") else str(c)
            for c in (agent.get_capabilities() if hasattr(agent, "get_capabilities") else [])
        ],
        action_count=getattr(agent, "_action_count", 0),
        success_count=getattr(agent, "_success_count", 0),
        error_count=getattr(agent, "_error_count", 0),
        total_processing_time_ms=round(getattr(agent, "_total_processing_time_ms", 0.0), 2),
        avg_processing_time_ms=round(avg_time, 2),
        last_action_at=(
            agent._last_action_at.isoformat()
            if getattr(agent, "_last_action_at", None) else None
        ),
        config=getattr(agent, "_config", {}),
        is_healthy=agent.is_healthy() if hasattr(agent, "is_healthy") else True,
        uptime_seconds=round(uptime, 2),
    )


@router.post(
    "/{agent_name}/action",
    response_model=AgentActionResponse,
    summary="Perform an action on an agent",
)
async def agent_action(
    agent_name: str,
    request: AgentActionRequest,
    engine=Depends(get_engine),
):
    """Perform a lifecycle action on an agent (start, stop, restart, configure)."""
    agent = engine.get_agent(agent_name)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_name}' not found",
        )

    action = request.action.lower()
    success = False
    message = ""

    try:
        if action == "start":
            if hasattr(agent, "initialize"):
                await agent.initialize()
            success = True
            message = f"Agent '{agent_name}' started successfully"

        elif action == "stop":
            if hasattr(agent, "stop"):
                await agent.stop()
            success = True
            message = f"Agent '{agent_name}' stopped successfully"

        elif action == "restart":
            if hasattr(agent, "stop"):
                await agent.stop()
            if hasattr(agent, "initialize"):
                await agent.initialize()
            success = True
            message = f"Agent '{agent_name}' restarted successfully"

        elif action == "configure":
            if hasattr(agent, "_config") and request.parameters:
                agent._config.update(request.parameters)
            success = True
            message = f"Agent '{agent_name}' configured successfully"

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown action: '{action}'. Supported: start, stop, restart, configure",
            )

    except HTTPException:
        raise
    except Exception as e:
        success = False
        message = f"Action '{action}' failed on agent '{agent_name}': {str(e)}"

    return AgentActionResponse(
        agent_name=agent_name,
        action=action,
        success=success,
        message=message,
        timestamp=datetime.utcnow().isoformat(),
    )
