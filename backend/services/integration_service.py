"""
Integration Service - Manage third-party integrations, OAuth connections,
webhooks, and API connectors for the Nexus AI platform.
"""

import hashlib
import hmac
import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
from services.demo_data_manager import is_demo_data_enabled


class IntegrationStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    PENDING = "pending"
    ERROR = "error"
    EXPIRED = "expired"
    RATE_LIMITED = "rate_limited"


class IntegrationCategory(str, Enum):
    COMMUNICATION = "communication"
    DEVELOPMENT = "development"
    PRODUCTIVITY = "productivity"
    SMART_HOME = "smart_home"
    MEDIA = "media"
    CLOUD = "cloud"
    ANALYTICS = "analytics"
    SECURITY = "security"
    AI = "ai"
    CUSTOM = "custom"


class WebhookEvent(str, Enum):
    ALL = "*"
    TASK_CREATED = "task.created"
    TASK_COMPLETED = "task.completed"
    AGENT_QUERY = "agent.query"
    AGENT_RESPONSE = "agent.response"
    AUTOMATION_TRIGGERED = "automation.triggered"
    ALERT_FIRED = "alert.fired"
    DEPLOYMENT_COMPLETED = "deployment.completed"
    MODEL_TRAINED = "model.trained"
    HEALTH_CHECK_FAILED = "health.check_failed"
    USER_LOGIN = "user.login"


@dataclass
class OAuthConfig:
    client_id: str = ""
    client_secret: str = ""  # Encrypted in production
    redirect_uri: str = ""
    auth_url: str = ""
    token_url: str = ""
    scopes: List[str] = field(default_factory=list)
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[str] = None


@dataclass
class WebhookConfig:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    url: str = ""
    secret: str = field(default_factory=lambda: hashlib.sha256(uuid.uuid4().bytes).hexdigest()[:32])
    events: List[str] = field(default_factory=lambda: ["*"])
    active: bool = True
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    last_triggered: Optional[str] = None
    delivery_count: int = 0
    failure_count: int = 0
    retry_on_failure: bool = True
    max_retries: int = 3
    headers: Dict[str, str] = field(default_factory=dict)


@dataclass
class WebhookDelivery:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    webhook_id: str = ""
    event: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)
    response_code: Optional[int] = None
    response_body: str = ""
    success: bool = False
    duration_ms: float = 0
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    attempt: int = 1


@dataclass
class Integration:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    provider: str = ""
    category: IntegrationCategory = IntegrationCategory.CUSTOM
    status: IntegrationStatus = IntegrationStatus.DISCONNECTED
    icon: str = ""
    color: str = "#8B5CF6"
    website: str = ""
    documentation_url: str = ""
    version: str = "1.0.0"
    enabled: bool = False
    config: Dict[str, Any] = field(default_factory=dict)
    oauth: Optional[OAuthConfig] = None
    webhooks: List[WebhookConfig] = field(default_factory=list)
    api_key: Optional[str] = None
    base_url: str = ""
    rate_limit: Optional[int] = None  # requests per minute
    rate_limit_remaining: Optional[int] = None
    capabilities: List[str] = field(default_factory=list)
    required_scopes: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    last_sync: Optional[str] = None
    sync_interval_minutes: int = 60
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    events_received: int = 0
    events_sent: int = 0


