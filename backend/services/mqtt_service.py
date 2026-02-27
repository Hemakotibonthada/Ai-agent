# NEXUS AI - MQTT Service
"""
MQTT client for ESP32 IoT communication, topic management, message routing,
device discovery, and sensor data ingestion for the NEXUS AI OS.
Uses paho-mqtt with full async integration.
"""

import asyncio
import json
import time
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from loguru import logger

from core.config import NexusSettings, settings
from core.events import Event, EventBus, EventCategory, EventPriority, event_bus
from core.logger import nexus_logger


class DeviceStatus(str, Enum):
    """IoT device connection status."""
    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"
    ERROR = "error"


class MQTTQoS(int, Enum):
    """MQTT Quality of Service levels."""
    AT_MOST_ONCE = 0
    AT_LEAST_ONCE = 1
    EXACTLY_ONCE = 2


class DiscoveredDevice:
    """Container for a discovered IoT device."""

    def __init__(
        self,
        device_id: str,
        device_type: str = "unknown",
        name: str = "",
        room: str = "",
        topics: Optional[List[str]] = None,
        capabilities: Optional[List[str]] = None,
        firmware_version: str = "",
    ):
        self.device_id: str = device_id
        self.device_type: str = device_type
        self.name: str = name or device_id
        self.room: str = room
        self.topics: List[str] = topics or []
        self.capabilities: List[str] = capabilities or []
        self.firmware_version: str = firmware_version
        self.status: DeviceStatus = DeviceStatus.UNKNOWN
        self.last_seen: Optional[datetime] = None
        self.last_message: Optional[Dict[str, Any]] = None
        self.message_count: int = 0
        self.error_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Serialize device to dictionary."""
        return {
            "device_id": self.device_id,
            "device_type": self.device_type,
            "name": self.name,
            "room": self.room,
            "topics": self.topics,
            "capabilities": self.capabilities,
            "firmware_version": self.firmware_version,
            "status": self.status.value,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "message_count": self.message_count,
            "error_count": self.error_count,
        }


class TopicSubscription:
    """Represents a subscription to an MQTT topic."""

    def __init__(self, topic: str, callback: Callable,
                 qos: MQTTQoS = MQTTQoS.AT_LEAST_ONCE, subscriber_id: str = ""):
        self.subscription_id: str = str(uuid.uuid4())
        self.topic: str = topic
        self.callback: Callable = callback
        self.qos: MQTTQoS = qos
        self.subscriber_id: str = subscriber_id or self.subscription_id
        self.created_at: datetime = datetime.utcnow()
        self.message_count: int = 0


class SensorReading:
    """Represents a normalized sensor data reading."""

    def __init__(self, device_id: str, sensor_type: str, value: float,
                 unit: str = "", timestamp: Optional[datetime] = None,
                 metadata: Optional[Dict[str, Any]] = None):
        self.reading_id: str = str(uuid.uuid4())
        self.device_id: str = device_id
        self.sensor_type: str = sensor_type
        self.value: float = value
        self.unit: str = unit
        self.timestamp: datetime = timestamp or datetime.utcnow()
        self.metadata: Dict[str, Any] = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        """Serialize reading to dictionary."""
        return {
            "reading_id": self.reading_id,
            "device_id": self.device_id,
            "sensor_type": self.sensor_type,
            "value": self.value,
            "unit": self.unit,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


class MQTTService:
    """
    MQTT client service for NEXUS AI home automation.

    Provides:
    - Paho MQTT client with async bridge
    - Topic subscription and message routing
    - ESP32 device discovery via announcement topics
    - Sensor data ingestion and normalization
    - Device command publishing
    - Connection management with auto-reconnect
    - Message buffering for offline devices
    - Event bus integration for real-time updates
    """

    def __init__(self, config: Optional[NexusSettings] = None,
                 event_bus_instance: Optional[EventBus] = None):
        self._config: NexusSettings = config or settings
        self._event_bus: EventBus = event_bus_instance or event_bus
        self._broker_host: str = self._config.mqtt.broker_host
        self._broker_port: int = self._config.mqtt.broker_port
        self._username: str = self._config.mqtt.username
        self._password: str = self._config.mqtt.password
        self._topic_prefix: str = self._config.mqtt.topic_prefix
        self._keepalive: int = self._config.mqtt.keepalive
        self._qos: int = self._config.mqtt.qos
        self._client: Any = None
        self._loop_task: Optional[asyncio.Task] = None
        self._initialized: bool = False
        self._connected: bool = False
        self._subscriptions: Dict[str, TopicSubscription] = {}
        self._topic_handlers: Dict[str, List[TopicSubscription]] = {}
        self._devices: Dict[str, DiscoveredDevice] = {}
        self._sensor_buffer: List[SensorReading] = []
        self._sensor_buffer_max: int = 1000
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self._messages_received: int = 0
        self._messages_sent: int = 0
        self._errors: int = 0
        self._reconnect_attempts: int = 0
        self._max_reconnect_attempts: int = 10
        self._reconnect_delay: float = 5.0
        self._offline_buffer: List[Tuple[str, str, int]] = []
        self._offline_buffer_max: int = 500

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize the MQTT client and connect to the broker."""
        try:
            logger.info("Initializing MQTTService...")
            import paho.mqtt.client as mqtt

            client_id = f"nexus_ai_{uuid.uuid4().hex[:8]}"
            self._client = mqtt.Client(
                client_id=client_id,
                protocol=mqtt.MQTTv5,
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            )
            self._client.username_pw_set(self._username, self._password)
            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message = self._on_message
            self._client.on_subscribe = self._on_subscribe

            self._client.will_set(
                f"{self._topic_prefix}/status",
                payload=json.dumps({"status": "offline", "agent": "nexus"}),
                qos=1,
                retain=True,
            )

            await self._connect()
            self._initialized = True

            await self._event_bus.emit(
                "mqtt.initialized",
                {"broker": self._broker_host, "port": self._broker_port},
                source="mqtt_service",
                category=EventCategory.HOME,
            )
            logger.info("MQTTService initialized")
        except Exception as exc:
            logger.error(f"MQTTService initialization failed: {exc}")
            self._initialized = True

    async def _connect(self) -> None:
        """Establish connection to the MQTT broker."""
        try:
            self._client.connect_async(
                self._broker_host,
                self._broker_port,
                keepalive=self._keepalive,
            )
            self._loop_task = asyncio.create_task(self._mqtt_loop())
            logger.info(f"Connecting to MQTT broker: {self._broker_host}:{self._broker_port}")
        except Exception as exc:
            logger.error(f"MQTT connection error: {exc}")
            self._errors += 1

    async def shutdown(self) -> None:
        """Disconnect from broker and clean up."""
        try:
            logger.info("Shutting down MQTTService...")
            if self._client and self._connected:
                self._publish_sync(
                    f"{self._topic_prefix}/status",
                    json.dumps({"status": "offline", "agent": "nexus"}),
                )
                self._client.disconnect()

            if self._loop_task and not self._loop_task.done():
                self._loop_task.cancel()
                try:
                    await self._loop_task
                except asyncio.CancelledError:
                    pass

            self._connected = False
            self._initialized = False
            logger.info("MQTTService shut down complete")
        except Exception as exc:
            logger.error(f"Error during MQTTService shutdown: {exc}")

    async def _mqtt_loop(self) -> None:
        """Run the paho-mqtt network loop in a background thread."""
        def _loop() -> None:
            try:
                self._client.loop_start()
            except Exception as exc:
                logger.error(f"MQTT loop error: {exc}")

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _loop)

        while self._initialized:
            await asyncio.sleep(1)
            if not self._connected and self._reconnect_attempts < self._max_reconnect_attempts:
                self._reconnect_attempts += 1
                logger.info(f"MQTT reconnect attempt {self._reconnect_attempts}")
                try:
                    self._client.reconnect()
                except Exception:
                    await asyncio.sleep(self._reconnect_delay)

    # ------------------------------------------------------------------
    # Paho Callbacks (run in paho's thread — must be lightweight)
    # ------------------------------------------------------------------

    def _on_connect(self, client: Any, userdata: Any, flags: Any,
                    rc: Any, properties: Any = None) -> None:
        """Handle successful MQTT connection."""
        self._connected = True
        self._reconnect_attempts = 0
        logger.info("MQTT connected to broker")

        self._subscribe_default_topics()

        self._publish_sync(
            f"{self._topic_prefix}/status",
            json.dumps({"status": "online", "agent": "nexus", "timestamp": datetime.utcnow().isoformat()}),
            retain=True,
        )

        self._flush_offline_buffer()

    def _on_disconnect(self, client: Any, userdata: Any, flags: Any = None,
                       rc: Any = None, properties: Any = None) -> None:
        """Handle MQTT disconnection."""
        self._connected = False
        logger.warning(f"MQTT disconnected (rc={rc})")

    def _on_message(self, client: Any, userdata: Any, msg: Any) -> None:
        """Handle incoming MQTT messages — routes to registered handlers."""
        self._messages_received += 1
        topic = msg.topic
        try:
            payload = msg.payload.decode("utf-8")
        except UnicodeDecodeError:
            payload = msg.payload.hex()

        try:
            data = json.loads(payload)
        except (json.JSONDecodeError, ValueError):
            data = {"raw": payload}

        for pattern, subs in self._topic_handlers.items():
            if self._topic_matches(pattern, topic):
                for sub in subs:
                    sub.message_count += 1
                    try:
                        sub.callback(topic, data)
                    except Exception as exc:
                        logger.error(f"MQTT handler error for {topic}: {exc}")
                        self._errors += 1

        if topic.startswith(f"{self._topic_prefix}/discovery"):
            self._handle_discovery(topic, data)
        elif "/sensor/" in topic:
            self._handle_sensor_data(topic, data)

    def _on_subscribe(self, client: Any, userdata: Any, mid: Any,
                      granted_qos: Any = None, properties: Any = None) -> None:
        """Handle subscription acknowledgement."""
        logger.debug(f"MQTT subscription confirmed (mid={mid})")

    # ------------------------------------------------------------------
    # Topic Management
    # ------------------------------------------------------------------

    def _subscribe_default_topics(self) -> None:
        """Subscribe to default NEXUS topics."""
        default_topics = [
            (f"{self._topic_prefix}/discovery/#", self._qos),
            (f"{self._topic_prefix}/sensor/#", self._qos),
            (f"{self._topic_prefix}/device/+/status", self._qos),
            (f"{self._topic_prefix}/device/+/response", self._qos),
            (f"{self._topic_prefix}/command/response/#", self._qos),
        ]
        for topic, qos in default_topics:
            self._client.subscribe(topic, qos)
            logger.debug(f"Subscribed to default topic: {topic}")

    def subscribe(self, topic: str, callback: Callable,
                  qos: MQTTQoS = MQTTQoS.AT_LEAST_ONCE,
                  subscriber_id: str = "") -> str:
        """
        Subscribe to an MQTT topic with a callback handler.

        Args:
            topic: MQTT topic pattern (supports + and # wildcards).
            callback: Function(topic: str, data: dict) called on message.
            qos: Quality of Service level.
            subscriber_id: Identifier for the subscriber.

        Returns:
            Subscription ID.
        """
        sub = TopicSubscription(topic, callback, qos, subscriber_id)
        self._subscriptions[sub.subscription_id] = sub

        if topic not in self._topic_handlers:
            self._topic_handlers[topic] = []
        self._topic_handlers[topic].append(sub)

        if self._connected and self._client:
            self._client.subscribe(topic, qos.value)

        logger.info(f"Subscribed to topic: {topic} (subscriber: {subscriber_id})")
        return sub.subscription_id

    def unsubscribe(self, subscription_id: str) -> bool:
        """
        Remove a topic subscription.

        Args:
            subscription_id: Subscription ID from subscribe().

        Returns:
            True if removed.
        """
        sub = self._subscriptions.pop(subscription_id, None)
        if not sub:
            return False

        if sub.topic in self._topic_handlers:
            self._topic_handlers[sub.topic] = [
                s for s in self._topic_handlers[sub.topic]
                if s.subscription_id != subscription_id
            ]
            if not self._topic_handlers[sub.topic]:
                del self._topic_handlers[sub.topic]
                if self._connected and self._client:
                    self._client.unsubscribe(sub.topic)

        logger.info(f"Unsubscribed: {sub.topic}")
        return True

    @staticmethod
    def _topic_matches(pattern: str, topic: str) -> bool:
        """Check if an MQTT topic matches a pattern with wildcards."""
        pattern_parts = pattern.split("/")
        topic_parts = topic.split("/")

        for i, part in enumerate(pattern_parts):
            if part == "#":
                return True
            if i >= len(topic_parts):
                return False
            if part == "+":
                continue
            if part != topic_parts[i]:
                return False

        return len(pattern_parts) == len(topic_parts)

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

    async def publish(self, topic: str, payload: Any,
                      qos: int = 1, retain: bool = False) -> bool:
        """
        Publish a message to an MQTT topic.

        Args:
            topic: Target topic.
            payload: Message payload (will be JSON-serialized if dict/list).
            qos: Quality of Service.
            retain: Whether the broker retains this message.

        Returns:
            True if published successfully.
        """
        if isinstance(payload, (dict, list)):
            payload_str = json.dumps(payload)
        else:
            payload_str = str(payload)

        if not self._connected:
            self._offline_buffer.append((topic, payload_str, qos))
            if len(self._offline_buffer) > self._offline_buffer_max:
                self._offline_buffer.pop(0)
            logger.warning(f"MQTT offline — message buffered for {topic}")
            return False

        try:
            result = self._client.publish(topic, payload_str, qos=qos, retain=retain)
            if result.rc == 0:
                self._messages_sent += 1
                return True
            else:
                logger.error(f"MQTT publish failed for {topic}: rc={result.rc}")
                self._errors += 1
                return False
        except Exception as exc:
            logger.error(f"MQTT publish error for {topic}: {exc}")
            self._errors += 1
            return False

    def _publish_sync(self, topic: str, payload: str,
                      qos: int = 1, retain: bool = False) -> None:
        """Synchronous publish for use in paho callbacks."""
        try:
            if self._client:
                self._client.publish(topic, payload, qos=qos, retain=retain)
                self._messages_sent += 1
        except Exception as exc:
            logger.error(f"Sync publish error: {exc}")

    def _flush_offline_buffer(self) -> None:
        """Send all buffered messages after reconnection."""
        if not self._offline_buffer:
            return
        flushed = 0
        for topic, payload, qos in self._offline_buffer:
            try:
                self._client.publish(topic, payload, qos=qos)
                flushed += 1
            except Exception as exc:
                logger.error(f"Failed to flush buffered message: {exc}")
        self._offline_buffer.clear()
        if flushed:
            logger.info(f"Flushed {flushed} buffered MQTT messages")

    # ------------------------------------------------------------------
    # Device Commands
    # ------------------------------------------------------------------

    async def send_device_command(
        self, device_id: str, command: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Send a command to a specific IoT device.

        Args:
            device_id: Target device identifier.
            command: Command name (e.g., 'turn_on', 'set_temperature').
            parameters: Optional command parameters.

        Returns:
            True if command was published.
        """
        topic = f"{self._topic_prefix}/device/{device_id}/command"
        payload = {
            "command": command,
            "parameters": parameters or {},
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(uuid.uuid4()),
        }
        success = await self.publish(topic, payload, qos=2)
        if success:
            nexus_logger.log_home_event(
                device_id, "command_sent",
                value=command,
                metadata=parameters,
            )
            await self._event_bus.emit(
                "mqtt.command_sent",
                {"device_id": device_id, "command": command, "parameters": parameters},
                source="mqtt_service",
                category=EventCategory.HOME,
            )
        return success

    async def broadcast_command(
        self, command: str, parameters: Optional[Dict[str, Any]] = None,
        room: Optional[str] = None,
    ) -> int:
        """
        Broadcast a command to all devices or devices in a specific room.

        Args:
            command: Command name.
            parameters: Command parameters.
            room: Optional room filter.

        Returns:
            Number of devices commanded.
        """
        count = 0
        for device_id, device in self._devices.items():
            if room and device.room != room:
                continue
            if device.status == DeviceStatus.ONLINE:
                success = await self.send_device_command(device_id, command, parameters)
                if success:
                    count += 1
        return count

    # ------------------------------------------------------------------
    # Device Discovery
    # ------------------------------------------------------------------

    def _handle_discovery(self, topic: str, data: Dict[str, Any]) -> None:
        """Process a device discovery announcement."""
        device_id = data.get("device_id", "")
        if not device_id:
            parts = topic.split("/")
            device_id = parts[-1] if parts else str(uuid.uuid4())

        if device_id in self._devices:
            device = self._devices[device_id]
            device.status = DeviceStatus.ONLINE
            device.last_seen = datetime.utcnow()
            device.firmware_version = data.get("firmware", device.firmware_version)
        else:
            device = DiscoveredDevice(
                device_id=device_id,
                device_type=data.get("type", "unknown"),
                name=data.get("name", device_id),
                room=data.get("room", ""),
                topics=data.get("topics", []),
                capabilities=data.get("capabilities", []),
                firmware_version=data.get("firmware", ""),
            )
            device.status = DeviceStatus.ONLINE
            device.last_seen = datetime.utcnow()
            self._devices[device_id] = device

            logger.info(f"New device discovered: {device.name} ({device.device_type}) in {device.room}")
            nexus_logger.log_home_event(device_id, "discovered", metadata=device.to_dict())

    def get_devices(self, room: Optional[str] = None,
                    device_type: Optional[str] = None,
                    status: Optional[DeviceStatus] = None) -> List[Dict[str, Any]]:
        """
        List discovered devices with optional filtering.

        Args:
            room: Filter by room name.
            device_type: Filter by device type.
            status: Filter by connection status.

        Returns:
            List of device dicts.
        """
        result: List[Dict[str, Any]] = []
        for device in self._devices.values():
            if room and device.room != room:
                continue
            if device_type and device.device_type != device_type:
                continue
            if status and device.status != status:
                continue
            result.append(device.to_dict())
        return result

    def get_device(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific device by ID."""
        device = self._devices.get(device_id)
        return device.to_dict() if device else None

    async def request_discovery(self) -> None:
        """Send a discovery request to all devices on the network."""
        await self.publish(
            f"{self._topic_prefix}/discovery/request",
            {"action": "announce", "timestamp": datetime.utcnow().isoformat()},
            qos=1,
        )
        logger.info("Device discovery request sent")

    async def check_device_health(self) -> Dict[str, Any]:
        """
        Check health of all known devices by marking stale ones as offline.

        Returns:
            Summary of online/offline/total counts.
        """
        cutoff = datetime.utcnow() - timedelta(minutes=5)
        online = 0
        offline = 0
        for device in self._devices.values():
            if device.last_seen and device.last_seen < cutoff:
                if device.status == DeviceStatus.ONLINE:
                    device.status = DeviceStatus.OFFLINE
                    logger.warning(f"Device went offline: {device.name}")
                offline += 1
            else:
                online += 1

        return {"total": len(self._devices), "online": online, "offline": offline}

    # ------------------------------------------------------------------
    # Sensor Data
    # ------------------------------------------------------------------

    def _handle_sensor_data(self, topic: str, data: Dict[str, Any]) -> None:
        """Ingest and normalize sensor data from a device."""
        parts = topic.split("/")
        device_id = ""
        sensor_type = ""
        for i, part in enumerate(parts):
            if part == "sensor" and i + 1 < len(parts):
                device_id = parts[i - 1] if i > 0 else ""
                sensor_type = parts[i + 1] if i + 1 < len(parts) else "unknown"
                break

        if not device_id:
            device_id = data.get("device_id", "unknown")
        if not sensor_type:
            sensor_type = data.get("sensor_type", data.get("type", "unknown"))

        value = data.get("value", 0.0)
        unit = data.get("unit", "")

        try:
            value = float(value)
        except (ValueError, TypeError):
            value = 0.0

        reading = SensorReading(
            device_id=device_id,
            sensor_type=sensor_type,
            value=value,
            unit=unit,
            metadata=data,
        )

        self._sensor_buffer.append(reading)
        if len(self._sensor_buffer) > self._sensor_buffer_max:
            self._sensor_buffer.pop(0)

        if device_id in self._devices:
            dev = self._devices[device_id]
            dev.last_seen = datetime.utcnow()
            dev.message_count += 1
            dev.last_message = data
            dev.status = DeviceStatus.ONLINE

        nexus_logger.log_home_event(
            device_id, f"sensor_{sensor_type}",
            value=value,
            metadata={"unit": unit},
        )

    def get_sensor_readings(
        self, device_id: Optional[str] = None,
        sensor_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve buffered sensor readings.

        Args:
            device_id: Filter by device.
            sensor_type: Filter by sensor type.
            limit: Maximum results.

        Returns:
            List of sensor reading dicts.
        """
        readings = list(self._sensor_buffer)
        if device_id:
            readings = [r for r in readings if r.device_id == device_id]
        if sensor_type:
            readings = [r for r in readings if r.sensor_type == sensor_type]
        readings.reverse()
        return [r.to_dict() for r in readings[:limit]]

    def get_latest_reading(self, device_id: str,
                           sensor_type: str) -> Optional[Dict[str, Any]]:
        """Get the most recent reading for a device and sensor type."""
        for r in reversed(self._sensor_buffer):
            if r.device_id == device_id and r.sensor_type == sensor_type:
                return r.to_dict()
        return None

    # ------------------------------------------------------------------
    # Health & Stats
    # ------------------------------------------------------------------

    async def health_check(self) -> Dict[str, Any]:
        """Return MQTT service health status."""
        device_health = await self.check_device_health()
        return {
            "service": "mqtt_service",
            "initialized": self._initialized,
            "connected": self._connected,
            "broker": f"{self._broker_host}:{self._broker_port}",
            "messages_received": self._messages_received,
            "messages_sent": self._messages_sent,
            "errors": self._errors,
            "devices": device_health,
            "subscriptions": len(self._subscriptions),
            "sensor_buffer_size": len(self._sensor_buffer),
            "offline_buffer_size": len(self._offline_buffer),
        }

    def get_stats(self) -> Dict[str, Any]:
        """Return runtime statistics."""
        return {
            "initialized": self._initialized,
            "connected": self._connected,
            "messages_received": self._messages_received,
            "messages_sent": self._messages_sent,
            "errors": self._errors,
            "devices_count": len(self._devices),
            "subscriptions_count": len(self._subscriptions),
            "sensor_readings_buffered": len(self._sensor_buffer),
            "offline_messages_buffered": len(self._offline_buffer),
            "reconnect_attempts": self._reconnect_attempts,
        }
