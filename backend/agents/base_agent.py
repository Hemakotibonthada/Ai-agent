# NEXUS AI - Base Agent Framework
"""
Abstract base class for all NEXUS AI agents.
Provides common functionality, lifecycle management, and communication patterns.
"""

import asyncio
import time
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field
from loguru import logger

from core.events import EventBus, Event, EventCategory, EventPriority, event_bus
from core.logger import nexus_logger


class AgentStatus(str, Enum):
    """Agent lifecycle states."""
    INITIALIZING = "initializing"
    IDLE = "idle"
    PROCESSING = "processing"
    LEARNING = "learning"
    ERROR = "error"
    STOPPED = "stopped"


class AgentCapability(str, Enum):
    """Standard agent capabilities."""
    CHAT = "chat"
    ANALYZE = "analyze"
    GENERATE = "generate"
    MONITOR = "monitor"
    AUTOMATE = "automate"
    LEARN = "learn"
    PREDICT = "predict"
    NOTIFY = "notify"
    REPORT = "report"
    CONTROL = "control"
    SEARCH = "search"
    SUMMARIZE = "summarize"


@dataclass
class AgentContext:
    """Context passed to agent for processing."""
    user_id: str = ""
    conversation_id: str = ""
    message: str = ""
    history: List[Dict[str, str]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    attachments: List[str] = field(default_factory=list)
    language: str = "en"
    timezone: str = "UTC"


@dataclass
class AgentResponse:
    """Standardized agent response."""
    content: str
    agent_name: str
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    actions: List[Dict[str, Any]] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    requires_followup: bool = False
    processing_time_ms: float = 0.0
    tokens_used: int = 0
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "content": self.content,
            "agent_name": self.agent_name,
            "confidence": self.confidence,
            "metadata": self.metadata,
            "actions": self.actions,
            "suggestions": self.suggestions,
            "requires_followup": self.requires_followup,
            "processing_time_ms": self.processing_time_ms,
            "tokens_used": self.tokens_used,
            "error": self.error,
        }


