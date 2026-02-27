# NEXUS AI - Event Bus System
"""
Asynchronous event bus for inter-agent communication and system events.
Implements publish-subscribe pattern for loose coupling between components.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger


class EventPriority(Enum):
    """Event priority levels."""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3
    EMERGENCY = 4


class EventCategory(Enum):
    """Event categories for filtering."""
    SYSTEM = "system"
    AGENT = "agent"
    USER = "user"
    HOME = "home"
    VOICE = "voice"
    FINANCIAL = "financial"
    HEALTH = "health"
    COMMUNICATION = "communication"
    SECURITY = "security"
    TRAINING = "training"
    AUTOMATION = "automation"
    NOTIFICATION = "notification"


@dataclass
class Event:
    """
    Represents a system event with metadata.
    """
    event_type: str
    data: Dict[str, Any]
    category: EventCategory = EventCategory.SYSTEM
    priority: EventPriority = EventPriority.NORMAL
    source: str = "system"
    target: Optional[str] = None
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    processed: bool = False
    response: Optional[Any] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize event to dictionary."""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "category": self.category.value,
            "priority": self.priority.value,
            "source": self.source,
            "target": self.target,
            "data": self.data,
            "timestamp": self.timestamp.isoformat(),
            "processed": self.processed,
        }


class EventSubscription:
    """Represents a subscription to events."""

    def __init__(self, subscriber_id: str, event_type: str,
                 callback: Callable, priority_filter: Optional[EventPriority] = None,
                 category_filter: Optional[EventCategory] = None):
        self.subscriber_id = subscriber_id
        self.event_type = event_type
        self.callback = callback
        self.priority_filter = priority_filter
        self.category_filter = category_filter
        self.subscription_id = str(uuid.uuid4())
        self.created_at = datetime.utcnow()
        self.call_count = 0
        self.active = True


