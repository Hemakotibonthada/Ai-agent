# NEXUS AI - Main Application Entry Point
"""
FastAPI application factory for the NEXUS AI Operating System.

Responsibilities:
- Create and configure the FastAPI app
- Lifespan management (startup / shutdown)
- Mount all API routers and WebSocket handlers
- Apply middleware stack
- Initialize NexusEngine, database, agents, and services
- Provide root and health-check endpoints
"""

import asyncio
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger

# ---------------------------------------------------------------------------
# Ensure the backend package root is importable when running with
# `uvicorn main:app` from inside the backend/ directory.
# ---------------------------------------------------------------------------
_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from core.config import settings
from core.engine import engine as nexus_engine
from core.events import event_bus
from core.logger import nexus_logger
from database.connection import db_manager


# ============================================================
# Agent & Service Initializer Helpers
# ============================================================

async def _init_database():
    """Initialize the database and create tables."""
    await db_manager.initialize()
    logger.info("✓ Database initialized")


async def _init_agents():
    """Instantiate and register all agents with the engine."""
    from agents import (
        OrchestratorAgent,
        PersonalAgent,
        FinancialAgent,
        HealthAgent,
        HomeAutomationAgent,
        CommunicationAgent,
        VoiceAgent,
        WorkAgent,
        ReportAgent,
        AutomationAgent,
        LearningAgent,
        SecurityAgent,
        MemoryAgent,
        TaskAgent,
    )

    agent_classes = {
        "orchestrator": OrchestratorAgent,
        "personal": PersonalAgent,
        "financial": FinancialAgent,
        "health": HealthAgent,
        "home": HomeAutomationAgent,
        "communication": CommunicationAgent,
        "voice": VoiceAgent,
        "work": WorkAgent,
        "report": ReportAgent,
        "automation": AutomationAgent,
        "learning": LearningAgent,
        "security": SecurityAgent,
        "memory": MemoryAgent,
        "task": TaskAgent,
    }

    orchestrator = None

    for name, cls in agent_classes.items():
        try:
            agent = cls()
            await agent.initialize()
            nexus_engine.register_agent(name, agent)
            if name == "orchestrator":
                orchestrator = agent
            logger.info(f"  ✓ Agent registered: {name}")
        except Exception as e:
            logger.warning(f"  ✗ Failed to initialize agent '{name}': {e}")

    # Register all non-orchestrator agents with the orchestrator for routing
    if orchestrator:
        for name, agent in nexus_engine._agents.items():
            if name != "orchestrator":
                try:
                    orchestrator.register_agent(agent)
                except Exception:
                    pass


async def _init_services():
    """Instantiate and register all services with the engine."""
    from services import (
        AIService,
        VoiceService,
        EmailService,
        SchedulerService,
        NotificationService,
        FileService,
        MQTTService,
        TrainingService,
        SystemService,
    )

    service_defs = [
        ("ai", AIService),
        ("voice", VoiceService),
        ("email", EmailService),
        ("scheduler", SchedulerService),
        ("notification", NotificationService),
        ("file", FileService),
        ("mqtt", MQTTService),
        ("training", TrainingService),
        ("system", SystemService),
    ]

    for name, cls in service_defs:
        try:
            service = cls()
            if hasattr(service, "initialize"):
                await service.initialize()
            elif hasattr(service, "start"):
                await service.start()
            nexus_engine.register_service(name, service)
            logger.info(f"  ✓ Service registered: {name}")
        except Exception as e:
            logger.warning(f"  ✗ Failed to initialize service '{name}': {e}")


async def _ensure_default_user():
    """Create a default user profile if none exists."""
    try:
        from database.repositories import UserRepository

        async with db_manager.get_session() as session:
            repo = UserRepository(session)
            user = await repo.get_default_user()
            if not user:
                await repo.create_user(
                    name=settings.user.name,
                    timezone=settings.user.timezone,
                    language=settings.user.language,
                )
                logger.info("  ✓ Default user created")
    except Exception as e:
        logger.warning(f"  ✗ Default user creation skipped: {e}")


