# NEXUS AI - WebSocket Handler
"""
WebSocket handler for real-time communication.
Supports multiple channels:
  /ws/chat       — Real-time AI chat
  /ws/home       — IoT device updates
  /ws/system     — System metrics streaming
  /ws/notifications — Live notifications

Includes connection management, room support, heartbeat, and reconnection logic.
"""

import asyncio
import json
import time
import uuid
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from loguru import logger

from core.events import event_bus, EventCategory


# ============================================================
# Connection Manager
# ============================================================

class WebSocketConnection:
    """Represents a single WebSocket connection with metadata."""

    def __init__(self, websocket: WebSocket, client_id: str, channel: str):
        self.websocket = websocket
        self.client_id = client_id
        self.channel = channel
        self.rooms: Set[str] = set()
        self.connected_at = datetime.utcnow()
        self.last_heartbeat = time.time()
        self.message_count = 0

    async def send_json(self, data: Dict[str, Any]):
        """Send JSON data to this connection."""
        try:
            await self.websocket.send_json(data)
            self.message_count += 1
        except Exception as e:
            logger.warning(f"WebSocket send error for {self.client_id}: {e}")
            raise

    async def send_text(self, text: str):
        """Send raw text to this connection."""
        try:
            await self.websocket.send_text(text)
            self.message_count += 1
        except Exception as e:
            logger.warning(f"WebSocket send error for {self.client_id}: {e}")
            raise