class BaseAgent(ABC):
    """
    Abstract base class for all NEXUS AI agents.
    
    Every agent inherits from this class and implements:
    - process(): Main message processing logic
    - get_system_prompt(): Agent-specific system prompt
    - get_capabilities(): List of agent capabilities
    
    Built-in features:
    - Event bus integration for inter-agent communication
    - Activity logging
    - Performance tracking
    - Error handling with retry logic
    - State management
    """

    def __init__(self, name: str, description: str,
                 event_bus_instance: EventBus = None):
        self.name = name
        self.description = description
        self.agent_id = str(uuid.uuid4())
        self.event_bus = event_bus_instance or event_bus

        # State
        self.status = AgentStatus.INITIALIZING
        self._created_at = datetime.utcnow()
        self._last_action_at: Optional[datetime] = None
        self._action_count = 0
        self._error_count = 0
        self._success_count = 0
        self._total_processing_time_ms = 0.0

        # Configuration
        self._config: Dict[str, Any] = {}
        self._max_retries = 3
        self._retry_delay = 1.0

        # Callbacks
        self._pre_process_hooks: List[Callable] = []
        self._post_process_hooks: List[Callable] = []

        logger.info(f"Agent created: {self.name} ({self.agent_id})")

    @abstractmethod
    async def process(self, context: AgentContext) -> AgentResponse:
        """
        Process a message/request and return a response.
        Must be implemented by all agent subclasses.
        """
        pass

    @abstractmethod
    def get_system_prompt(self) -> str:
        """
        Return the system prompt that defines this agent's personality and role.
        Must be implemented by all agent subclasses.
        """
        pass

    @abstractmethod
    def get_capabilities(self) -> List[AgentCapability]:
        """
        Return the list of capabilities this agent provides.
        Must be implemented by all agent subclasses.
        """
        pass

    async def initialize(self):
        """Initialize the agent (override for custom initialization)."""
        self.status = AgentStatus.IDLE
        await self._subscribe_to_events()
        logger.info(f"Agent initialized: {self.name}")

    async def stop(self):
        """Stop the agent gracefully."""
        self.status = AgentStatus.STOPPED
        logger.info(f"Agent stopped: {self.name}")

    async def handle_message(self, context: AgentContext) -> AgentResponse:
        """
        Main entry point for processing messages.
        Handles pre/post processing, logging, error handling, and retries.
        """
        start_time = time.time()
        self.status = AgentStatus.PROCESSING
        self._last_action_at = datetime.utcnow()
        self._action_count += 1

        try:
            # Run pre-process hooks
            for hook in self._pre_process_hooks:
                context = await hook(context) if asyncio.iscoroutinefunction(hook) else hook(context)

            # Process with retry logic
            response = await self._process_with_retry(context)

            # Calculate processing time
            elapsed_ms = (time.time() - start_time) * 1000
            response.processing_time_ms = elapsed_ms
            self._total_processing_time_ms += elapsed_ms

            # Run post-process hooks
            for hook in self._post_process_hooks:
                response = await hook(response) if asyncio.iscoroutinefunction(hook) else hook(response)

            # Log the action
            self._success_count += 1
            nexus_logger.log_agent_action(
                agent_name=self.name,
                action="process_message",
                input_data=context.message[:200],
                output_data=response.content[:200],
                duration_ms=elapsed_ms,
                status="success",
            )

            # Emit event
            await self.event_bus.emit(
                event_type="agent.action_completed",
                data={
                    "agent_name": self.name,
                    "action": "process_message",
                    "processing_time_ms": elapsed_ms,
                },
                category=EventCategory.AGENT,
                source=self.name,
            )

            self.status = AgentStatus.IDLE
            return response

        except Exception as e:
            self._error_count += 1
            elapsed_ms = (time.time() - start_time) * 1000
            logger.error(f"Agent {self.name} error: {e}")

            nexus_logger.log_agent_action(
                agent_name=self.name,
                action="process_message",
                input_data=context.message[:200],
                output_data=str(e),
                duration_ms=elapsed_ms,
                status="error",
            )

            self.status = AgentStatus.ERROR
            return AgentResponse(
                content=f"I encountered an error while processing your request. Please try again.",
                agent_name=self.name,
                confidence=0.0,
                error=str(e),
            )

    async def _process_with_retry(self, context: AgentContext) -> AgentResponse:
        """Process with retry logic."""
        last_error = None
        for attempt in range(self._max_retries):
            try:
                return await self.process(context)
            except Exception as e:
                last_error = e
                if attempt < self._max_retries - 1:
                    logger.warning(f"Agent {self.name} retry {attempt + 1}/{self._max_retries}: {e}")
                    await asyncio.sleep(self._retry_delay * (attempt + 1))

        raise last_error

    async def _subscribe_to_events(self):
        """Subscribe to relevant events."""
        # Subscribe to direct messages
        self.event_bus.subscribe(
            f"agent.message.{self.name}",
            self._handle_event_message,
            subscriber_id=self.name,
        )
        # Subscribe to broadcast messages
        self.event_bus.subscribe(
            "agent.broadcast",
            self._handle_broadcast,
            subscriber_id=self.name,
        )

    async def _handle_event_message(self, event: Event):
        """Handle a direct event message."""
        context = AgentContext(
            message=event.data.get("message", ""),
            user_id=event.data.get("user_id", ""),
            metadata=event.data.get("metadata", {}),
        )
        response = await self.handle_message(context)
        event.response = response

    async def _handle_broadcast(self, event: Event):
        """Handle a broadcast event (override for custom handling)."""
        pass

    async def send_to_agent(self, target_agent: str, message: str,
                             metadata: Dict[str, Any] = None) -> Event:
        """Send a message to another agent via the event bus."""
        return await self.event_bus.emit(
            event_type=f"agent.message.{target_agent}",
            data={
                "message": message,
                "metadata": metadata or {},
                "from_agent": self.name,
            },
            category=EventCategory.AGENT,
            source=self.name,
            target=target_agent,
        )

    async def notify_user(self, title: str, message: str,
                           notification_type: str = "info"):
        """Send a notification to the user."""
        await self.event_bus.emit(
            event_type="notification.create",
            data={
                "title": title,
                "message": message,
                "type": notification_type,
                "source_agent": self.name,
            },
            category=EventCategory.NOTIFICATION,
            source=self.name,
        )

    def add_pre_process_hook(self, hook: Callable):
        """Add a hook that runs before processing."""
        self._pre_process_hooks.append(hook)

    def add_post_process_hook(self, hook: Callable):
        """Add a hook that runs after processing."""
        self._post_process_hooks.append(hook)

    def configure(self, config: Dict[str, Any]):
        """Update agent configuration."""
        self._config.update(config)

    def is_healthy(self) -> bool:
        """Check if the agent is healthy."""
        return self.status not in (AgentStatus.ERROR, AgentStatus.STOPPED)

    def get_stats(self) -> Dict[str, Any]:
        """Get agent statistics."""
        return {
            "name": self.name,
            "agent_id": self.agent_id,
            "status": self.status.value,
            "description": self.description,
            "capabilities": [c.value for c in self.get_capabilities()],
            "action_count": self._action_count,
            "success_count": self._success_count,
            "error_count": self._error_count,
            "total_processing_time_ms": round(self._total_processing_time_ms, 2),
            "avg_processing_time_ms": round(
                self._total_processing_time_ms / max(self._action_count, 1), 2
            ),
            "created_at": self._created_at.isoformat(),
            "last_action_at": self._last_action_at.isoformat() if self._last_action_at else None,
        }

    def __repr__(self):
        return f"<Agent:{self.name} status={self.status.value} actions={self._action_count}>"
