"""
Audit Log Service - Comprehensive system event tracking and compliance logging.
Tracks all actions, provides search/filter, retention policies, and export capabilities.
"""

import asyncio
import hashlib
import json
import os
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict


class AuditSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AuditCategory(str, Enum):
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    CONFIGURATION = "configuration"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    SYSTEM = "system"
    SECURITY = "security"
    DEPLOYMENT = "deployment"
    AI_AGENT = "ai_agent"
    AUTOMATION = "automation"
    NETWORK = "network"
    API = "api"
    USER_MANAGEMENT = "user_management"


@dataclass
class AuditEntry:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    action: str = ""
    resource: str = ""
    resource_id: Optional[str] = None
    user: str = "system"
    user_role: str = "admin"
    ip_address: str = "127.0.0.1"
    user_agent: Optional[str] = None
    severity: AuditSeverity = AuditSeverity.INFO
    category: AuditCategory = AuditCategory.SYSTEM
    details: str = ""
    success: bool = True
    error_message: Optional[str] = None
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    response_code: Optional[int] = None
    duration_ms: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    correlation_id: Optional[str] = None
    session_id: Optional[str] = None
    checksum: str = ""

    def __post_init__(self):
        if not self.checksum:
            self.checksum = self._compute_checksum()

    def _compute_checksum(self) -> str:
        """Compute integrity checksum for tamper detection."""
        content = f"{self.timestamp}|{self.action}|{self.resource}|{self.user}|{self.details}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def verify_integrity(self) -> bool:
        """Verify the audit entry hasn't been tampered with."""
        return self.checksum == self._compute_checksum()


@dataclass
class RetentionPolicy:
    name: str
    category: Optional[AuditCategory] = None
    severity: Optional[AuditSeverity] = None
    retention_days: int = 90
    archive_after_days: int = 30
    compress: bool = True
    enabled: bool = True


@dataclass
class AuditFilter:
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    user: Optional[str] = None
    action: Optional[str] = None
    resource: Optional[str] = None
    category: Optional[AuditCategory] = None
    severity: Optional[AuditSeverity] = None
    success: Optional[bool] = None
    ip_address: Optional[str] = None
    search_text: Optional[str] = None
    tags: Optional[List[str]] = None
    limit: int = 100
    offset: int = 0


class AuditAnalytics:
    """Computes analytics over audit log data."""

    @staticmethod
    def events_by_category(entries: List[AuditEntry]) -> Dict[str, int]:
        counts: Dict[str, int] = defaultdict(int)
        for e in entries:
            counts[e.category.value] += 1
        return dict(sorted(counts.items(), key=lambda x: -x[1]))

    @staticmethod
    def events_by_severity(entries: List[AuditEntry]) -> Dict[str, int]:
        counts: Dict[str, int] = defaultdict(int)
        for e in entries:
            counts[e.severity.value] += 1
        return dict(counts)

    @staticmethod
    def events_by_user(entries: List[AuditEntry]) -> Dict[str, int]:
        counts: Dict[str, int] = defaultdict(int)
        for e in entries:
            counts[e.user] += 1
        return dict(sorted(counts.items(), key=lambda x: -x[1])[:20])

    @staticmethod
    def events_by_hour(entries: List[AuditEntry]) -> List[Dict[str, Any]]:
        hourly: Dict[int, int] = defaultdict(int)
        for e in entries:
            try:
                hour = datetime.fromisoformat(e.timestamp).hour
                hourly[hour] += 1
            except (ValueError, AttributeError):
                pass
        return [{"hour": h, "count": hourly.get(h, 0)} for h in range(24)]

    @staticmethod
    def failure_rate(entries: List[AuditEntry]) -> float:
        if not entries:
            return 0.0
        failures = sum(1 for e in entries if not e.success)
        return round(failures / len(entries) * 100, 2)

    @staticmethod
    def top_ips(entries: List[AuditEntry], limit: int = 10) -> List[Dict[str, Any]]:
        counts: Dict[str, int] = defaultdict(int)
        for e in entries:
            counts[e.ip_address] += 1
        sorted_ips = sorted(counts.items(), key=lambda x: -x[1])[:limit]
        return [{"ip": ip, "count": count} for ip, count in sorted_ips]

    @staticmethod
    def security_summary(entries: List[AuditEntry]) -> Dict[str, Any]:
        security_events = [e for e in entries if e.category == AuditCategory.SECURITY]
        auth_failures = [e for e in entries if e.category == AuditCategory.AUTHENTICATION and not e.success]
        critical_events = [e for e in entries if e.severity == AuditSeverity.CRITICAL]
        return {
            "total_security_events": len(security_events),
            "auth_failures": len(auth_failures),
            "critical_events": len(critical_events),
            "unique_ips_with_failures": len(set(e.ip_address for e in auth_failures)),
            "most_recent_critical": critical_events[-1].timestamp if critical_events else None,
        }


