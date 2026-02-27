"""
Notification Service - Multi-channel notification management
Supports push, email, SMS, webhook, and in-app notifications
"""
import asyncio
import uuid
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Set
from enum import Enum
from dataclasses import dataclass, field, asdict
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class NotificationChannel(str, Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WEBHOOK = "webhook"
    SLACK = "slack"
    TELEGRAM = "telegram"


class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"
    CRITICAL = "critical"


class NotificationCategory(str, Enum):
    SYSTEM = "system"
    SECURITY = "security"
    AUTOMATION = "automation"
    AGENT = "agent"
    HEALTH = "health"
    FINANCE = "finance"
    HOME = "home"
    TASK = "task"
    CALENDAR = "calendar"
    SOCIAL = "social"
    UPDATE = "update"


@dataclass
class NotificationTemplate:
    id: str
    name: str
    channel: NotificationChannel
    subject_template: str
    body_template: str
    category: NotificationCategory
    variables: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class Notification:
    id: str
    user_id: str
    channel: NotificationChannel
    category: NotificationCategory
    priority: NotificationPriority
    title: str
    body: str
    data: Dict[str, Any] = field(default_factory=dict)
    read: bool = False
    archived: bool = False
    starred: bool = False
    sent_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    read_at: Optional[str] = None
    actions: List[Dict[str, str]] = field(default_factory=list)
    source: str = "system"
    group_key: Optional[str] = None
    expires_at: Optional[str] = None


@dataclass
class NotificationPreference:
    user_id: str
    channel_enabled: Dict[str, bool] = field(default_factory=lambda: {
        "in_app": True, "email": True, "sms": False,
        "push": True, "webhook": False, "slack": False, "telegram": False,
    })
    category_enabled: Dict[str, bool] = field(default_factory=lambda: {
        c.value: True for c in NotificationCategory
    })
    quiet_hours: Optional[Dict[str, str]] = None  # {"start": "22:00", "end": "07:00"}
    digest_enabled: bool = False
    digest_frequency: str = "daily"  # daily, weekly
    min_priority: str = "low"
    muted_until: Optional[str] = None


@dataclass
class NotificationDigest:
    user_id: str
    period_start: str
    period_end: str
    notifications: List[Dict[str, Any]]
    summary: Dict[str, int]
    generated_at: str


class NotificationGrouper:
    """Groups related notifications to reduce noise."""
    
    def __init__(self, window_seconds: int = 300):
        self.window = window_seconds
        self.groups: Dict[str, List[Notification]] = defaultdict(list)
        self.last_sent: Dict[str, datetime] = {}
    
    def should_group(self, notification: Notification) -> bool:
        if not notification.group_key:
            return False
        key = f"{notification.user_id}:{notification.group_key}"
        if key in self.last_sent:
            elapsed = (datetime.utcnow() - self.last_sent[key]).total_seconds()
            return elapsed < self.window
        return False
    
    def add_to_group(self, notification: Notification) -> Optional[Dict[str, Any]]:
        key = f"{notification.user_id}:{notification.group_key}"
        self.groups[key].append(notification)
        
        if not self.should_group(notification):
            self.last_sent[key] = datetime.utcnow()
            group = self.groups.pop(key, [])
            if len(group) > 1:
                return {
                    "type": "grouped",
                    "count": len(group),
                    "first": asdict(group[0]),
                    "last": asdict(group[-1]),
                    "group_key": notification.group_key,
                }
            return {"type": "single", "notification": asdict(group[0])}
        return None


class ChannelDispatcher:
    """Dispatches notifications to different channels."""
    
    def __init__(self):
        self.handlers: Dict[NotificationChannel, Any] = {}
        self.send_counts: Dict[str, int] = defaultdict(int)
    
    async def send(self, notification: Notification) -> Dict[str, Any]:
        channel = notification.channel
        self.send_counts[channel.value] += 1
        
        if channel == NotificationChannel.IN_APP:
            return await self._send_in_app(notification)
        elif channel == NotificationChannel.EMAIL:
            return await self._send_email(notification)
        elif channel == NotificationChannel.PUSH:
            return await self._send_push(notification)
        elif channel == NotificationChannel.WEBHOOK:
            return await self._send_webhook(notification)
        elif channel == NotificationChannel.SLACK:
            return await self._send_slack(notification)
        elif channel == NotificationChannel.TELEGRAM:
            return await self._send_telegram(notification)
        elif channel == NotificationChannel.SMS:
            return await self._send_sms(notification)
        
        return {"success": False, "error": f"Unknown channel: {channel}"}
    
    async def _send_in_app(self, notification: Notification) -> Dict[str, Any]:
        logger.info(f"In-app notification: {notification.title}")
        return {"success": True, "channel": "in_app", "id": notification.id}
    
    async def _send_email(self, notification: Notification) -> Dict[str, Any]:
        logger.info(f"Email notification: {notification.title}")
        return {"success": True, "channel": "email", "id": notification.id, "status": "queued"}
    
    async def _send_push(self, notification: Notification) -> Dict[str, Any]:
        logger.info(f"Push notification: {notification.title}")
        return {"success": True, "channel": "push", "id": notification.id}
    
    async def _send_webhook(self, notification: Notification) -> Dict[str, Any]:
        payload = {
            "event": "notification",
            "data": {
                "id": notification.id,
                "title": notification.title,
                "body": notification.body,
                "category": notification.category.value,
                "priority": notification.priority.value,
                "timestamp": notification.sent_at,
            }
        }
        logger.info(f"Webhook notification: {json.dumps(payload)}")
        return {"success": True, "channel": "webhook", "payload_size": len(json.dumps(payload))}
    
    async def _send_slack(self, notification: Notification) -> Dict[str, Any]:
        priority_emoji = {
            "low": "ℹ️", "normal": "📋", "high": "⚠️", "urgent": "🔴", "critical": "🚨"
        }
        emoji = priority_emoji.get(notification.priority.value, "📌")
        message = f"{emoji} *{notification.title}*\n{notification.body}"
        logger.info(f"Slack notification: {message}")
        return {"success": True, "channel": "slack", "message_length": len(message)}
    
    async def _send_telegram(self, notification: Notification) -> Dict[str, Any]:
        message = f"*{notification.title}*\n\n{notification.body}"
        logger.info(f"Telegram notification: {message}")
        return {"success": True, "channel": "telegram"}
    
    async def _send_sms(self, notification: Notification) -> Dict[str, Any]:
        message = f"{notification.title}: {notification.body[:140]}"
        logger.info(f"SMS notification: {message}")
        return {"success": True, "channel": "sms", "segments": (len(message) // 160) + 1}


class NotificationService:
    """Complete notification management service."""
    
    def __init__(self):
        self.notifications: Dict[str, Notification] = {}
        self.user_notifications: Dict[str, List[str]] = defaultdict(list)
        self.templates: Dict[str, NotificationTemplate] = {}
        self.preferences: Dict[str, NotificationPreference] = {}
        self.dispatcher = ChannelDispatcher()
        self.grouper = NotificationGrouper()
        self.delivery_log: List[Dict[str, Any]] = []
        self._init_default_templates()
    
    def _init_default_templates(self):
        templates = [
            NotificationTemplate(
                id="security_alert", name="Security Alert",
                channel=NotificationChannel.IN_APP,
                subject_template="Security Alert: {event_type}",
                body_template="A security event was detected: {description}. Source: {source_ip}",
                category=NotificationCategory.SECURITY,
                variables=["event_type", "description", "source_ip"]
            ),
            NotificationTemplate(
                id="automation_complete", name="Automation Complete",
                channel=NotificationChannel.IN_APP,
                subject_template="Automation '{name}' completed",
                body_template="The automation '{name}' finished successfully. Duration: {duration}",
                category=NotificationCategory.AUTOMATION,
                variables=["name", "duration"]
            ),
            NotificationTemplate(
                id="health_reminder", name="Health Reminder",
                channel=NotificationChannel.PUSH,
                subject_template="Health Reminder: {reminder_type}",
                body_template="{message}. Current status: {current_value}",
                category=NotificationCategory.HEALTH,
                variables=["reminder_type", "message", "current_value"]
            ),
            NotificationTemplate(
                id="system_update", name="System Update",
                channel=NotificationChannel.IN_APP,
                subject_template="System Update: {component}",
                body_template="{component} has been updated to version {version}. {changelog}",
                category=NotificationCategory.UPDATE,
                variables=["component", "version", "changelog"]
            ),
            NotificationTemplate(
                id="budget_alert", name="Budget Alert",
                channel=NotificationChannel.IN_APP,
                subject_template="Budget Alert: {category} spending",
                body_template="You've spent {amount} in {category} ({percentage}% of budget). Remaining: {remaining}",
                category=NotificationCategory.FINANCE,
                variables=["category", "amount", "percentage", "remaining"]
            ),
            NotificationTemplate(
                id="agent_report", name="Agent Report",
                channel=NotificationChannel.IN_APP,
                subject_template="Agent Report: {agent_name}",
                body_template="{agent_name} has completed {task_count} tasks. Summary: {summary}",
                category=NotificationCategory.AGENT,
                variables=["agent_name", "task_count", "summary"]
            ),
            NotificationTemplate(
                id="home_event", name="Home Event",
                channel=NotificationChannel.PUSH,
                subject_template="Home: {event_type}",
                body_template="{device_name} in {room}: {description}",
                category=NotificationCategory.HOME,
                variables=["event_type", "device_name", "room", "description"]
            ),
            NotificationTemplate(
                id="task_reminder", name="Task Reminder",
                channel=NotificationChannel.IN_APP,
                subject_template="Task Due: {task_name}",
                body_template="Your task '{task_name}' is due {due_time}. Priority: {priority}",
                category=NotificationCategory.TASK,
                variables=["task_name", "due_time", "priority"]
            ),
        ]
        for t in templates:
            self.templates[t.id] = t
    
    async def send_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        category: NotificationCategory = NotificationCategory.SYSTEM,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        channel: NotificationChannel = NotificationChannel.IN_APP,
        data: Optional[Dict[str, Any]] = None,
        actions: Optional[List[Dict[str, str]]] = None,
        source: str = "system",
        group_key: Optional[str] = None,
        template_id: Optional[str] = None,
        template_vars: Optional[Dict[str, str]] = None,
        expires_in: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Send a notification through the specified channel."""
        
        # Check preferences
        prefs = self.preferences.get(user_id)
        if prefs:
            if not prefs.channel_enabled.get(channel.value, True):
                return {"success": False, "reason": "channel_disabled"}
            if not prefs.category_enabled.get(category.value, True):
                return {"success": False, "reason": "category_disabled"}
            if prefs.muted_until:
                if datetime.fromisoformat(prefs.muted_until) > datetime.utcnow():
                    return {"success": False, "reason": "muted"}
            
            # Check quiet hours
            if prefs.quiet_hours and priority not in (NotificationPriority.URGENT, NotificationPriority.CRITICAL):
                now = datetime.utcnow()
                start = datetime.strptime(prefs.quiet_hours["start"], "%H:%M").time()
                end = datetime.strptime(prefs.quiet_hours["end"], "%H:%M").time()
                if start <= now.time() <= end or (start > end and (now.time() >= start or now.time() <= end)):
                    return {"success": False, "reason": "quiet_hours"}
            
            # Check min priority
            priority_levels = ["low", "normal", "high", "urgent", "critical"]
            if priority_levels.index(priority.value) < priority_levels.index(prefs.min_priority):
                return {"success": False, "reason": "below_min_priority"}
        
        # Apply template if specified
        if template_id and template_id in self.templates:
            template = self.templates[template_id]
            if template_vars:
                title = template.subject_template.format(**template_vars)
                body = template.body_template.format(**template_vars)
                category = template.category
                channel = template.channel
        
        # Create notification
        notification = Notification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            channel=channel,
            category=category,
            priority=priority,
            title=title,
            body=body,
            data=data or {},
            actions=actions or [],
            source=source,
            group_key=group_key,
            expires_at=(datetime.utcnow() + timedelta(seconds=expires_in)).isoformat() if expires_in else None,
        )
        
        # Check grouping
        if group_key:
            group_result = self.grouper.add_to_group(notification)
            if group_result is None:
                # Grouped, will be sent later
                self.notifications[notification.id] = notification
                self.user_notifications[user_id].append(notification.id)
                return {"success": True, "id": notification.id, "grouped": True}
        
        # Store
        self.notifications[notification.id] = notification
        self.user_notifications[user_id].append(notification.id)
        
        # Dispatch
        result = await self.dispatcher.send(notification)
        
        # Log delivery
        self.delivery_log.append({
            "notification_id": notification.id,
            "channel": channel.value,
            "result": result,
            "timestamp": datetime.utcnow().isoformat(),
        })
        
        return {"success": True, "id": notification.id, "delivery": result}
    
    async def send_from_template(
        self,
        user_id: str,
        template_id: str,
        variables: Dict[str, str],
        priority: NotificationPriority = NotificationPriority.NORMAL,
        **kwargs,
    ) -> Dict[str, Any]:
        """Send notification using a template."""
        if template_id not in self.templates:
            return {"success": False, "error": f"Template not found: {template_id}"}
        
        template = self.templates[template_id]
        try:
            title = template.subject_template.format(**variables)
            body = template.body_template.format(**variables)
        except KeyError as e:
            return {"success": False, "error": f"Missing template variable: {e}"}
        
        return await self.send_notification(
            user_id=user_id,
            title=title,
            body=body,
            category=template.category,
            channel=template.channel,
            priority=priority,
            source=f"template:{template_id}",
            **kwargs,
        )
    
    async def broadcast(
        self,
        user_ids: List[str],
        title: str,
        body: str,
        **kwargs,
    ) -> Dict[str, Any]:
        """Send notification to multiple users."""
        results = []
        for uid in user_ids:
            result = await self.send_notification(user_id=uid, title=title, body=body, **kwargs)
            results.append({"user_id": uid, **result})
        
        success_count = sum(1 for r in results if r.get("success"))
        return {
            "total": len(user_ids),
            "success": success_count,
            "failed": len(user_ids) - success_count,
            "results": results,
        }
    
    def get_notifications(
        self,
        user_id: str,
        unread_only: bool = False,
        category: Optional[NotificationCategory] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Get user notifications with filters."""
        notification_ids = self.user_notifications.get(user_id, [])
        notifications = []
        
        for nid in reversed(notification_ids):
            n = self.notifications.get(nid)
            if not n or n.archived:
                continue
            if n.expires_at and datetime.fromisoformat(n.expires_at) < datetime.utcnow():
                continue
            if unread_only and n.read:
                continue
            if category and n.category != category:
                continue
            notifications.append(n)
        
        total = len(notifications)
        notifications = notifications[offset:offset + limit]
        
        return {
            "notifications": [asdict(n) for n in notifications],
            "total": total,
            "unread_count": sum(1 for n in notifications if not n.read),
            "offset": offset,
            "limit": limit,
        }
    
    def mark_read(self, notification_id: str) -> bool:
        n = self.notifications.get(notification_id)
        if n:
            n.read = True
            n.read_at = datetime.utcnow().isoformat()
            return True
        return False
    
    def mark_all_read(self, user_id: str) -> int:
        count = 0
        for nid in self.user_notifications.get(user_id, []):
            n = self.notifications.get(nid)
            if n and not n.read:
                n.read = True
                n.read_at = datetime.utcnow().isoformat()
                count += 1
        return count
    
    def toggle_star(self, notification_id: str) -> Optional[bool]:
        n = self.notifications.get(notification_id)
        if n:
            n.starred = not n.starred
            return n.starred
        return None
    
    def archive(self, notification_id: str) -> bool:
        n = self.notifications.get(notification_id)
        if n:
            n.archived = True
            return True
        return False
    
    def delete_notification(self, notification_id: str) -> bool:
        if notification_id in self.notifications:
            n = self.notifications.pop(notification_id)
            if n.user_id in self.user_notifications:
                self.user_notifications[n.user_id] = [
                    nid for nid in self.user_notifications[n.user_id] if nid != notification_id
                ]
            return True
        return False
    
    def set_preferences(self, user_id: str, preferences: Dict[str, Any]) -> NotificationPreference:
        pref = self.preferences.get(user_id, NotificationPreference(user_id=user_id))
        
        if "channel_enabled" in preferences:
            pref.channel_enabled.update(preferences["channel_enabled"])
        if "category_enabled" in preferences:
            pref.category_enabled.update(preferences["category_enabled"])
        if "quiet_hours" in preferences:
            pref.quiet_hours = preferences["quiet_hours"]
        if "digest_enabled" in preferences:
            pref.digest_enabled = preferences["digest_enabled"]
        if "digest_frequency" in preferences:
            pref.digest_frequency = preferences["digest_frequency"]
        if "min_priority" in preferences:
            pref.min_priority = preferences["min_priority"]
        if "muted_until" in preferences:
            pref.muted_until = preferences["muted_until"]
        
        self.preferences[user_id] = pref
        return pref
    
    def get_preferences(self, user_id: str) -> Dict[str, Any]:
        pref = self.preferences.get(user_id, NotificationPreference(user_id=user_id))
        return asdict(pref)
    
    def mute(self, user_id: str, duration_minutes: int = 60) -> str:
        muted_until = (datetime.utcnow() + timedelta(minutes=duration_minutes)).isoformat()
        pref = self.preferences.get(user_id, NotificationPreference(user_id=user_id))
        pref.muted_until = muted_until
        self.preferences[user_id] = pref
        return muted_until
    
    def unmute(self, user_id: str) -> bool:
        pref = self.preferences.get(user_id)
        if pref:
            pref.muted_until = None
            return True
        return False
    
    async def generate_digest(self, user_id: str, hours: int = 24) -> Dict[str, Any]:
        """Generate a notification digest for a user."""
        cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        notifications = []
        summary: Dict[str, int] = defaultdict(int)
        
        for nid in self.user_notifications.get(user_id, []):
            n = self.notifications.get(nid)
            if n and n.sent_at >= cutoff:
                notifications.append(asdict(n))
                summary[n.category.value] += 1
        
        digest = NotificationDigest(
            user_id=user_id,
            period_start=cutoff,
            period_end=datetime.utcnow().isoformat(),
            notifications=notifications,
            summary=dict(summary),
            generated_at=datetime.utcnow().isoformat(),
        )
        
        return asdict(digest)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get notification service statistics."""
        total = len(self.notifications)
        unread = sum(1 for n in self.notifications.values() if not n.read)
        by_channel: Dict[str, int] = defaultdict(int)
        by_category: Dict[str, int] = defaultdict(int)
        by_priority: Dict[str, int] = defaultdict(int)
        
        for n in self.notifications.values():
            by_channel[n.channel.value] += 1
            by_category[n.category.value] += 1
            by_priority[n.priority.value] += 1
        
        return {
            "total_notifications": total,
            "unread": unread,
            "read": total - unread,
            "by_channel": dict(by_channel),
            "by_category": dict(by_category),
            "by_priority": dict(by_priority),
            "delivery_count": len(self.delivery_log),
            "dispatch_stats": dict(self.dispatcher.send_counts),
            "template_count": len(self.templates),
            "user_count": len(self.user_notifications),
        }
    
    def register_template(self, template: Dict[str, Any]) -> NotificationTemplate:
        t = NotificationTemplate(
            id=template.get("id", str(uuid.uuid4())),
            name=template["name"],
            channel=NotificationChannel(template.get("channel", "in_app")),
            subject_template=template["subject_template"],
            body_template=template["body_template"],
            category=NotificationCategory(template.get("category", "system")),
            variables=template.get("variables", []),
        )
        self.templates[t.id] = t
        return t
    
    def list_templates(self) -> List[Dict[str, Any]]:
        return [asdict(t) for t in self.templates.values()]


# Singleton
_notification_service: Optional[NotificationService] = None

def get_notification_service() -> NotificationService:
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
