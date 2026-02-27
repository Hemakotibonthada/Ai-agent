# NEXUS AI - FastAPI Dependency Injection
"""
Centralized dependency factories for FastAPI route handlers.
Provides access to database sessions, engine, services, agents, and user context.
"""

from typing import Any, Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db, db_manager
from core.engine import engine as nexus_engine
from core.config import settings


# ============================================================
# Engine Dependency
# ============================================================

async def get_engine():
    """
    Provide the global NexusEngine instance.
    All route handlers that need access to agents or services
    should depend on this.
    """
    return nexus_engine


# ============================================================
# Current User Dependency
# ============================================================

async def get_current_user_id(request: Request, db: AsyncSession = Depends(get_db)) -> str:
    """
    Resolve the current user ID.

    Order of resolution:
    1. request.state.user_id (set by auth middleware)
    2. X-User-ID header (development convenience)
    3. Default / first user in the database

    Returns a user ID string. Creates a default user if none exists.
    """
    # 1. From auth middleware
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return user_id

    # 2. From header (dev mode only)
    header_id = request.headers.get("X-User-ID")
    if header_id:
        return header_id

    # 3. Default user from database
    try:
        from database.repositories import UserRepository

        repo = UserRepository(db)
        user = await repo.get_default_user()

        if user:
            return user.id

        # Create a default user if none exists
        user = await repo.create_user(
            name=settings.user.name,
            email="",
            timezone=settings.user.timezone,
            language=settings.user.language,
        )
        return user.id

    except Exception:
        # Absolute fallback
        return "default-user"


# ============================================================
# Agent Dependency
# ============================================================

async def get_agent(agent_name: str, engine=Depends(get_engine)) -> Any:
    """
    Retrieve a registered agent by name.
    Raises 404 if the agent is not found.
    """
    agent = engine.get_agent(agent_name)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_name}' not found or not registered",
        )
    return agent


# ============================================================
# Service Dependencies
# ============================================================

async def get_service(service_name: str, engine=Depends(get_engine)) -> Any:
    """
    Retrieve a registered service by name.
    Raises 404 if the service is not found.
    """
    service = engine.get_service(service_name)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service '{service_name}' not found or not registered",
        )
    return service


async def get_ai_service(engine=Depends(get_engine)):
    """Get the AI inference service."""
    return engine.get_service("ai")


async def get_voice_service(engine=Depends(get_engine)):
    """Get the voice processing service."""
    return engine.get_service("voice")


async def get_email_service(engine=Depends(get_engine)):
    """Get the email management service."""
    return engine.get_service("email")


async def get_scheduler_service(engine=Depends(get_engine)):
    """Get the scheduler service."""
    return engine.get_service("scheduler")


async def get_notification_service(engine=Depends(get_engine)):
    """Get the notification service."""
    return engine.get_service("notification")


async def get_file_service(engine=Depends(get_engine)):
    """Get the file management service."""
    return engine.get_service("file")


async def get_mqtt_service(engine=Depends(get_engine)):
    """Get the MQTT IoT communication service."""
    return engine.get_service("mqtt")


async def get_training_service(engine=Depends(get_engine)):
    """Get the model training service."""
    return engine.get_service("training")


async def get_system_service(engine=Depends(get_engine)):
    """Get the system monitoring service."""
    return engine.get_service("system")


# ============================================================
# Database Manager Dependency
# ============================================================

async def get_database_manager():
    """Get the global database manager for health checks and admin ops."""
    return db_manager