class AuditLogService:
    """Manages audit log entries with search, analytics, retention, and export."""

    def __init__(self):
        self.entries: List[AuditEntry] = []
        self.retention_policies: List[RetentionPolicy] = [
            RetentionPolicy("default", retention_days=90),
            RetentionPolicy("security", category=AuditCategory.SECURITY, retention_days=365),
            RetentionPolicy("critical", severity=AuditSeverity.CRITICAL, retention_days=365),
            RetentionPolicy("auth", category=AuditCategory.AUTHENTICATION, retention_days=180),
        ]
        self.analytics = AuditAnalytics()
        self._subscribers: List[Any] = []
        self._max_entries = 100000
        self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Generate realistic sample audit entries."""
        now = datetime.now()
        sample_events = [
            (AuditCategory.AUTHENTICATION, "login", "auth/session", "admin", AuditSeverity.INFO, True, "Successful login via password", {"browser": "Chrome 122", "os": "Windows 11"}),
            (AuditCategory.CONFIGURATION, "update_config", "system/config", "admin", AuditSeverity.WARNING, True, "Modified MQTT broker settings", {"field": "mqtt.broker_url"}),
            (AuditCategory.AUTHENTICATION, "failed_login", "auth/session", "unknown", AuditSeverity.ERROR, False, "Failed login - invalid credentials", {"attempts": "3"}),
            (AuditCategory.AI_AGENT, "agent_query", "agents/orchestrator", "admin", AuditSeverity.INFO, True, "Processed: Check home security", {"agent": "security_agent", "duration": "1.2s"}),
            (AuditCategory.DEPLOYMENT, "deploy", "deployments/nexus-api", "admin", AuditSeverity.INFO, True, "Deployed nexus-api v2.1.0", {"version": "2.1.0", "env": "production"}),
            (AuditCategory.DATA_ACCESS, "backup_create", "database/backup", "system", AuditSeverity.INFO, True, "Automated backup completed", {"size": "245 MB"}),
            (AuditCategory.AUTHORIZATION, "permission_change", "users/roles", "admin", AuditSeverity.WARNING, True, "Modified operator role permissions", {"role": "operator"}),
            (AuditCategory.API, "rate_limit", "api/gateway", "api-user-3", AuditSeverity.WARNING, False, "Rate limit exceeded - 429 sent", {"limit": "100/min"}),
            (AuditCategory.SECURITY, "intrusion_detected", "security/ids", "system", AuditSeverity.CRITICAL, False, "Port scan detected from external IP", {"ports": "22,80,443"}),
            (AuditCategory.AI_AGENT, "model_retrain", "ml/models", "system", AuditSeverity.INFO, True, "Retraining nexus-nlp-v3", {"model": "nexus-nlp-v3"}),
            (AuditCategory.AUTOMATION, "automation_trigger", "automations/scene-3", "system", AuditSeverity.INFO, True, "Triggered Evening Mode", {"devices": "5"}),
            (AuditCategory.DATA_ACCESS, "data_export", "reports/export", "admin", AuditSeverity.INFO, True, "Exported health analytics as PDF", {"format": "PDF"}),
            (AuditCategory.SECURITY, "ssl_cert_expiring", "security/certificates", "system", AuditSeverity.WARNING, True, "SSL cert expires in 15 days", {"domain": "nexus.local"}),
            (AuditCategory.SYSTEM, "health_check", "system/health", "system", AuditSeverity.INFO, True, "All services healthy 12/12", {"uptime": "99.97%"}),
            (AuditCategory.AUTHENTICATION, "token_revoke", "auth/tokens", "admin", AuditSeverity.WARNING, True, "Revoked API token", {"device": "ESP32-old"}),
            (AuditCategory.NETWORK, "device_connected", "network/devices", "system", AuditSeverity.INFO, True, "New device connected: ESP32-Living", {"mac": "AA:BB:CC:DD:EE:01"}),
            (AuditCategory.DATA_MODIFICATION, "record_update", "database/users", "admin", AuditSeverity.INFO, True, "Updated user profile settings", {"user_id": "usr_42"}),
            (AuditCategory.USER_MANAGEMENT, "user_create", "users/accounts", "admin", AuditSeverity.INFO, True, "Created new user account", {"username": "operator1"}),
            (AuditCategory.API, "webhook_delivered", "integrations/webhooks", "system", AuditSeverity.INFO, True, "Webhook delivered to Slack", {"endpoint": "slack.webhook.url"}),
            (AuditCategory.SECURITY, "firewall_rule_added", "security/firewall", "admin", AuditSeverity.WARNING, True, "Added firewall rule blocking 198.51.100.0/24", {"action": "block"}),
        ]

        ips = ["192.168.1.100", "192.168.1.101", "10.0.0.15", "localhost", "203.0.113.42", "198.51.100.14"]

        for i, (cat, action, resource, user, severity, success, details, meta) in enumerate(sample_events):
            entry = AuditEntry(
                timestamp=(now - timedelta(minutes=i * 5)).isoformat(),
                action=action,
                resource=resource,
                user=user,
                ip_address=ips[i % len(ips)],
                severity=severity,
                category=cat,
                details=details,
                success=success,
                metadata=meta,
                duration_ms=round(50 + i * 12.5, 1),
                tags=[cat.value, severity.value],
                session_id=f"sess_{i:03d}",
            )
            self.entries.append(entry)

    async def log(
        self,
        action: str,
        resource: str,
        user: str = "system",
        severity: AuditSeverity = AuditSeverity.INFO,
        category: AuditCategory = AuditCategory.SYSTEM,
        details: str = "",
        success: bool = True,
        ip_address: str = "127.0.0.1",
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        correlation_id: Optional[str] = None,
        **kwargs,
    ) -> AuditEntry:
        """Log a new audit entry."""
        entry = AuditEntry(
            action=action,
            resource=resource,
            user=user,
            severity=severity,
            category=category,
            details=details,
            success=success,
            ip_address=ip_address,
            metadata=metadata or {},
            tags=tags or [category.value],
            correlation_id=correlation_id,
            **kwargs,
        )
        self.entries.insert(0, entry)

        # Enforce max entries limit
        if len(self.entries) > self._max_entries:
            self.entries = self.entries[: self._max_entries]

        # Notify subscribers
        await self._notify_subscribers(entry)

        return entry

    async def _notify_subscribers(self, entry: AuditEntry):
        """Notify real-time subscribers of new entries."""
        for callback in self._subscribers:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(entry)
                else:
                    callback(entry)
            except Exception:
                pass

    def subscribe(self, callback):
        """Subscribe to audit events."""
        self._subscribers.append(callback)

    def unsubscribe(self, callback):
        """Unsubscribe from audit events."""
        self._subscribers = [cb for cb in self._subscribers if cb is not callback]

    def query(self, filter: AuditFilter) -> Tuple[List[AuditEntry], int]:
        """Query audit entries with filtering, returns (entries, total_count)."""
        results = list(self.entries)

        if filter.start_date:
            results = [e for e in results if e.timestamp >= filter.start_date]
        if filter.end_date:
            results = [e for e in results if e.timestamp <= filter.end_date]
        if filter.user:
            results = [e for e in results if e.user == filter.user]
        if filter.action:
            results = [e for e in results if filter.action.lower() in e.action.lower()]
        if filter.resource:
            results = [e for e in results if filter.resource.lower() in e.resource.lower()]
        if filter.category:
            results = [e for e in results if e.category == filter.category]
        if filter.severity:
            results = [e for e in results if e.severity == filter.severity]
        if filter.success is not None:
            results = [e for e in results if e.success == filter.success]
        if filter.ip_address:
            results = [e for e in results if e.ip_address == filter.ip_address]
        if filter.tags:
            results = [e for e in results if any(t in e.tags for t in filter.tags)]
        if filter.search_text:
            q = filter.search_text.lower()
            results = [e for e in results if q in e.details.lower() or q in e.action.lower() or q in e.resource.lower()]

        total = len(results)
        results = results[filter.offset : filter.offset + filter.limit]
        return results, total

    def get_entry(self, entry_id: str) -> Optional[AuditEntry]:
        """Get a single audit entry by ID."""
        for entry in self.entries:
            if entry.id == entry_id:
                return entry
        return None

    def get_analytics(self, hours: int = 24) -> Dict[str, Any]:
        """Get comprehensive analytics for the given time window."""
        cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
        recent = [e for e in self.entries if e.timestamp >= cutoff]

        return {
            "period_hours": hours,
            "total_events": len(recent),
            "by_category": self.analytics.events_by_category(recent),
            "by_severity": self.analytics.events_by_severity(recent),
            "by_user": self.analytics.events_by_user(recent),
            "by_hour": self.analytics.events_by_hour(recent),
            "failure_rate": self.analytics.failure_rate(recent),
            "top_ips": self.analytics.top_ips(recent),
            "security_summary": self.analytics.security_summary(recent),
        }

    def verify_integrity(self) -> Dict[str, Any]:
        """Verify integrity of all audit entries."""
        total = len(self.entries)
        valid = sum(1 for e in self.entries if e.verify_integrity())
        tampered = total - valid
        return {
            "total_entries": total,
            "valid_entries": valid,
            "tampered_entries": tampered,
            "integrity_pass": tampered == 0,
        }

    async def export_entries(
        self, fmt: str = "json", filter: Optional[AuditFilter] = None
    ) -> Dict[str, Any]:
        """Export audit entries in specified format."""
        if filter:
            entries, total = self.query(filter)
        else:
            entries = self.entries
            total = len(entries)

        data = [asdict(e) for e in entries]

        if fmt == "json":
            content = json.dumps(data, indent=2, default=str)
        elif fmt == "csv":
            if data:
                headers = list(data[0].keys())
                lines = [",".join(headers)]
                for row in data:
                    lines.append(",".join(str(row.get(h, "")) for h in headers))
                content = "\n".join(lines)
            else:
                content = ""
        else:
            content = json.dumps(data, default=str)

        return {
            "format": fmt,
            "total_entries": total,
            "exported_entries": len(data),
            "content_length": len(content),
            "content": content[:10000] if len(content) > 10000 else content,
        }

    async def apply_retention(self) -> Dict[str, Any]:
        """Apply retention policies to purge old entries."""
        now = datetime.now()
        original_count = len(self.entries)
        preserved = []

        for entry in self.entries:
            try:
                entry_time = datetime.fromisoformat(entry.timestamp)
            except (ValueError, AttributeError):
                preserved.append(entry)
                continue

            keep = False
            for policy in self.retention_policies:
                if not policy.enabled:
                    continue
                matches = True
                if policy.category and entry.category != policy.category:
                    matches = False
                if policy.severity and entry.severity != policy.severity:
                    matches = False
                if matches:
                    age = (now - entry_time).days
                    if age <= policy.retention_days:
                        keep = True
                        break

            # Default: keep if less than 90 days old
            if not keep:
                try:
                    age = (now - datetime.fromisoformat(entry.timestamp)).days
                    keep = age <= 90
                except (ValueError, AttributeError):
                    keep = True

            if keep:
                preserved.append(entry)

        self.entries = preserved
        purged = original_count - len(preserved)
        return {
            "original_count": original_count,
            "preserved_count": len(preserved),
            "purged_count": purged,
        }

    def get_retention_policies(self) -> List[Dict[str, Any]]:
        """Get all retention policies."""
        return [
            {
                "name": p.name,
                "category": p.category.value if p.category else None,
                "severity": p.severity.value if p.severity else None,
                "retention_days": p.retention_days,
                "archive_after_days": p.archive_after_days,
                "compress": p.compress,
                "enabled": p.enabled,
            }
            for p in self.retention_policies
        ]

    def add_retention_policy(self, policy: RetentionPolicy):
        """Add a new retention policy."""
        self.retention_policies.append(policy)

    def get_stats(self) -> Dict[str, Any]:
        """Get quick statistics."""
        return {
            "total_entries": len(self.entries),
            "categories": len(set(e.category for e in self.entries)),
            "unique_users": len(set(e.user for e in self.entries)),
            "unique_ips": len(set(e.ip_address for e in self.entries)),
            "failure_count": sum(1 for e in self.entries if not e.success),
            "critical_count": sum(1 for e in self.entries if e.severity == AuditSeverity.CRITICAL),
            "oldest_entry": min((e.timestamp for e in self.entries), default=None),
            "newest_entry": max((e.timestamp for e in self.entries), default=None),
        }


# Singleton
_audit_log_service: Optional[AuditLogService] = None


def get_audit_log_service() -> AuditLogService:
    global _audit_log_service
    if _audit_log_service is None:
        _audit_log_service = AuditLogService()
    return _audit_log_service
