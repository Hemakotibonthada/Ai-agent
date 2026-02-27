# NEXUS AI - Core Engine
"""
The central orchestration engine that initializes and manages all 
NEXUS AI subsystems, agents, and services.
"""

import asyncio
import platform
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from pathlib import Path
from loguru import logger

from .config import settings, NexusSettings
from .logger import nexus_logger
from .events import EventBus, Event, EventCategory, EventPriority, event_bus
from .security import SecurityManager


class SystemInfo:
    """Collects and provides system information."""

    @staticmethod
    def get_info() -> Dict[str, Any]:
        """Get comprehensive system information."""
        try:
            import psutil
            cpu_count = psutil.cpu_count()
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            
            return {
                "platform": platform.system(),
                "platform_version": platform.version(),
                "architecture": platform.machine(),
                "processor": platform.processor(),
                "python_version": platform.python_version(),
                "hostname": platform.node(),
                "cpu_count": cpu_count,
                "cpu_percent": cpu_percent,
                "memory_total_gb": round(memory.total / (1024**3), 2),
                "memory_available_gb": round(memory.available / (1024**3), 2),
                "memory_percent": memory.percent,
                "disk_total_gb": round(disk.total / (1024**3), 2),
                "disk_free_gb": round(disk.free / (1024**3), 2),
                "disk_percent": disk.percent,
            }
        except ImportError:
            return {
                "platform": platform.system(),
                "platform_version": platform.version(),
                "architecture": platform.machine(),
                "processor": platform.processor(),
                "python_version": platform.python_version(),
                "hostname": platform.node(),
            }

    @staticmethod
    def check_gpu() -> Dict[str, Any]:
        """Check GPU availability."""
        gpu_info = {"available": False, "gpus": []}
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu_info["available"] = True
                for gpu in gpus:
                    gpu_info["gpus"].append({
                        "id": gpu.id,
                        "name": gpu.name,
                        "memory_total_mb": gpu.memoryTotal,
                        "memory_used_mb": gpu.memoryUsed,
                        "memory_free_mb": gpu.memoryFree,
                        "temperature": gpu.temperature,
                        "load": gpu.load,
                    })
        except (ImportError, Exception):
            pass

        # Check CUDA via PyTorch
        try:
            import torch
            gpu_info["cuda_available"] = torch.cuda.is_available()
            if torch.cuda.is_available():
                gpu_info["cuda_device_count"] = torch.cuda.device_count()
                gpu_info["cuda_device_name"] = torch.cuda.get_device_name(0)
        except ImportError:
            gpu_info["cuda_available"] = False

        return gpu_info