# ============================================================
# Lifespan
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown lifecycle."""
    start = time.time()
    logger.info("=" * 60)
    logger.info("  NEXUS AI — Starting up...")
    logger.info("=" * 60)

    # 1. Initialize engine (logging, directories, event bus)
    await nexus_engine.initialize()

    # 2. Database
    await _init_database()

    # 3. Default user
    await _ensure_default_user()

    # 4. Services (before agents, since agents may depend on services)
    await _init_services()

    # 5. Agents
    await _init_agents()

    elapsed = time.time() - start
    logger.info("=" * 60)
    logger.info(f"  NEXUS AI — Ready in {elapsed:.2f}s")
    logger.info(f"  Agents : {len(nexus_engine._agents)}")
    logger.info(f"  Services: {len(nexus_engine._services)}")
    logger.info(f"  Listening on http://{settings.host}:{settings.port}")
    logger.info("=" * 60)

    yield  # Application is running

    # Shutdown
    logger.info("NEXUS AI — Shutting down...")
    await nexus_engine.shutdown()
    await db_manager.close()
    logger.info("NEXUS AI — Shutdown complete")


# ============================================================
# Application Factory
# ============================================================

app = FastAPI(
    title="NEXUS AI",
    description=(
        "A futuristic local-first AI Operating System that orchestrates "
        "specialized agents for personal productivity, smart home, health, "
        "finance, and more."
    ),
    version=settings.version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ============================================================
# Middleware
# ============================================================

from api.middleware import apply_middleware

apply_middleware(
    app,
    require_auth=settings.is_production,
    api_keys=None,
)


# ============================================================
# Routers
# ============================================================

from api.routes.chat import router as chat_router
from api.routes.agents import router as agents_router
from api.routes.home import router as home_router
from api.routes.health import router as health_router
from api.routes.finance import router as finance_router
from api.routes.tasks import router as tasks_router
from api.routes.system import router as system_router
from api.routes.voice import router as voice_router
from api.routes.reports import router as reports_router
from api.websocket import ws_router

app.include_router(chat_router)
app.include_router(agents_router)
app.include_router(home_router)
app.include_router(health_router)
app.include_router(finance_router)
app.include_router(tasks_router)
app.include_router(system_router)
app.include_router(voice_router)
app.include_router(reports_router)
app.include_router(ws_router)


# ============================================================
# Static Files (serve frontend if present)
# ============================================================

_static_dir = _backend_dir.parent / "frontend" / "dist"
if _static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")


# ============================================================
# Root & Health Endpoints
# ============================================================

@app.get("/", tags=["Root"], summary="NEXUS AI root endpoint")
async def root():
    """Welcome endpoint with basic system information."""
    return {
        "name": settings.app_name,
        "version": settings.version,
        "status": "running",
        "environment": settings.env,
        "docs": "/docs",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/health", tags=["Root"], summary="Health check")
async def health_check():
    """Lightweight health check used by load balancers and monitoring."""
    engine_health = nexus_engine.get_health()
    db_health = await db_manager.health_check()

    overall = "healthy"
    if db_health.get("status") != "healthy":
        overall = "degraded"
    if engine_health.get("status") not in ("healthy", "starting"):
        overall = "unhealthy"

    return {
        "status": overall,
        "engine": engine_health.get("status", "unknown"),
        "database": db_health.get("status", "unknown"),
        "agents": len(nexus_engine._agents),
        "services": len(nexus_engine._services),
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================================
# WebSocket Stats Endpoint
# ============================================================

from api.websocket import ws_manager


@app.get("/api/ws/stats", tags=["WebSocket"], summary="WebSocket connection stats")
async def ws_stats():
    """Get statistics about active WebSocket connections."""
    return ws_manager.get_stats()


# ============================================================
# Run with Uvicorn (direct execution)
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_development,
        log_level="info",
        ws_ping_interval=30,
        ws_ping_timeout=30,
    )
