"""
Message Queue Monitoring Service for Nexus AI
Monitor and manage message queues, consumers, and dead letter processing
"""

import asyncio
import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional


class QueueType(str, Enum):
    STANDARD = "standard"
    FIFO = "fifo"
    PRIORITY = "priority"
    DEAD_LETTER = "dead_letter"
    DELAY = "delay"


class QueueStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    DRAINING = "draining"
    ERROR = "error"
    IDLE = "idle"


class MessageStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD_LETTERED = "dead_lettered"
    EXPIRED = "expired"


class BrokerType(str, Enum):
    RABBITMQ = "rabbitmq"
    REDIS = "redis"
    KAFKA = "kafka"
    SQS = "sqs"
    NATS = "nats"


@dataclass
class QueueMessage:
    id: str
    queue_name: str
    body: str
    status: MessageStatus = MessageStatus.PENDING
    priority: int = 0
    attempt: int = 1
    max_attempts: int = 3
    headers: Dict[str, str] = field(default_factory=dict)
    correlation_id: str = ""
    reply_to: str = ""
    created_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    error_message: str = ""
    ttl_seconds: int = 0
    delay_seconds: int = 0
    size_bytes: int = 0

    def to_dict(self) -> Dict:
        d = asdict(self)
        for k in ["created_at", "processed_at"]:
            if d[k] and isinstance(d[k], datetime):
                d[k] = d[k].isoformat()
        return d


@dataclass
class QueueConsumer:
    id: str
    queue_name: str
    tag: str
    prefetch_count: int = 10
    messages_processed: int = 0
    messages_failed: int = 0
    avg_processing_ms: float = 0.0
    connected_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None
    ip_address: str = ""
    is_active: bool = True

    def to_dict(self) -> Dict:
        d = asdict(self)
        for k in ["connected_at", "last_activity"]:
            if d[k] and isinstance(d[k], datetime):
                d[k] = d[k].isoformat()
        return d


@dataclass
class Queue:
    name: str
    queue_type: QueueType = QueueType.STANDARD
    status: QueueStatus = QueueStatus.ACTIVE
    broker: BrokerType = BrokerType.RABBITMQ
    messages_ready: int = 0
    messages_unacked: int = 0
    messages_total: int = 0
    consumers_count: int = 0
    message_rate_in: float = 0.0
    message_rate_out: float = 0.0
    avg_processing_ms: float = 0.0
    dead_letter_queue: str = ""
    max_length: int = 0
    max_length_bytes: int = 0
    ttl_seconds: int = 0
    durable: bool = True
    auto_delete: bool = False
    exclusive: bool = False
    vhost: str = "/"
    memory_bytes: int = 0
    created_at: Optional[datetime] = None
    idle_since: Optional[datetime] = None
    arguments: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        d = asdict(self)
        for k in ["created_at", "idle_since"]:
            if d[k] and isinstance(d[k], datetime):
                d[k] = d[k].isoformat()
        return d


@dataclass
class Exchange:
    name: str
    exchange_type: str = "direct"
    durable: bool = True
    auto_delete: bool = False
    internal: bool = False
    bindings: List[Dict[str, str]] = field(default_factory=list)
    message_rate_in: float = 0.0
    vhost: str = "/"

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class QueueBinding:
    source: str
    destination: str
    routing_key: str
    destination_type: str = "queue"
    arguments: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return asdict(self)