class IntegrationService:
    """Manages third-party integrations, OAuth, webhooks, and API connections."""

    def __init__(self):
        self.integrations: Dict[str, Integration] = {}
        self.webhook_deliveries: List[WebhookDelivery] = []
        if is_demo_data_enabled():
            self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Create sample integrations."""
        integrations = [
            {
                "name": "Slack",
                "description": "Team communication and notifications",
                "provider": "slack",
                "category": IntegrationCategory.COMMUNICATION,
                "status": IntegrationStatus.CONNECTED,
                "icon": "slack",
                "color": "#4A154B",
                "website": "https://slack.com",
                "capabilities": ["send_message", "receive_events", "channels", "files"],
                "enabled": True,
                "events_received": 1245,
                "events_sent": 892,
                "rate_limit": 100,
                "rate_limit_remaining": 87,
            },
            {
                "name": "GitHub",
                "description": "Code repository and CI/CD integration",
                "provider": "github",
                "category": IntegrationCategory.DEVELOPMENT,
                "status": IntegrationStatus.CONNECTED,
                "icon": "github",
                "color": "#24292E",
                "website": "https://github.com",
                "capabilities": ["repos", "issues", "pull_requests", "actions", "webhooks"],
                "enabled": True,
                "events_received": 3421,
                "events_sent": 156,
                "rate_limit": 5000,
                "rate_limit_remaining": 4823,
            },
            {
                "name": "Home Assistant",
                "description": "Smart home automation platform",
                "provider": "home_assistant",
                "category": IntegrationCategory.SMART_HOME,
                "status": IntegrationStatus.CONNECTED,
                "icon": "home",
                "color": "#41BDF5",
                "website": "https://home-assistant.io",
                "capabilities": ["devices", "automations", "scenes", "sensors", "switches"],
                "enabled": True,
                "events_received": 15680,
                "events_sent": 2341,
            },
            {
                "name": "OpenAI",
                "description": "GPT models and embeddings API",
                "provider": "openai",
                "category": IntegrationCategory.AI,
                "status": IntegrationStatus.CONNECTED,
                "icon": "bot",
                "color": "#10A37F",
                "website": "https://openai.com",
                "capabilities": ["chat", "completions", "embeddings", "images", "audio"],
                "enabled": True,
                "events_sent": 5642,
                "rate_limit": 3500,
                "rate_limit_remaining": 3100,
            },
            {
                "name": "Google Calendar",
                "description": "Calendar events and scheduling",
                "provider": "google_calendar",
                "category": IntegrationCategory.PRODUCTIVITY,
                "status": IntegrationStatus.CONNECTED,
                "icon": "calendar",
                "color": "#4285F4",
                "website": "https://calendar.google.com",
                "capabilities": ["events", "reminders", "shared_calendars"],
                "enabled": True,
                "events_received": 342,
                "events_sent": 89,
            },
            {
                "name": "AWS S3",
                "description": "Cloud storage for backups and media",
                "provider": "aws_s3",
                "category": IntegrationCategory.CLOUD,
                "status": IntegrationStatus.CONNECTED,
                "icon": "cloud",
                "color": "#FF9900",
                "website": "https://aws.amazon.com/s3",
                "capabilities": ["upload", "download", "list", "presigned_urls"],
                "enabled": True,
                "events_sent": 1256,
            },
            {
                "name": "Spotify",
                "description": "Music streaming and playback control",
                "provider": "spotify",
                "category": IntegrationCategory.MEDIA,
                "status": IntegrationStatus.DISCONNECTED,
                "icon": "music",
                "color": "#1DB954",
                "website": "https://spotify.com",
                "capabilities": ["playback", "playlists", "search", "recommendations"],
                "enabled": False,
            },
            {
                "name": "Grafana",
                "description": "Monitoring dashboards and alerting",
                "provider": "grafana",
                "category": IntegrationCategory.ANALYTICS,
                "status": IntegrationStatus.ERROR,
                "icon": "bar-chart",
                "color": "#F46800",
                "website": "https://grafana.com",
                "capabilities": ["dashboards", "alerts", "annotations"],
                "enabled": True,
                "error_message": "Authentication token expired",
            },
            {
                "name": "Telegram",
                "description": "Bot messaging and notifications",
                "provider": "telegram",
                "category": IntegrationCategory.COMMUNICATION,
                "status": IntegrationStatus.CONNECTED,
                "icon": "send",
                "color": "#26A5E4",
                "website": "https://telegram.org",
                "capabilities": ["send_message", "receive_commands", "inline_queries"],
                "enabled": True,
                "events_received": 567,
                "events_sent": 234,
            },
            {
                "name": "Datadog",
                "description": "Infrastructure monitoring and APM",
                "provider": "datadog",
                "category": IntegrationCategory.ANALYTICS,
                "status": IntegrationStatus.PENDING,
                "icon": "activity",
                "color": "#632CA6",
                "website": "https://datadoghq.com",
                "capabilities": ["metrics", "traces", "logs", "alerts"],
                "enabled": False,
            },
            {
                "name": "Cloudflare",
                "description": "DNS, CDN, and security services",
                "provider": "cloudflare",
                "category": IntegrationCategory.SECURITY,
                "status": IntegrationStatus.CONNECTED,
                "icon": "shield",
                "color": "#F38020",
                "website": "https://cloudflare.com",
                "capabilities": ["dns", "firewall", "analytics", "workers"],
                "enabled": True,
                "events_received": 890,
            },
            {
                "name": "MQTT Broker",
                "description": "IoT device message broker",
                "provider": "mqtt",
                "category": IntegrationCategory.SMART_HOME,
                "status": IntegrationStatus.CONNECTED,
                "icon": "radio",
                "color": "#660066",
                "capabilities": ["publish", "subscribe", "topics", "qos"],
                "enabled": True,
                "events_received": 45230,
                "events_sent": 12450,
            },
        ]

        for data in integrations:
            integration = Integration(
                name=data["name"],
                description=data["description"],
                provider=data["provider"],
                category=data["category"],
                status=data["status"],
                icon=data.get("icon", ""),
                color=data.get("color", "#8B5CF6"),
                website=data.get("website", ""),
                capabilities=data.get("capabilities", []),
                enabled=data.get("enabled", False),
                events_received=data.get("events_received", 0),
                events_sent=data.get("events_sent", 0),
                rate_limit=data.get("rate_limit"),
                rate_limit_remaining=data.get("rate_limit_remaining"),
                error_message=data.get("error_message"),
                last_sync=datetime.now().isoformat() if data["status"] == IntegrationStatus.CONNECTED else None,
            )
            # Add a sample webhook for connected integrations
            if integration.status == IntegrationStatus.CONNECTED:
                wh = WebhookConfig(
                    url=f"https://hooks.nexus.local/webhooks/{integration.provider}",
                    events=["*"],
                    delivery_count=integration.events_received,
                )
                integration.webhooks.append(wh)

            self.integrations[integration.id] = integration

    def list_integrations(
        self,
        category: Optional[IntegrationCategory] = None,
        status: Optional[IntegrationStatus] = None,
        enabled: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List all integrations with optional filtering."""
        results = list(self.integrations.values())

        if category:
            results = [i for i in results if i.category == category]
        if status:
            results = [i for i in results if i.status == status]
        if enabled is not None:
            results = [i for i in results if i.enabled == enabled]
        if search:
            q = search.lower()
            results = [i for i in results if q in i.name.lower() or q in i.description.lower() or q in i.provider.lower()]

        return [asdict(i) for i in results]

    def get_integration(self, integration_id: str) -> Optional[Dict[str, Any]]:
        """Get integration details."""
        integration = self.integrations.get(integration_id)
        return asdict(integration) if integration else None

    def create_integration(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new custom integration."""
        integration = Integration(
            name=data.get("name", "Custom Integration"),
            description=data.get("description", ""),
            provider=data.get("provider", "custom"),
            category=IntegrationCategory(data.get("category", "custom")),
            base_url=data.get("base_url", ""),
            api_key=data.get("api_key"),
            capabilities=data.get("capabilities", []),
        )
        self.integrations[integration.id] = integration
        return asdict(integration)

    def update_integration(self, integration_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update integration configuration."""
        integration = self.integrations.get(integration_id)
        if not integration:
            return None

        for key in ["name", "description", "base_url", "api_key", "config",
                     "sync_interval_minutes", "enabled", "rate_limit"]:
            if key in data:
                setattr(integration, key, data[key])

        integration.updated_at = datetime.now().isoformat()
        return asdict(integration)

    def delete_integration(self, integration_id: str) -> bool:
        """Delete an integration."""
        if integration_id in self.integrations:
            del self.integrations[integration_id]
            return True
        return False

    def connect(self, integration_id: str) -> Optional[Dict[str, Any]]:
        """Connect/activate an integration."""
        integration = self.integrations.get(integration_id)
        if not integration:
            return None
        integration.status = IntegrationStatus.CONNECTED
        integration.enabled = True
        integration.last_sync = datetime.now().isoformat()
        integration.error_message = None
        integration.updated_at = datetime.now().isoformat()
        return asdict(integration)

    def disconnect(self, integration_id: str) -> Optional[Dict[str, Any]]:
        """Disconnect an integration."""
        integration = self.integrations.get(integration_id)
        if not integration:
            return None
        integration.status = IntegrationStatus.DISCONNECTED
        integration.enabled = False
        integration.updated_at = datetime.now().isoformat()
        return asdict(integration)

    def test_connection(self, integration_id: str) -> Dict[str, Any]:
        """Test integration connection."""
        integration = self.integrations.get(integration_id)
        if not integration:
            return {"success": False, "error": "Integration not found"}

        # Simulate connection test
        success = integration.status == IntegrationStatus.CONNECTED
        return {
            "success": success,
            "latency_ms": 45.2 if success else None,
            "message": "Connection successful" if success else "Connection failed",
            "timestamp": datetime.now().isoformat(),
        }

    def sync(self, integration_id: str) -> Optional[Dict[str, Any]]:
        """Trigger a manual sync for an integration."""
        integration = self.integrations.get(integration_id)
        if not integration:
            return None
        integration.last_sync = datetime.now().isoformat()
        return {
            "integration_id": integration_id,
            "status": "syncing",
            "last_sync": integration.last_sync,
        }

    # Webhook Management
    def create_webhook(self, integration_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a webhook for an integration."""
        integration = self.integrations.get(integration_id)
        if not integration:
            return None

        webhook = WebhookConfig(
            url=data.get("url", ""),
            events=data.get("events", ["*"]),
            headers=data.get("headers", {}),
            retry_on_failure=data.get("retry_on_failure", True),
            max_retries=data.get("max_retries", 3),
        )
        integration.webhooks.append(webhook)
        return asdict(webhook)

    def list_webhooks(self, integration_id: str) -> List[Dict[str, Any]]:
        """List webhooks for an integration."""
        integration = self.integrations.get(integration_id)
        if not integration:
            return []
        return [asdict(wh) for wh in integration.webhooks]

    def delete_webhook(self, integration_id: str, webhook_id: str) -> bool:
        """Delete a webhook."""
        integration = self.integrations.get(integration_id)
        if not integration:
            return False
        original = len(integration.webhooks)
        integration.webhooks = [wh for wh in integration.webhooks if wh.id != webhook_id]
        return len(integration.webhooks) < original

    async def deliver_webhook(self, webhook: WebhookConfig, event: str, payload: Dict[str, Any]) -> WebhookDelivery:
        """Deliver a webhook event (simulated)."""
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event=event,
            payload=payload,
            response_code=200,
            success=True,
            duration_ms=45.0,
        )
        webhook.delivery_count += 1
        webhook.last_triggered = datetime.now().isoformat()
        self.webhook_deliveries.append(delivery)
        return delivery

    def get_webhook_deliveries(self, webhook_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get delivery history for a webhook."""
        deliveries = [d for d in self.webhook_deliveries if d.webhook_id == webhook_id]
        deliveries.sort(key=lambda d: d.timestamp, reverse=True)
        return [asdict(d) for d in deliveries[:limit]]

    def get_stats(self) -> Dict[str, Any]:
        """Get integration statistics."""
        integrations = list(self.integrations.values())
        return {
            "total": len(integrations),
            "connected": sum(1 for i in integrations if i.status == IntegrationStatus.CONNECTED),
            "disconnected": sum(1 for i in integrations if i.status == IntegrationStatus.DISCONNECTED),
            "error": sum(1 for i in integrations if i.status == IntegrationStatus.ERROR),
            "pending": sum(1 for i in integrations if i.status == IntegrationStatus.PENDING),
            "total_events_received": sum(i.events_received for i in integrations),
            "total_events_sent": sum(i.events_sent for i in integrations),
            "total_webhooks": sum(len(i.webhooks) for i in integrations),
            "by_category": dict(defaultdict(int, {i.category.value: 1 for i in integrations})),
        }

    def get_available_events(self) -> List[Dict[str, str]]:
        """Get list of available webhook events."""
        return [
            {"event": e.value, "description": e.name.replace("_", " ").title()}
            for e in WebhookEvent
        ]


# Singleton
_integration_service: Optional[IntegrationService] = None


def get_integration_service() -> IntegrationService:
    global _integration_service
    if _integration_service is None:
        _integration_service = IntegrationService()
    return _integration_service
