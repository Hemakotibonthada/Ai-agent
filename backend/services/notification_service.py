# NEXUS AI - Notification Service
"""
Cross-platform notification service with desktop toast, system tray,
sound alerts, notification queue, and priority-based delivery for
the NEXUS AI OS.
"""

import asyncio
import platform
import uuid
from collections import deque
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Deque, Dict, List, Optional

from loguru import logger

from core.config import NexusSettings, settings
from core.events import Event, EventBus, EventCategory, EventPriority, event_bus
from core.logger import nexus_logger


class NotificationLevel(str, Enum):
    """Notification urgency levels."""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class NotificationChannel(str, Enum):
    """Delivery channels for notifications."""
    DESKTOP = "desktop"
    SOUND = "sound"
    SYSTEM_TRAY = "system_tray"
    IN_APP = "in_app"
    LOG = "log"


class NotificationItem:
    """A single notification in the queue."""

    def __init__(
        self,
        title: str,
        message: str,
        level: NotificationLevel = NotificationLevel.INFO,
        source: str = "system",
        channels: Optional[List[NotificationChannel]] = None,
        action_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        expires_at: Optional[datetime] = None,
        sound_file: Optional[str] = None,
        group: Optional[str] = None,
    ):
        self.notification_id: str = str(uuid.uuid4())
        self.title: str = title
        self.message: str = message
        self.level: NotificationLevel = level
        self.source: str = source
        self.channels: List[NotificationChannel] = channels or [
            NotificationChannel.DESKTOP,
            NotificationChannel.IN_APP,
        ]
        self.action_url: Optional[str] = action_url
        self.metadata: Dict[str, Any] = metadata or {}
        self.expires_at: Optional[datetime] = expires_at
        self.sound_file: Optional[str] = sound_file
        self.group: Optional[str] = group
        self.created_at: datetime = datetime.utcnow()
        self.delivered: bool = False
        self.delivered_at: Optional[datetime] = None
        self.read: bool = False
        self.read_at: Optional[datetime] = None
        self.delivery_errors: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        """Serialize notification to dictionary."""
        return {
            "notification_id": self.notification_id,
            "title": self.title,
            "message": self.message,
            "level": self.level.value,
            "source": self.source,
            "channels": [c.value for c in self.channels],
            "action_url": self.action_url,
            "metadata": self.metadata,
            "group": self.group,
            "created_at": self.created_at.isoformat(),
            "delivered": self.delivered,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "read": self.read,
        }

    @property
    def is_expired(self) -> bool:
        """Check if the notification has passed its expiry time."""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def priority_score(self) -> int:
        """Numeric priority for queue ordering."""
        scores = {
            NotificationLevel.INFO: 0,
            NotificationLevel.SUCCESS: 1,
            NotificationLevel.WARNING: 2,
            NotificationLevel.ERROR: 3,
            NotificationLevel.CRITICAL: 4,
        }
        return scores.get(self.level, 0)