class NexusEngine:
    """
    Core engine that orchestrates all NEXUS AI components.
    
    Responsible for:
    - System initialization and configuration
    - Agent lifecycle management
    - Service registration and discovery
    - Event bus management
    - Health monitoring
    - Graceful shutdown
    """

    def __init__(self, config: Optional[NexusSettings] = None):
        self.config = config or settings
        self.event_bus = event_bus
        self.security = SecurityManager(
            secret_key=self.config.secret_key,
            data_dir=str(self.config.data_dir),
        )

        # Component registries
        self._agents: Dict[str, Any] = {}
        self._services: Dict[str, Any] = {}
        self._tasks: List[asyncio.Task] = []

        # State
        self._started = False
        self._start_time: Optional[float] = None
        self._initialization_log: List[Dict[str, Any]] = []

        # System info
        self.system_info = SystemInfo.get_info()
        self.gpu_info = SystemInfo.check_gpu()

    async def initialize(self):
        """
        Initialize all NEXUS AI subsystems in the correct order.
        """
        logger.info("=" * 60)
        logger.info("  NEXUS AI - Initializing...")
        logger.info("=" * 60)

        self._start_time = time.time()

        # Step 1: Configure logging
        nexus_logger.configure(
            log_dir=str(self.config.logs_dir),
            level=self.config.logging.level,
            rotation=self.config.logging.rotation,
            retention=self.config.logging.retention,
        )
        self._log_init("Logging", "configured")

        # Step 2: Initialize data directories
        self._init_directories()
        self._log_init("Directories", "created")

        # Step 3: Start event bus
        await self.event_bus.start()
        self._log_init("EventBus", "started")

        # Step 4: Subscribe to system events
        self._setup_system_event_handlers()
        self._log_init("SystemEvents", "configured")

        # Step 5: Log system information
        self._log_system_info()

        # Emit initialization complete event
        await self.event_bus.emit(
            event_type="system.initialized",
            data={
                "timestamp": datetime.utcnow().isoformat(),
                "system_info": self.system_info,
                "gpu_info": self.gpu_info,
            },
            category=EventCategory.SYSTEM,
            priority=EventPriority.HIGH,
        )

        self._started = True
        elapsed = time.time() - self._start_time
        logger.info(f"NEXUS AI initialized in {elapsed:.2f}s")
        logger.info("=" * 60)

    def _init_directories(self):
        """Create all required directories."""
        directories = [
            self.config.data_dir,
            self.config.logs_dir,
            self.config.data_dir / "models",
            self.config.data_dir / "training",
            self.config.data_dir / "embeddings",
            self.config.data_dir / "reports",
            self.config.data_dir / "exports",
            self.config.data_dir / "voice",
            self.config.data_dir / "backups",
            self.config.data_dir / "profiles",
            self.config.data_dir / "temp",
        ]
        for d in directories:
            Path(d).mkdir(parents=True, exist_ok=True)

    def _setup_system_event_handlers(self):
        """Register handlers for system-level events."""
        self.event_bus.subscribe(
            "system.*",
            self._handle_system_event,
            subscriber_id="nexus_engine",
        )
        self.event_bus.subscribe(
            "agent.error",
            self._handle_agent_error,
            subscriber_id="nexus_engine",
        )

    async def _handle_system_event(self, event: Event):
        """Handle system-level events."""
        nexus_logger.log_activity(
            activity_type="SYSTEM_EVENT",
            description=f"System event: {event.event_type}",
            metadata=event.data,
        )

    async def _handle_agent_error(self, event: Event):
        """Handle agent error events."""
        agent_name = event.data.get("agent_name", "unknown")
        error = event.data.get("error", "unknown error")
        logger.error(f"Agent error from {agent_name}: {error}")
        nexus_logger.log_agent_action(
            agent_name=agent_name,
            action="error",
            output_data=str(error),
            status="error",
        )

    def _log_system_info(self):
        """Log system information at startup."""
        info = self.system_info
        logger.info(f"Platform: {info.get('platform', 'unknown')} {info.get('platform_version', '')}")
        logger.info(f"Architecture: {info.get('architecture', 'unknown')}")
        logger.info(f"CPU: {info.get('processor', 'unknown')} ({info.get('cpu_count', 'N/A')} cores)")
        logger.info(f"RAM: {info.get('memory_total_gb', 'N/A')} GB total, "
                     f"{info.get('memory_available_gb', 'N/A')} GB available")

        if self.gpu_info.get("available"):
            for gpu in self.gpu_info.get("gpus", []):
                logger.info(f"GPU: {gpu['name']} ({gpu['memory_total_mb']} MB)")
        elif self.gpu_info.get("cuda_available"):
            logger.info(f"CUDA GPU: {self.gpu_info.get('cuda_device_name', 'unknown')}")
        else:
            logger.info("GPU: No GPU detected (CPU-only mode)")

    def _log_init(self, component: str, status: str):
        """Log initialization step."""
        entry = {
            "component": component,
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self._initialization_log.append(entry)
        logger.info(f"  ✓ {component}: {status}")

    def register_agent(self, name: str, agent: Any):
        """Register an agent with the engine."""
        self._agents[name] = agent
        logger.info(f"Agent registered: {name}")

    def get_agent(self, name: str) -> Optional[Any]:
        """Get a registered agent by name."""
        return self._agents.get(name)

    def register_service(self, name: str, service: Any):
        """Register a service with the engine."""
        self._services[name] = service
        logger.info(f"Service registered: {name}")

    def get_service(self, name: str) -> Optional[Any]:
        """Get a registered service by name."""
        return self._services.get(name)

    def get_status(self) -> Dict[str, Any]:
        """Get engine status information."""
        uptime = time.time() - self._start_time if self._start_time else 0
        return {
            "app_name": self.config.app_name,
            "version": self.config.version,
            "environment": self.config.env,
            "started": self._started,
            "uptime_seconds": round(uptime, 2),
            "agents_registered": len(self._agents),
            "services_registered": len(self._services),
            "active_tasks": len(self._tasks),
            "event_bus_stats": self.event_bus.get_stats(),
            "system_info": self.system_info,
            "gpu_info": self.gpu_info,
            "security_status": self.security.get_security_status(),
            "initialization_log": self._initialization_log,
        }

    def get_health(self) -> Dict[str, Any]:
        """Get health check information."""
        try:
            import psutil
            cpu = psutil.cpu_percent(interval=0.1)
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage("/")

            return {
                "status": "healthy" if self._started else "starting",
                "cpu_percent": cpu,
                "memory_percent": mem.percent,
                "disk_percent": disk.percent,
                "agents_healthy": all(
                    getattr(a, "is_healthy", lambda: True)()
                    for a in self._agents.values()
                ),
                "timestamp": datetime.utcnow().isoformat(),
            }
        except ImportError:
            return {
                "status": "healthy" if self._started else "starting",
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def shutdown(self):
        """Gracefully shutdown all components."""
        logger.info("NEXUS AI shutting down...")

        # Cancel all tasks
        for task in self._tasks:
            task.cancel()

        # Stop agents
        for name, agent in self._agents.items():
            try:
                if hasattr(agent, "stop"):
                    await agent.stop()
                logger.info(f"Agent stopped: {name}")
            except Exception as e:
                logger.error(f"Error stopping agent {name}: {e}")

        # Stop services
        for name, service in self._services.items():
            try:
                if hasattr(service, "stop"):
                    await service.stop()
                logger.info(f"Service stopped: {name}")
            except Exception as e:
                logger.error(f"Error stopping service {name}: {e}")

        # Stop event bus
        await self.event_bus.stop()

        self._started = False
        logger.info("NEXUS AI shutdown complete")


# Global engine instance
engine = NexusEngine()