class ConnectionManager:
    """
    Manages all active WebSocket connections across channels.

    Features:
    - Channel-based organization (chat, home, system, notifications)
    - Room support for targeted broadcasting
    - Heartbeat monitoring
    - Automatic cleanup of stale connections
    """

    def __init__(self):
        self._connections: Dict[str, WebSocketConnection] = {}
        self._channels: Dict[str, Set[str]] = {}  # channel → set of client_ids
        self._rooms: Dict[str, Set[str]] = {}  # room → set of client_ids
        self._heartbeat_interval = 30  # seconds
        self._heartbeat_task: Optional[asyncio.Task] = None

    @property
    def total_connections(self) -> int:
        return len(self._connections)

    async def connect(self, websocket: WebSocket, channel: str, client_id: str = None) -> WebSocketConnection:
        """Accept a WebSocket connection and register it."""
        await websocket.accept()

        client_id = client_id or str(uuid.uuid4())
        conn = WebSocketConnection(websocket, client_id, channel)

        self._connections[client_id] = conn
        self._channels.setdefault(channel, set()).add(client_id)

        logger.info(f"WebSocket connected: {client_id} on channel '{channel}' "
                     f"(total: {self.total_connections})")

        # Send welcome message
        await conn.send_json({
            "type": "connection",
            "status": "connected",
            "client_id": client_id,
            "channel": channel,
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Start heartbeat if not running
        if self._heartbeat_task is None or self._heartbeat_task.done():
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        return conn

    async def disconnect(self, client_id: str):
        """Remove a WebSocket connection."""
        conn = self._connections.pop(client_id, None)
        if conn:
            # Remove from channel
            channel_set = self._channels.get(conn.channel, set())
            channel_set.discard(client_id)
            if not channel_set:
                self._channels.pop(conn.channel, None)

            # Remove from rooms
            for room in list(conn.rooms):
                room_set = self._rooms.get(room, set())
                room_set.discard(client_id)
                if not room_set:
                    self._rooms.pop(room, None)

            logger.info(f"WebSocket disconnected: {client_id} from '{conn.channel}' "
                         f"(total: {self.total_connections})")

    async def join_room(self, client_id: str, room: str):
        """Add a client to a room."""
        conn = self._connections.get(client_id)
        if conn:
            conn.rooms.add(room)
            self._rooms.setdefault(room, set()).add(client_id)
            logger.debug(f"Client {client_id} joined room '{room}'")

    async def leave_room(self, client_id: str, room: str):
        """Remove a client from a room."""
        conn = self._connections.get(client_id)
        if conn:
            conn.rooms.discard(room)
            room_set = self._rooms.get(room, set())
            room_set.discard(client_id)
            if not room_set:
                self._rooms.pop(room, None)

    async def send_to_client(self, client_id: str, data: Dict[str, Any]):
        """Send data to a specific client."""
        conn = self._connections.get(client_id)
        if conn:
            try:
                await conn.send_json(data)
            except Exception:
                await self.disconnect(client_id)

    async def broadcast_channel(self, channel: str, data: Dict[str, Any], exclude: str = None):
        """Broadcast data to all connections on a channel."""
        client_ids = list(self._channels.get(channel, set()))
        disconnected: List[str] = []

        for cid in client_ids:
            if cid == exclude:
                continue
            try:
                conn = self._connections.get(cid)
                if conn:
                    await conn.send_json(data)
            except Exception:
                disconnected.append(cid)

        for cid in disconnected:
            await self.disconnect(cid)

    async def broadcast_room(self, room: str, data: Dict[str, Any], exclude: str = None):
        """Broadcast data to all connections in a room."""
        client_ids = list(self._rooms.get(room, set()))
        disconnected: List[str] = []

        for cid in client_ids:
            if cid == exclude:
                continue
            try:
                conn = self._connections.get(cid)
                if conn:
                    await conn.send_json(data)
            except Exception:
                disconnected.append(cid)

        for cid in disconnected:
            await self.disconnect(cid)

    async def broadcast_all(self, data: Dict[str, Any]):
        """Broadcast data to all connected clients."""
        disconnected: List[str] = []
        for cid, conn in list(self._connections.items()):
            try:
                await conn.send_json(data)
            except Exception:
                disconnected.append(cid)
        for cid in disconnected:
            await self.disconnect(cid)

    async def _heartbeat_loop(self):
        """Periodically send heartbeats and clean stale connections."""
        while self._connections:
            await asyncio.sleep(self._heartbeat_interval)
            now = time.time()
            stale: List[str] = []

            for cid, conn in list(self._connections.items()):
                try:
                    await conn.send_json({
                        "type": "heartbeat",
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                    conn.last_heartbeat = now
                except Exception:
                    stale.append(cid)

            for cid in stale:
                await self.disconnect(cid)

    def get_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        return {
            "total_connections": self.total_connections,
            "channels": {ch: len(ids) for ch, ids in self._channels.items()},
            "rooms": {rm: len(ids) for rm, ids in self._rooms.items()},
            "connections": [
                {
                    "client_id": conn.client_id,
                    "channel": conn.channel,
                    "rooms": list(conn.rooms),
                    "connected_at": conn.connected_at.isoformat(),
                    "messages": conn.message_count,
                }
                for conn in self._connections.values()
            ],
        }


# Global connection manager
ws_manager = ConnectionManager()


# ============================================================
# WebSocket Router
# ============================================================

ws_router = APIRouter(tags=["WebSocket"])


@ws_router.websocket("/ws/chat")
async def websocket_chat(
    websocket: WebSocket,
    client_id: Optional[str] = Query(None),
):
    """
    Real-time chat WebSocket endpoint.
    Receives user messages and streams AI responses.
    """
    conn = await ws_manager.connect(websocket, "chat", client_id)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "message")

            if msg_type == "message":
                message_text = data.get("message", "")
                conversation_id = data.get("conversation_id")

                # Acknowledge receipt
                await conn.send_json({
                    "type": "ack",
                    "message_id": str(uuid.uuid4()),
                    "status": "processing",
                    "timestamp": datetime.utcnow().isoformat(),
                })

                # Process through orchestrator
                try:
                    from agents.base_agent import AgentContext
                    from core.engine import engine

                    context = AgentContext(
                        message=message_text,
                        conversation_id=conversation_id or "",
                        user_id=conn.client_id,
                    )

                    orchestrator = engine.get_agent("orchestrator")
                    if orchestrator:
                        response = await orchestrator.handle_message(context)
                        await conn.send_json({
                            "type": "response",
                            "content": response.content,
                            "agent_name": response.agent_name,
                            "confidence": response.confidence,
                            "suggestions": response.suggestions,
                            "timestamp": datetime.utcnow().isoformat(),
                        })
                    else:
                        await conn.send_json({
                            "type": "response",
                            "content": "NEXUS AI is starting up. Please try again shortly.",
                            "agent_name": "system",
                            "timestamp": datetime.utcnow().isoformat(),
                        })

                except Exception as e:
                    await conn.send_json({
                        "type": "error",
                        "message": f"Processing error: {str(e)}",
                        "timestamp": datetime.utcnow().isoformat(),
                    })

            elif msg_type == "join_room":
                room = data.get("room", "")
                if room:
                    await ws_manager.join_room(conn.client_id, room)

            elif msg_type == "leave_room":
                room = data.get("room", "")
                if room:
                    await ws_manager.leave_room(conn.client_id, room)

            elif msg_type == "ping":
                await conn.send_json({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat(),
                })

    except WebSocketDisconnect:
        await ws_manager.disconnect(conn.client_id)
    except Exception as e:
        logger.error(f"WebSocket chat error: {e}")
        await ws_manager.disconnect(conn.client_id)


@ws_router.websocket("/ws/home")
async def websocket_home(
    websocket: WebSocket,
    client_id: Optional[str] = Query(None),
):
    """
    IoT / Home automation WebSocket endpoint.
    Streams device state updates and sensor readings.
    """
    conn = await ws_manager.connect(websocket, "home", client_id)

    # Subscribe to home events on the event bus
    async def on_home_event(event):
        """Forward home events to WebSocket clients."""
        try:
            await ws_manager.broadcast_channel("home", {
                "type": "device_update",
                "event_type": event.event_type,
                "data": event.data,
                "timestamp": datetime.utcnow().isoformat(),
            })
        except Exception:
            pass

    event_bus.subscribe(
        "home.*",
        on_home_event,
        subscriber_id=f"ws_home_{conn.client_id}",
    )

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "subscribe_device":
                device_id = data.get("device_id", "")
                if device_id:
                    await ws_manager.join_room(conn.client_id, f"device:{device_id}")

            elif msg_type == "subscribe_room":
                room = data.get("room", "")
                if room:
                    await ws_manager.join_room(conn.client_id, f"room:{room}")

            elif msg_type == "ping":
                await conn.send_json({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat(),
                })

    except WebSocketDisconnect:
        event_bus.unsubscribe(f"ws_home_{conn.client_id}")
        await ws_manager.disconnect(conn.client_id)
    except Exception as e:
        logger.error(f"WebSocket home error: {e}")
        event_bus.unsubscribe(f"ws_home_{conn.client_id}")
        await ws_manager.disconnect(conn.client_id)


@ws_router.websocket("/ws/system")
async def websocket_system(
    websocket: WebSocket,
    client_id: Optional[str] = Query(None),
):
    """
    System metrics WebSocket endpoint.
    Streams CPU, memory, disk usage, and agent status at regular intervals.
    """
    conn = await ws_manager.connect(websocket, "system", client_id)

    # Background task to push system metrics
    async def metrics_pusher():
        while conn.client_id in ws_manager._connections:
            try:
                import psutil

                cpu = psutil.cpu_percent(interval=0.5)
                mem = psutil.virtual_memory()
                disk = psutil.disk_usage("/")

                await conn.send_json({
                    "type": "metrics",
                    "data": {
                        "cpu_percent": cpu,
                        "memory_percent": mem.percent,
                        "memory_used_gb": round((mem.total - mem.available) / (1024**3), 2),
                        "disk_percent": disk.percent,
                    },
                    "timestamp": datetime.utcnow().isoformat(),
                })
            except ImportError:
                await conn.send_json({
                    "type": "metrics",
                    "data": {"message": "psutil not available"},
                    "timestamp": datetime.utcnow().isoformat(),
                })
            except Exception:
                break

            await asyncio.sleep(5)

    metrics_task = asyncio.create_task(metrics_pusher())

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "ping":
                await conn.send_json({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat(),
                })

    except WebSocketDisconnect:
        metrics_task.cancel()
        await ws_manager.disconnect(conn.client_id)
    except Exception as e:
        logger.error(f"WebSocket system error: {e}")
        metrics_task.cancel()
        await ws_manager.disconnect(conn.client_id)


@ws_router.websocket("/ws/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    client_id: Optional[str] = Query(None),
):
    """
    Notifications WebSocket endpoint.
    Streams real-time notifications from all agents and services.
    """
    conn = await ws_manager.connect(websocket, "notifications", client_id)

    # Subscribe to notification events
    async def on_notification(event):
        try:
            await ws_manager.broadcast_channel("notifications", {
                "type": "notification",
                "data": event.data,
                "source": event.source,
                "category": event.category.value if hasattr(event.category, "value") else str(event.category),
                "timestamp": datetime.utcnow().isoformat(),
            })
        except Exception:
            pass

    event_bus.subscribe(
        "notification.*",
        on_notification,
        subscriber_id=f"ws_notif_{conn.client_id}",
    )

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "mark_read":
                notification_id = data.get("notification_id")
                if notification_id:
                    await conn.send_json({
                        "type": "ack",
                        "notification_id": notification_id,
                        "status": "read",
                        "timestamp": datetime.utcnow().isoformat(),
                    })

            elif msg_type == "ping":
                await conn.send_json({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat(),
                })

    except WebSocketDisconnect:
        event_bus.unsubscribe(f"ws_notif_{conn.client_id}")
        await ws_manager.disconnect(conn.client_id)
    except Exception as e:
        logger.error(f"WebSocket notifications error: {e}")
        event_bus.unsubscribe(f"ws_notif_{conn.client_id}")
        await ws_manager.disconnect(conn.client_id)


# ============================================================
# Utility: Notify via WebSocket from anywhere in the codebase
# ============================================================

async def notify_clients(channel: str, data: Dict[str, Any]):
    """Utility function to push data to all clients on a channel."""
    await ws_manager.broadcast_channel(channel, data)


async def notify_room(room: str, data: Dict[str, Any]):
    """Utility function to push data to all clients in a room."""
    await ws_manager.broadcast_room(room, data)