class NotificationService:
    """
    Cross-platform notification service for NEXUS AI.

    Provides:
    - Desktop toast notifications (Windows, macOS, Linux)
    - Sound alert playback
    - Priority-based notification queue
    - Notification history and read tracking
    - Group-based notification management
    - Rate limiting to prevent notification spam
    - Event bus integration for reactive notifications
    """

    def __init__(self, config: Optional[NexusSettings] = None,
                 event_bus_instance: Optional[EventBus] = None):
        self._config: NexusSettings = config or settings
        self._event_bus: EventBus = event_bus_instance or event_bus
        self._enabled: bool = self._config.notification.enabled
        self._sound_enabled: bool = self._config.notification.sound
        self._desktop_enabled: bool = self._config.notification.desktop
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._history: Deque[NotificationItem] = deque(maxlen=1000)
        self._unread: Dict[str, NotificationItem] = {}
        self._initialized: bool = False
        self._processing: bool = False
        self._process_task: Optional[asyncio.Task] = None
        self._callbacks: List[Callable] = []
        self._rate_limits: Dict[str, datetime] = {}
        self._rate_limit_seconds: float = 5.0
        self._platform: str = platform.system().lower()
        self._total_sent: int = 0
        self._total_errors: int = 0
        self._suppressed_count: int = 0
        self._group_counts: Dict[str, int] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize the notification service and start the delivery loop."""
        try:
            logger.info("Initializing NotificationService...")
            self._processing = True
            self._process_task = asyncio.create_task(self._delivery_loop())
            self._initialized = True
            await self._event_bus.emit(
                "notification.initialized",
                {"platform": self._platform, "enabled": self._enabled},
                source="notification_service",
                category=EventCategory.NOTIFICATION,
            )
            logger.info(f"NotificationService initialized (platform: {self._platform})")
        except Exception as exc:
            logger.error(f"NotificationService initialization failed: {exc}")
            self._initialized = True

    async def shutdown(self) -> None:
        """Stop the delivery loop and clean up."""
        try:
            logger.info("Shutting down NotificationService...")
            self._processing = False
            if self._process_task and not self._process_task.done():
                self._process_task.cancel()
                try:
                    await self._process_task
                except asyncio.CancelledError:
                    pass
            self._initialized = False
            logger.info("NotificationService shut down complete")
        except Exception as exc:
            logger.error(f"Error during NotificationService shutdown: {exc}")

    # ------------------------------------------------------------------
    # Sending Notifications
    # ------------------------------------------------------------------

    async def notify(
        self,
        title: str,
        message: str,
        level: NotificationLevel = NotificationLevel.INFO,
        source: str = "system",
        channels: Optional[List[NotificationChannel]] = None,
        action_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        expires_in_seconds: Optional[int] = None,
        sound_file: Optional[str] = None,
        group: Optional[str] = None,
    ) -> str:
        """
        Send a notification.

        Args:
            title: Notification title.
            message: Notification body.
            level: Urgency level.
            source: Source system/agent.
            channels: Delivery channels to use.
            action_url: URL to open on click.
            metadata: Extra metadata.
            expires_in_seconds: Auto-expire after this many seconds.
            sound_file: Custom sound file path.
            group: Notification group for aggregation.

        Returns:
            Notification ID.
        """
        if not self._enabled:
            logger.debug(f"Notifications disabled — suppressed: {title}")
            self._suppressed_count += 1
            return ""

        if self._is_rate_limited(source):
            logger.debug(f"Rate limited notification from {source}: {title}")
            self._suppressed_count += 1
            return ""

        expires_at = None
        if expires_in_seconds:
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in_seconds)

        item = NotificationItem(
            title=title,
            message=message,
            level=level,
            source=source,
            channels=channels,
            action_url=action_url,
            metadata=metadata,
            expires_at=expires_at,
            sound_file=sound_file,
            group=group,
        )

        priority = 10 - item.priority_score
        await self._queue.put((priority, item.created_at.timestamp(), item))

        self._unread[item.notification_id] = item
        if group:
            self._group_counts[group] = self._group_counts.get(group, 0) + 1

        logger.debug(f"Notification queued: [{level.value}] {title}")
        return item.notification_id

    async def notify_info(self, title: str, message: str, **kwargs: Any) -> str:
        """Send an informational notification."""
        return await self.notify(title, message, NotificationLevel.INFO, **kwargs)

    async def notify_success(self, title: str, message: str, **kwargs: Any) -> str:
        """Send a success notification."""
        return await self.notify(title, message, NotificationLevel.SUCCESS, **kwargs)

    async def notify_warning(self, title: str, message: str, **kwargs: Any) -> str:
        """Send a warning notification."""
        return await self.notify(title, message, NotificationLevel.WARNING, **kwargs)

    async def notify_error(self, title: str, message: str, **kwargs: Any) -> str:
        """Send an error notification."""
        return await self.notify(title, message, NotificationLevel.ERROR, **kwargs)

    async def notify_critical(self, title: str, message: str, **kwargs: Any) -> str:
        """Send a critical notification."""
        return await self.notify(title, message, NotificationLevel.CRITICAL, **kwargs)

    # ------------------------------------------------------------------
    # Delivery Loop
    # ------------------------------------------------------------------

    async def _delivery_loop(self) -> None:
        """Main notification delivery loop — processes items from the priority queue."""
        while self._processing:
            try:
                priority, timestamp, item = await asyncio.wait_for(
                    self._queue.get(), timeout=1.0,
                )
                if item.is_expired:
                    logger.debug(f"Notification expired before delivery: {item.title}")
                    self._suppressed_count += 1
                    continue

                await self._deliver(item)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"Notification delivery loop error: {exc}")
                await asyncio.sleep(1)

    async def _deliver(self, item: NotificationItem) -> None:
        """Deliver a notification through its configured channels."""
        for channel in item.channels:
            try:
                if channel == NotificationChannel.DESKTOP and self._desktop_enabled:
                    await self._deliver_desktop(item)
                elif channel == NotificationChannel.SOUND and self._sound_enabled:
                    await self._deliver_sound(item)
                elif channel == NotificationChannel.SYSTEM_TRAY:
                    await self._deliver_system_tray(item)
                elif channel == NotificationChannel.IN_APP:
                    await self._deliver_in_app(item)
                elif channel == NotificationChannel.LOG:
                    self._deliver_log(item)
            except Exception as exc:
                item.delivery_errors.append(f"{channel.value}: {exc}")
                logger.error(f"Delivery error [{channel.value}]: {exc}")

        item.delivered = True
        item.delivered_at = datetime.utcnow()
        self._history.append(item)
        self._total_sent += 1

        for cb in self._callbacks:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(item)
                else:
                    cb(item)
            except Exception as exc:
                logger.error(f"Notification callback error: {exc}")

        await self._event_bus.emit(
            "notification.delivered",
            item.to_dict(),
            source="notification_service",
            category=EventCategory.NOTIFICATION,
        )

    async def _deliver_desktop(self, item: NotificationItem) -> None:
        """Show a desktop toast notification."""
        def _show() -> None:
            try:
                if self._platform == "windows":
                    self._show_windows_toast(item)
                elif self._platform == "darwin":
                    self._show_macos_notification(item)
                elif self._platform == "linux":
                    self._show_linux_notification(item)
            except Exception as exc:
                raise RuntimeError(f"Desktop notification failed: {exc}")

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _show)

    def _show_windows_toast(self, item: NotificationItem) -> None:
        """Display a Windows toast notification using win10toast or fallback."""
        try:
            from win10toast import ToastNotifier
            toaster = ToastNotifier()
            toaster.show_toast(
                item.title,
                item.message,
                duration=5,
                threaded=True,
            )
        except ImportError:
            try:
                import ctypes
                ctypes.windll.user32.MessageBoxW(
                    0, item.message, item.title, 0x40,
                )
            except Exception:
                logger.warning("No Windows toast library available — falling back to log only")
                self._deliver_log(item)

    def _show_macos_notification(self, item: NotificationItem) -> None:
        """Display a macOS notification via osascript."""
        import subprocess
        script = f'display notification "{item.message}" with title "{item.title}"'
        subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, timeout=5,
        )

    def _show_linux_notification(self, item: NotificationItem) -> None:
        """Display a Linux desktop notification via notify-send."""
        import subprocess
        urgency_map = {
            NotificationLevel.INFO: "low",
            NotificationLevel.SUCCESS: "low",
            NotificationLevel.WARNING: "normal",
            NotificationLevel.ERROR: "critical",
            NotificationLevel.CRITICAL: "critical",
        }
        urgency = urgency_map.get(item.level, "normal")
        subprocess.run(
            ["notify-send", "-u", urgency, item.title, item.message],
            capture_output=True, timeout=5,
        )

    async def _deliver_sound(self, item: NotificationItem) -> None:
        """Play a notification sound."""
        def _play() -> None:
            try:
                if item.sound_file:
                    import sounddevice  # noqa: F401
                    import soundfile as sf
                    data, fs = sf.read(item.sound_file)
                    import sounddevice as sd
                    sd.play(data, fs)
                    sd.wait()
                else:
                    if self._platform == "windows":
                        import winsound
                        level_sounds = {
                            NotificationLevel.INFO: winsound.MB_ICONASTERISK,
                            NotificationLevel.SUCCESS: winsound.MB_ICONASTERISK,
                            NotificationLevel.WARNING: winsound.MB_ICONEXCLAMATION,
                            NotificationLevel.ERROR: winsound.MB_ICONHAND,
                            NotificationLevel.CRITICAL: winsound.MB_ICONHAND,
                        }
                        winsound.MessageBeep(level_sounds.get(item.level, winsound.MB_OK))
                    elif self._platform == "darwin":
                        import subprocess
                        subprocess.run(
                            ["afplay", "/System/Library/Sounds/Glass.aiff"],
                            capture_output=True, timeout=5,
                        )
                    elif self._platform == "linux":
                        import subprocess
                        subprocess.run(
                            ["paplay", "/usr/share/sounds/freedesktop/stereo/message.oga"],
                            capture_output=True, timeout=5,
                        )
            except Exception as exc:
                logger.debug(f"Sound playback failed: {exc}")

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _play)

    async def _deliver_system_tray(self, item: NotificationItem) -> None:
        """Log system tray notification (actual tray icon requires GUI framework)."""
        logger.info(f"[SYSTEM_TRAY] [{item.level.value.upper()}] {item.title}: {item.message}")

    async def _deliver_in_app(self, item: NotificationItem) -> None:
        """Store notification for in-app retrieval via API."""
        logger.debug(f"[IN_APP] [{item.level.value.upper()}] {item.title}: {item.message}")

    def _deliver_log(self, item: NotificationItem) -> None:
        """Log the notification."""
        level_map = {
            NotificationLevel.INFO: logger.info,
            NotificationLevel.SUCCESS: logger.info,
            NotificationLevel.WARNING: logger.warning,
            NotificationLevel.ERROR: logger.error,
            NotificationLevel.CRITICAL: logger.critical,
        }
        log_func = level_map.get(item.level, logger.info)
        log_func(f"[NOTIFICATION] {item.title}: {item.message}")

    # ------------------------------------------------------------------
    # Rate Limiting
    # ------------------------------------------------------------------

    def _is_rate_limited(self, source: str) -> bool:
        """Check if notifications from this source are rate-limited."""
        now = datetime.utcnow()
        last_sent = self._rate_limits.get(source)
        if last_sent and (now - last_sent).total_seconds() < self._rate_limit_seconds:
            return True
        self._rate_limits[source] = now
        return False

    def set_rate_limit(self, seconds: float) -> None:
        """Set the rate limit interval in seconds."""
        self._rate_limit_seconds = seconds
        logger.info(f"Notification rate limit set to {seconds}s")

    # ------------------------------------------------------------------
    # Notification Management
    # ------------------------------------------------------------------

    def mark_as_read(self, notification_id: str) -> bool:
        """Mark a notification as read."""
        item = self._unread.pop(notification_id, None)
        if item:
            item.read = True
            item.read_at = datetime.utcnow()
            return True
        for h_item in self._history:
            if h_item.notification_id == notification_id and not h_item.read:
                h_item.read = True
                h_item.read_at = datetime.utcnow()
                return True
        return False

    def mark_all_as_read(self) -> int:
        """Mark all unread notifications as read. Returns count of marked items."""
        count = len(self._unread)
        now = datetime.utcnow()
        for item in self._unread.values():
            item.read = True
            item.read_at = now
        self._unread.clear()
        return count

    def get_unread(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get unread notifications."""
        items = sorted(
            self._unread.values(),
            key=lambda x: x.priority_score,
            reverse=True,
        )
        return [i.to_dict() for i in items[:limit]]

    def get_history(self, limit: int = 100, level: Optional[NotificationLevel] = None,
                    group: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get notification history with optional filtering.

        Args:
            limit: Maximum items to return.
            level: Filter by level.
            group: Filter by group.

        Returns:
            List of notification dicts, newest first.
        """
        items = list(self._history)
        if level:
            items = [i for i in items if i.level == level]
        if group:
            items = [i for i in items if i.group == group]
        items.reverse()
        return [i.to_dict() for i in items[:limit]]

    def clear_history(self) -> int:
        """Clear notification history. Returns count of cleared items."""
        count = len(self._history)
        self._history.clear()
        return count

    def register_callback(self, callback: Callable) -> None:
        """Register a callback for delivered notifications."""
        self._callbacks.append(callback)

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    def set_enabled(self, enabled: bool) -> None:
        """Enable or disable notifications globally."""
        self._enabled = enabled
        logger.info(f"Notifications {'enabled' if enabled else 'disabled'}")

    def set_sound_enabled(self, enabled: bool) -> None:
        """Enable or disable sound notifications."""
        self._sound_enabled = enabled

    def set_desktop_enabled(self, enabled: bool) -> None:
        """Enable or disable desktop toast notifications."""
        self._desktop_enabled = enabled

    # ------------------------------------------------------------------
    # Health & Stats
    # ------------------------------------------------------------------

    async def health_check(self) -> Dict[str, Any]:
        """Return notification service health status."""
        return {
            "service": "notification_service",
            "initialized": self._initialized,
            "enabled": self._enabled,
            "sound_enabled": self._sound_enabled,
            "desktop_enabled": self._desktop_enabled,
            "platform": self._platform,
            "queue_size": self._queue.qsize(),
            "unread_count": len(self._unread),
            "history_size": len(self._history),
            "total_sent": self._total_sent,
            "total_errors": self._total_errors,
            "suppressed_count": self._suppressed_count,
        }

    def get_stats(self) -> Dict[str, Any]:
        """Return runtime statistics."""
        return {
            "initialized": self._initialized,
            "enabled": self._enabled,
            "total_sent": self._total_sent,
            "total_errors": self._total_errors,
            "suppressed_count": self._suppressed_count,
            "unread_count": len(self._unread),
            "history_size": len(self._history),
            "queue_size": self._queue.qsize(),
            "group_counts": dict(self._group_counts),
        }