class EventBus:
    """
    Asynchronous event bus for NEXUS AI.

    Features:
    - Publish/subscribe pattern
    - Event filtering by type, category, and priority
    - Event history and replay
    - Dead letter queue for failed events
    - Event middleware support
    """

    def __init__(self, max_history: int = 10000):
        self._subscriptions: Dict[str, List[EventSubscription]] = {}
        self._wildcard_subscriptions: List[EventSubscription] = []
        self._event_history: List[Event] = []
        self._dead_letter_queue: List[Event] = []
        self._middleware: List[Callable] = []
        self._max_history = max_history
        self._lock = asyncio.Lock()
        self._running = False
        self._event_queue: asyncio.Queue = asyncio.Queue()
        self._stats = {
            "events_published": 0,
            "events_processed": 0,
            "events_failed": 0,
            "active_subscriptions": 0,
        }
        logger.info("EventBus initialized")

    async def start(self):
        """Start the event bus processing loop."""
        self._running = True
        asyncio.create_task(self._process_queue())
        logger.info("EventBus started")

    async def stop(self):
        """Stop the event bus."""
        self._running = False
        logger.info("EventBus stopped")

    def subscribe(self, event_type: str, callback: Callable,
                  subscriber_id: str = "anonymous",
                  priority_filter: Optional[EventPriority] = None,
                  category_filter: Optional[EventCategory] = None) -> str:
        """
        Subscribe to events of a specific type.

        Args:
            event_type: Event type to listen for ("*" for all events)
            callback: Async function to call when event occurs
            subscriber_id: Identifier for the subscriber
            priority_filter: Only receive events of this priority or higher
            category_filter: Only receive events of this category

        Returns:
            Subscription ID for later unsubscription
        """
        subscription = EventSubscription(
            subscriber_id=subscriber_id,
            event_type=event_type,
            callback=callback,
            priority_filter=priority_filter,
            category_filter=category_filter,
        )

        if event_type == "*":
            self._wildcard_subscriptions.append(subscription)
        else:
            if event_type not in self._subscriptions:
                self._subscriptions[event_type] = []
            self._subscriptions[event_type].append(subscription)

        self._stats["active_subscriptions"] += 1
        logger.debug(f"New subscription: {subscriber_id} -> {event_type} (ID: {subscription.subscription_id})")
        return subscription.subscription_id

    def unsubscribe(self, subscription_id: str) -> bool:
        """
        Remove a subscription by ID.

        Returns:
            True if subscription was found and removed
        """
        # Check wildcard subscriptions
        for i, sub in enumerate(self._wildcard_subscriptions):
            if sub.subscription_id == subscription_id:
                self._wildcard_subscriptions.pop(i)
                self._stats["active_subscriptions"] -= 1
                return True

        # Check typed subscriptions
        for event_type, subs in self._subscriptions.items():
            for i, sub in enumerate(subs):
                if sub.subscription_id == subscription_id:
                    subs.pop(i)
                    self._stats["active_subscriptions"] -= 1
                    return True

        return False

    async def publish(self, event: Event):
        """
        Publish an event to the bus.

        Args:
            event: Event to publish
        """
        # Run middleware
        for middleware in self._middleware:
            try:
                event = await middleware(event)
                if event is None:
                    return  # Middleware cancelled the event
            except Exception as e:
                logger.error(f"Middleware error: {e}")

        await self._event_queue.put(event)
        self._stats["events_published"] += 1

    async def emit(self, event_type: str, data: Dict[str, Any],
                   source: str = "system",
                   category: EventCategory = EventCategory.SYSTEM,
                   priority: EventPriority = EventPriority.NORMAL,
                   target: Optional[str] = None) -> Event:
        """
        Convenience method to create and publish an event.

        Returns:
            The created event
        """
        event = Event(
            event_type=event_type,
            data=data,
            source=source,
            category=category,
            priority=priority,
            target=target,
        )
        await self.publish(event)
        return event

    def add_middleware(self, middleware: Callable):
        """Add middleware function that processes events before delivery."""
        self._middleware.append(middleware)

    async def _process_queue(self):
        """Main event processing loop."""
        while self._running:
            try:
                event = await asyncio.wait_for(self._event_queue.get(), timeout=1.0)
                await self._dispatch_event(event)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Event processing error: {e}")

    async def _dispatch_event(self, event: Event):
        """Dispatch an event to all matching subscribers."""
        subscribers = []

        # Get type-specific subscribers
        if event.event_type in self._subscriptions:
            subscribers.extend(self._subscriptions[event.event_type])

        # Add wildcard subscribers
        subscribers.extend(self._wildcard_subscriptions)

        if not subscribers:
            logger.debug(f"No subscribers for event: {event.event_type}")

        for sub in subscribers:
            if not sub.active:
                continue

            # Apply filters
            if sub.priority_filter and event.priority.value < sub.priority_filter.value:
                continue
            if sub.category_filter and event.category != sub.category_filter:
                continue
            if event.target and event.target != sub.subscriber_id:
                continue

            try:
                if asyncio.iscoroutinefunction(sub.callback):
                    await sub.callback(event)
                else:
                    sub.callback(event)
                sub.call_count += 1
                self._stats["events_processed"] += 1
            except Exception as e:
                logger.error(f"Error in event handler {sub.subscriber_id}: {e}")
                event.error = str(e)
                self._dead_letter_queue.append(event)
                self._stats["events_failed"] += 1

        event.processed = True
        self._add_to_history(event)

    def _add_to_history(self, event: Event):
        """Add event to history with size limit."""
        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history = self._event_history[-self._max_history:]

    def get_history(self, event_type: Optional[str] = None,
                    category: Optional[EventCategory] = None,
                    limit: int = 100) -> List[Event]:
        """Get event history with optional filtering."""
        events = self._event_history

        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if category:
            events = [e for e in events if e.category == category]

        return events[-limit:]

    def get_dead_letters(self, limit: int = 100) -> List[Event]:
        """Get failed events from the dead letter queue."""
        return self._dead_letter_queue[-limit:]

    def get_stats(self) -> Dict[str, Any]:
        """Get event bus statistics."""
        return {
            **self._stats,
            "history_size": len(self._event_history),
            "dead_letters": len(self._dead_letter_queue),
            "queue_size": self._event_queue.qsize(),
            "subscription_types": len(self._subscriptions),
        }


# Global event bus instance
event_bus = EventBus()