class QueueMonitorService:
    """Comprehensive message queue monitoring and management"""

    def __init__(self):
        self.queues: Dict[str, Queue] = {}
        self.consumers: Dict[str, List[QueueConsumer]] = {}
        self.messages: Dict[str, List[QueueMessage]] = {}
        self.exchanges: Dict[str, Exchange] = {}
        self.bindings: List[QueueBinding] = []
        self._event_handlers: Dict[str, List] = {}
        self._initialized = False

    async def initialize(self):
        if self._initialized:
            return
        await self._create_sample_data()
        self._initialized = True

    async def _create_sample_data(self):
        now = datetime.now()

        queues = [
            Queue(
                name="task.process", queue_type=QueueType.PRIORITY,
                status=QueueStatus.ACTIVE, broker=BrokerType.RABBITMQ,
                messages_ready=42, messages_unacked=8, messages_total=1247850,
                consumers_count=4, message_rate_in=12.5, message_rate_out=11.8,
                avg_processing_ms=245.3, dead_letter_queue="task.dlq",
                max_length=100000, ttl_seconds=86400, memory_bytes=15728640,
                created_at=now - timedelta(days=90),
            ),
            Queue(
                name="notification.send", queue_type=QueueType.STANDARD,
                status=QueueStatus.ACTIVE, broker=BrokerType.RABBITMQ,
                messages_ready=156, messages_unacked=12, messages_total=892340,
                consumers_count=2, message_rate_in=8.3, message_rate_out=7.1,
                avg_processing_ms=89.6, dead_letter_queue="notification.dlq",
                max_length=50000, memory_bytes=8388608,
                created_at=now - timedelta(days=90),
            ),
            Queue(
                name="ai.inference", queue_type=QueueType.PRIORITY,
                status=QueueStatus.ACTIVE, broker=BrokerType.RABBITMQ,
                messages_ready=5, messages_unacked=3, messages_total=456789,
                consumers_count=2, message_rate_in=2.1, message_rate_out=2.0,
                avg_processing_ms=3450.0, dead_letter_queue="ai.dlq",
                memory_bytes=4194304,
                created_at=now - timedelta(days=60),
            ),
            Queue(
                name="email.outbound", queue_type=QueueType.FIFO,
                status=QueueStatus.ACTIVE, broker=BrokerType.RABBITMQ,
                messages_ready=23, messages_unacked=2, messages_total=234567,
                consumers_count=1, message_rate_in=3.4, message_rate_out=3.2,
                avg_processing_ms=1200.0, dead_letter_queue="email.dlq",
                memory_bytes=2097152,
                created_at=now - timedelta(days=90),
            ),
            Queue(
                name="analytics.events", queue_type=QueueType.STANDARD,
                status=QueueStatus.ACTIVE, broker=BrokerType.KAFKA,
                messages_ready=0, messages_unacked=0, messages_total=15678900,
                consumers_count=3, message_rate_in=45.2, message_rate_out=45.2,
                avg_processing_ms=12.5, memory_bytes=67108864,
                created_at=now - timedelta(days=180),
            ),
            Queue(
                name="webhook.delivery", queue_type=QueueType.DELAY,
                status=QueueStatus.ACTIVE, broker=BrokerType.RABBITMQ,
                messages_ready=8, messages_unacked=1, messages_total=567890,
                consumers_count=2, message_rate_in=4.7, message_rate_out=4.5,
                avg_processing_ms=890.0, dead_letter_queue="webhook.dlq",
                memory_bytes=3145728,
                created_at=now - timedelta(days=45),
            ),
            Queue(
                name="task.dlq", queue_type=QueueType.DEAD_LETTER,
                status=QueueStatus.IDLE, broker=BrokerType.RABBITMQ,
                messages_ready=23, messages_total=1245,
                consumers_count=0, memory_bytes=262144,
                created_at=now - timedelta(days=90),
                idle_since=now - timedelta(hours=2),
            ),
            Queue(
                name="notification.dlq", queue_type=QueueType.DEAD_LETTER,
                status=QueueStatus.IDLE, broker=BrokerType.RABBITMQ,
                messages_ready=7, messages_total=456,
                consumers_count=0, memory_bytes=131072,
                created_at=now - timedelta(days=90),
                idle_since=now - timedelta(hours=6),
            ),
            Queue(
                name="scheduled.jobs", queue_type=QueueType.DELAY,
                status=QueueStatus.ACTIVE, broker=BrokerType.REDIS,
                messages_ready=15, messages_unacked=0, messages_total=89012,
                consumers_count=1, message_rate_in=0.5, message_rate_out=0.5,
                avg_processing_ms=450.0, memory_bytes=1048576,
                created_at=now - timedelta(days=60),
            ),
        ]
        for q in queues:
            self.queues[q.name] = q

        # Exchanges
        exchanges = [
            Exchange(name="nexus.direct", exchange_type="direct", bindings=[
                {"queue": "task.process", "routing_key": "task.new"},
                {"queue": "notification.send", "routing_key": "notify"},
            ]),
            Exchange(name="nexus.topic", exchange_type="topic", bindings=[
                {"queue": "analytics.events", "routing_key": "events.#"},
                {"queue": "ai.inference", "routing_key": "ai.*"},
            ]),
            Exchange(name="nexus.fanout", exchange_type="fanout", bindings=[
                {"queue": "notification.send", "routing_key": ""},
                {"queue": "webhook.delivery", "routing_key": ""},
            ]),
            Exchange(name="nexus.dlx", exchange_type="direct", bindings=[
                {"queue": "task.dlq", "routing_key": "task.dlq"},
                {"queue": "notification.dlq", "routing_key": "notification.dlq"},
            ]),
        ]
        for ex in exchanges:
            self.exchanges[ex.name] = ex

        # Consumers
        for q in queues:
            if q.consumers_count > 0:
                self.consumers[q.name] = [
                    QueueConsumer(
                        id=f"consumer-{q.name}-{i}",
                        queue_name=q.name,
                        tag=f"{q.name}-worker-{i}",
                        prefetch_count=10,
                        messages_processed=q.messages_total // q.consumers_count,
                        messages_failed=q.messages_total // q.consumers_count // 100,
                        avg_processing_ms=q.avg_processing_ms,
                        connected_at=now - timedelta(hours=24 - i * 3),
                        last_activity=now - timedelta(seconds=i * 5),
                        ip_address=f"172.20.0.{20 + i}",
                    )
                    for i in range(q.consumers_count)
                ]

        # Sample messages in DLQ
        for i in range(5):
            msg = QueueMessage(
                id=f"msg-dlq-{i}", queue_name="task.dlq",
                body=f'{{"task_id": "task-{1000+i}", "action": "process", "payload": {{}}}}',
                status=MessageStatus.DEAD_LETTERED, attempt=3, max_attempts=3,
                created_at=now - timedelta(hours=i * 4),
                error_message=f"Error: {'Timeout' if i % 2 == 0 else 'Connection refused'} after 3 attempts",
                headers={"x-death-count": str(3), "x-first-death-reason": "rejected"},
                size_bytes=256 + i * 50,
            )
            if "task.dlq" not in self.messages:
                self.messages["task.dlq"] = []
            self.messages["task.dlq"].append(msg)

    # Queue Operations
    async def list_queues(self, status: Optional[QueueStatus] = None,
                          broker: Optional[BrokerType] = None,
                          queue_type: Optional[QueueType] = None) -> List[Dict]:
        result = list(self.queues.values())
        if status:
            result = [q for q in result if q.status == status]
        if broker:
            result = [q for q in result if q.broker == broker]
        if queue_type:
            result = [q for q in result if q.queue_type == queue_type]
        return [q.to_dict() for q in result]

    async def get_queue(self, name: str) -> Optional[Dict]:
        q = self.queues.get(name)
        return q.to_dict() if q else None

    async def create_queue(self, name: str, queue_type: QueueType = QueueType.STANDARD,
                           broker: BrokerType = BrokerType.RABBITMQ,
                           max_length: int = 0, ttl_seconds: int = 0,
                           dead_letter_queue: str = "",
                           durable: bool = True) -> Dict:
        queue = Queue(
            name=name, queue_type=queue_type, broker=broker,
            max_length=max_length, ttl_seconds=ttl_seconds,
            dead_letter_queue=dead_letter_queue, durable=durable,
            created_at=datetime.now(),
        )
        self.queues[name] = queue
        return queue.to_dict()

    async def delete_queue(self, name: str) -> bool:
        if name in self.queues:
            del self.queues[name]
            self.consumers.pop(name, None)
            self.messages.pop(name, None)
            return True
        return False

    async def purge_queue(self, name: str) -> Dict:
        q = self.queues.get(name)
        if q:
            purged = q.messages_ready
            q.messages_ready = 0
            self.messages.pop(name, None)
            return {"purged": purged, "queue": name}
        return {"error": "Queue not found"}

    async def pause_queue(self, name: str) -> bool:
        q = self.queues.get(name)
        if q:
            q.status = QueueStatus.PAUSED
            return True
        return False

    async def resume_queue(self, name: str) -> bool:
        q = self.queues.get(name)
        if q and q.status == QueueStatus.PAUSED:
            q.status = QueueStatus.ACTIVE
            return True
        return False

    # Consumer Operations
    async def list_consumers(self, queue_name: Optional[str] = None) -> List[Dict]:
        if queue_name:
            consumers = self.consumers.get(queue_name, [])
        else:
            consumers = [c for cl in self.consumers.values() for c in cl]
        return [c.to_dict() for c in consumers]

    async def disconnect_consumer(self, consumer_id: str) -> bool:
        for queue_name, consumers in self.consumers.items():
            for c in consumers:
                if c.id == consumer_id:
                    c.is_active = False
                    self.consumers[queue_name] = [x for x in consumers if x.id != consumer_id]
                    q = self.queues.get(queue_name)
                    if q:
                        q.consumers_count = max(0, q.consumers_count - 1)
                    return True
        return False

    # Message Operations
    async def list_messages(self, queue_name: str, status: Optional[MessageStatus] = None,
                            limit: int = 50) -> List[Dict]:
        messages = self.messages.get(queue_name, [])
        if status:
            messages = [m for m in messages if m.status == status]
        return [m.to_dict() for m in messages[:limit]]

    async def publish_message(self, queue_name: str, body: str,
                              priority: int = 0, headers: Dict[str, str] = None,
                              delay_seconds: int = 0) -> Dict:
        msg = QueueMessage(
            id=f"msg-{hashlib.md5(f'{queue_name}-{datetime.now()}'.encode()).hexdigest()[:8]}",
            queue_name=queue_name, body=body, priority=priority,
            headers=headers or {}, delay_seconds=delay_seconds,
            created_at=datetime.now(), size_bytes=len(body.encode()),
        )
        if queue_name not in self.messages:
            self.messages[queue_name] = []
        self.messages[queue_name].append(msg)
        q = self.queues.get(queue_name)
        if q:
            q.messages_ready += 1
            q.messages_total += 1
        return msg.to_dict()

    async def retry_message(self, queue_name: str, message_id: str) -> Optional[Dict]:
        messages = self.messages.get(queue_name, [])
        msg = next((m for m in messages if m.id == message_id), None)
        if msg:
            msg.status = MessageStatus.PENDING
            msg.attempt += 1
            msg.error_message = ""
            # Move back to original queue if in DLQ
            original_queue = queue_name.replace(".dlq", ".process")
            if original_queue in self.queues:
                if original_queue not in self.messages:
                    self.messages[original_queue] = []
                self.messages[original_queue].append(msg)
                self.messages[queue_name] = [m for m in messages if m.id != message_id]
                q = self.queues.get(original_queue)
                if q:
                    q.messages_ready += 1
                dlq = self.queues.get(queue_name)
                if dlq:
                    dlq.messages_ready = max(0, dlq.messages_ready - 1)
            return msg.to_dict()
        return None

    async def delete_message(self, queue_name: str, message_id: str) -> bool:
        messages = self.messages.get(queue_name, [])
        msg = next((m for m in messages if m.id == message_id), None)
        if msg:
            self.messages[queue_name] = [m for m in messages if m.id != message_id]
            q = self.queues.get(queue_name)
            if q:
                q.messages_ready = max(0, q.messages_ready - 1)
            return True
        return False

    # Exchange Operations
    async def list_exchanges(self) -> List[Dict]:
        return [ex.to_dict() for ex in self.exchanges.values()]

    async def get_exchange(self, name: str) -> Optional[Dict]:
        ex = self.exchanges.get(name)
        return ex.to_dict() if ex else None

    # Analytics & Dashboard
    async def get_dashboard(self) -> Dict:
        total_messages = sum(q.messages_ready + q.messages_unacked for q in self.queues.values())
        total_rate_in = sum(q.message_rate_in for q in self.queues.values())
        total_rate_out = sum(q.message_rate_out for q in self.queues.values())
        dlq_messages = sum(q.messages_ready for q in self.queues.values()
                           if q.queue_type == QueueType.DEAD_LETTER)
        total_consumers = sum(q.consumers_count for q in self.queues.values())
        total_memory = sum(q.memory_bytes for q in self.queues.values())

        return {
            "queues": {
                "total": len(self.queues),
                "active": len([q for q in self.queues.values() if q.status == QueueStatus.ACTIVE]),
                "paused": len([q for q in self.queues.values() if q.status == QueueStatus.PAUSED]),
                "idle": len([q for q in self.queues.values() if q.status == QueueStatus.IDLE]),
            },
            "messages": {
                "total_pending": total_messages,
                "dead_lettered": dlq_messages,
                "rate_in_per_sec": round(total_rate_in, 1),
                "rate_out_per_sec": round(total_rate_out, 1),
            },
            "consumers": {
                "total": total_consumers,
                "avg_processing_ms": round(
                    sum(q.avg_processing_ms * q.consumers_count for q in self.queues.values()
                        if q.consumers_count > 0) / max(1, total_consumers), 1
                ),
            },
            "memory_bytes": total_memory,
            "memory_mb": round(total_memory / 1024 / 1024, 1),
            "exchanges": len(self.exchanges),
            "brokers": list(set(q.broker.value for q in self.queues.values())),
        }

    async def get_queue_metrics(self, queue_name: str) -> List[Dict]:
        """Get time-series metrics for a queue"""
        q = self.queues.get(queue_name)
        if not q:
            return []
        now = datetime.now()
        metrics = []
        for i in range(24):
            ts = now - timedelta(hours=23 - i)
            base_ready = max(0, q.messages_ready + (i - 12) * 5)
            metrics.append({
                "timestamp": ts.isoformat(),
                "messages_ready": base_ready + (i * 7) % 20,
                "messages_unacked": max(0, q.messages_unacked + (i * 3) % 8 - 4),
                "rate_in": round(q.message_rate_in * (0.5 + (i % 6) * 0.2), 1),
                "rate_out": round(q.message_rate_out * (0.5 + (i % 5) * 0.25), 1),
                "consumer_count": q.consumers_count,
            })
        return metrics

    async def get_summary(self) -> Dict:
        return {
            "total_queues": len(self.queues),
            "total_exchanges": len(self.exchanges),
            "total_consumers": sum(len(c) for c in self.consumers.values()),
            "total_messages": sum(q.messages_ready for q in self.queues.values()),
            "dead_letter_messages": sum(q.messages_ready for q in self.queues.values()
                                        if q.queue_type == QueueType.DEAD_LETTER),
        }

    async def _emit_event(self, event_type: str, data: Any):
        handlers = self._event_handlers.get(event_type, [])
        for handler in handlers:
            try:
                await handler(data)
            except Exception:
                pass
