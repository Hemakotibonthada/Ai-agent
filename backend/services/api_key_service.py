"""
API Key Management Service for Nexus AI
Manages API keys with scoping, rate limiting, and usage tracking
"""

import hashlib
import secrets
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
from services.demo_data_manager import is_demo_data_enabled


class KeyStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    EXPIRED = "expired"
    REVOKED = "revoked"
    RATE_LIMITED = "rate_limited"


class KeyEnvironment(str, Enum):
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"
    TESTING = "testing"


class RateLimitWindow(str, Enum):
    SECOND = "second"
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"


@dataclass
class RateLimitConfig:
    window: RateLimitWindow = RateLimitWindow.MINUTE
    max_requests: int = 1000
    burst_limit: int = 100
    retry_after_seconds: int = 60


@dataclass
class APIKeyScope:
    resource: str  # e.g., "agents", "chat", "tasks"
    actions: List[str] = field(default_factory=lambda: ["read"])  # read, write, delete, admin

    def allows(self, action: str) -> bool:
        return action in self.actions or "admin" in self.actions


@dataclass
class APIKey:
    key_id: str
    name: str
    prefix: str  # first 8 chars for identification
    key_hash: str  # SHA-256 hash of full key
    environment: KeyEnvironment
    status: KeyStatus
    scopes: List[APIKeyScope]
    rate_limit: RateLimitConfig
    created_at: str
    expires_at: Optional[str]
    last_used_at: Optional[str]
    created_by: str
    description: str = ""
    ip_whitelist: List[str] = field(default_factory=list)
    allowed_origins: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    total_requests: int = 0
    total_errors: int = 0
    tags: Dict[str, str] = field(default_factory=dict)

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return datetime.fromisoformat(self.expires_at.replace("Z", "+00:00")) < datetime.now()

    @property
    def is_active(self) -> bool:
        return self.status == KeyStatus.ACTIVE and not self.is_expired


@dataclass
class UsageRecord:
    key_id: str
    timestamp: str
    endpoint: str
    method: str
    status_code: int
    response_time_ms: float
    ip_address: str
    user_agent: str = ""
    request_size_bytes: int = 0
    response_size_bytes: int = 0
    error_message: Optional[str] = None


@dataclass
class UsageSummary:
    key_id: str
    period: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    average_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    total_request_bytes: int
    total_response_bytes: int
    unique_endpoints: int
    unique_ips: int
    top_endpoints: List[Dict[str, Any]] = field(default_factory=list)
    error_breakdown: Dict[int, int] = field(default_factory=dict)
    hourly_distribution: List[int] = field(default_factory=list)


class RateLimiter:
    """Token bucket rate limiter"""

    def __init__(self):
        self._buckets: Dict[str, Dict[str, Any]] = {}

    def check(self, key_id: str, config: RateLimitConfig) -> Tuple[bool, Dict[str, Any]]:
        now = time.time()
        bucket = self._buckets.get(key_id)

        window_seconds = {
            RateLimitWindow.SECOND: 1,
            RateLimitWindow.MINUTE: 60,
            RateLimitWindow.HOUR: 3600,
            RateLimitWindow.DAY: 86400,
        }[config.window]

        if bucket is None or now - bucket["window_start"] >= window_seconds:
            self._buckets[key_id] = {
                "window_start": now,
                "count": 1,
                "burst_count": 1,
                "burst_window_start": now,
            }
            return True, {
                "remaining": config.max_requests - 1,
                "limit": config.max_requests,
                "reset": int(now + window_seconds),
            }

        if bucket["count"] >= config.max_requests:
            return False, {
                "remaining": 0,
                "limit": config.max_requests,
                "reset": int(bucket["window_start"] + window_seconds),
                "retry_after": config.retry_after_seconds,
            }

        # Burst check
        if now - bucket.get("burst_window_start", now) < 1:
            if bucket.get("burst_count", 0) >= config.burst_limit:
                return False, {
                    "remaining": config.max_requests - bucket["count"],
                    "limit": config.max_requests,
                    "burst_limited": True,
                    "retry_after": 1,
                }
            bucket["burst_count"] = bucket.get("burst_count", 0) + 1
        else:
            bucket["burst_window_start"] = now
            bucket["burst_count"] = 1

        bucket["count"] += 1
        return True, {
            "remaining": config.max_requests - bucket["count"],
            "limit": config.max_requests,
            "reset": int(bucket["window_start"] + window_seconds),
        }

    def reset(self, key_id: str):
        self._buckets.pop(key_id, None)


class APIKeyService:
    """Comprehensive API key management service"""

    def __init__(self):
        self.keys: Dict[str, APIKey] = {}
        self.usage_records: Dict[str, List[UsageRecord]] = {}
        self.rate_limiter = RateLimiter()
        self._key_lookup: Dict[str, str] = {}  # hash -> key_id
        if is_demo_data_enabled():
            self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Initialize with sample API keys"""
        sample_keys = [
            APIKey(
                key_id="ak_001", name="Production Main API",
                prefix="nxs_prod", key_hash=hashlib.sha256(b"nxs_prod_abc123").hexdigest(),
                environment=KeyEnvironment.PRODUCTION, status=KeyStatus.ACTIVE,
                scopes=[
                    APIKeyScope("agents", ["read", "write"]),
                    APIKeyScope("chat", ["read", "write"]),
                    APIKeyScope("tasks", ["read", "write", "delete"]),
                    APIKeyScope("reports", ["read"]),
                ],
                rate_limit=RateLimitConfig(RateLimitWindow.MINUTE, 1000, 100, 60),
                created_at="2024-01-15T10:00:00Z",
                expires_at="2025-01-15T10:00:00Z",
                last_used_at="2024-03-20T14:32:00Z",
                created_by="admin@nexus.ai",
                description="Main production API key for Nexus services",
                ip_whitelist=["10.0.0.0/8", "172.16.0.0/12"],
                total_requests=1_245_890, total_errors=1234,
                tags={"team": "platform", "service": "core"},
            ),
            APIKey(
                key_id="ak_002", name="Analytics Pipeline",
                prefix="nxs_prod", key_hash=hashlib.sha256(b"nxs_prod_xyz789").hexdigest(),
                environment=KeyEnvironment.PRODUCTION, status=KeyStatus.ACTIVE,
                scopes=[
                    APIKeyScope("analytics", ["read", "write"]),
                    APIKeyScope("reports", ["read", "write"]),
                    APIKeyScope("pipelines", ["read", "write"]),
                ],
                rate_limit=RateLimitConfig(RateLimitWindow.MINUTE, 5000, 500, 30),
                created_at="2024-02-01T08:00:00Z",
                expires_at="2025-02-01T08:00:00Z",
                last_used_at="2024-03-20T14:30:00Z",
                created_by="analytics@nexus.ai",
                description="Analytics data pipeline ingestion key",
                total_requests=8_920_340, total_errors=452,
                tags={"team": "data", "service": "analytics"},
            ),
            APIKey(
                key_id="ak_003", name="Staging Test Key",
                prefix="nxs_stag", key_hash=hashlib.sha256(b"nxs_stag_test456").hexdigest(),
                environment=KeyEnvironment.STAGING, status=KeyStatus.ACTIVE,
                scopes=[
                    APIKeyScope("*", ["read", "write", "delete", "admin"]),
                ],
                rate_limit=RateLimitConfig(RateLimitWindow.MINUTE, 10000, 1000, 10),
                created_at="2024-02-15T12:00:00Z",
                expires_at="2024-12-31T23:59:59Z",
                last_used_at="2024-03-20T11:00:00Z",
                created_by="dev@nexus.ai",
                description="Full-access staging environment key",
                total_requests=345_000, total_errors=2100,
                tags={"team": "engineering"},
            ),
            APIKey(
                key_id="ak_004", name="Mobile App Key",
                prefix="nxs_prod", key_hash=hashlib.sha256(b"nxs_prod_mobile").hexdigest(),
                environment=KeyEnvironment.PRODUCTION, status=KeyStatus.ACTIVE,
                scopes=[
                    APIKeyScope("chat", ["read", "write"]),
                    APIKeyScope("agents", ["read"]),
                    APIKeyScope("notifications", ["read"]),
                    APIKeyScope("voice", ["read", "write"]),
                ],
                rate_limit=RateLimitConfig(RateLimitWindow.MINUTE, 500, 50, 120),
                created_at="2024-03-01T09:00:00Z",
                expires_at="2025-03-01T09:00:00Z",
                last_used_at="2024-03-20T14:25:00Z",
                created_by="mobile@nexus.ai",
                description="Mobile application API key",
                allowed_origins=["nexus://mobile", "https://mobile.nexus.ai"],
                total_requests=2_890_000, total_errors=890,
                tags={"team": "mobile", "platform": "ios,android"},
            ),
            APIKey(
                key_id="ak_005", name="CI/CD Pipeline",
                prefix="nxs_dev", key_hash=hashlib.sha256(b"nxs_dev_cicd").hexdigest(),
                environment=KeyEnvironment.DEVELOPMENT, status=KeyStatus.ACTIVE,
                scopes=[
                    APIKeyScope("deployments", ["read", "write"]),
                    APIKeyScope("experiments", ["read", "write"]),
                    APIKeyScope("feature_flags", ["read"]),
                ],
                rate_limit=RateLimitConfig(RateLimitWindow.HOUR, 2000, 200, 300),
                created_at="2024-01-20T15:00:00Z",
                expires_at=None,
                last_used_at="2024-03-20T13:45:00Z",
                created_by="devops@nexus.ai",
                description="CI/CD pipeline automation key",
                ip_whitelist=["192.168.1.0/24"],
                total_requests=156_000, total_errors=340,
                tags={"team": "devops", "service": "ci"},
            ),
            APIKey(
                key_id="ak_006", name="Webhook Receiver",
                prefix="nxs_prod", key_hash=hashlib.sha256(b"nxs_prod_webhook").hexdigest(),
                environment=KeyEnvironment.PRODUCTION, status=KeyStatus.ACTIVE,
                scopes=[
                    APIKeyScope("webhooks", ["write"]),
                    APIKeyScope("events", ["write"]),
                ],
                rate_limit=RateLimitConfig(RateLimitWindow.SECOND, 100, 20, 5),
                created_at="2024-02-10T11:00:00Z",
                expires_at="2025-02-10T11:00:00Z",
                last_used_at="2024-03-20T14:33:00Z",
                created_by="integrations@nexus.ai",
                description="Incoming webhook processing key",
                total_requests=4_560_000, total_errors=230,
                tags={"team": "platform", "type": "webhook"},
            ),
            APIKey(
                key_id="ak_007", name="Legacy API v1",
                prefix="nxs_prod", key_hash=hashlib.sha256(b"nxs_prod_legacy").hexdigest(),
                environment=KeyEnvironment.PRODUCTION, status=KeyStatus.INACTIVE,
                scopes=[
                    APIKeyScope("*", ["read"]),
                ],
                rate_limit=RateLimitConfig(RateLimitWindow.HOUR, 100, 10, 3600),
                created_at="2023-06-01T10:00:00Z",
                expires_at="2024-06-01T10:00:00Z",
                last_used_at="2024-01-15T08:00:00Z",
                created_by="admin@nexus.ai",
                description="Legacy API v1 key (deprecated)",
                total_requests=12_340_000, total_errors=45000,
                tags={"legacy": "true", "deprecated": "2024-01"},
            ),
            APIKey(
                key_id="ak_008", name="Partner Integration",
                prefix="nxs_prod", key_hash=hashlib.sha256(b"nxs_prod_partner").hexdigest(),
                environment=KeyEnvironment.PRODUCTION, status=KeyStatus.REVOKED,
                scopes=[
                    APIKeyScope("agents", ["read"]),
                    APIKeyScope("reports", ["read"]),
                ],
                rate_limit=RateLimitConfig(RateLimitWindow.MINUTE, 200, 20, 300),
                created_at="2024-01-10T14:00:00Z",
                expires_at="2025-01-10T14:00:00Z",
                last_used_at="2024-02-28T16:00:00Z",
                created_by="partnerships@nexus.ai",
                description="Revoked partner integration key",
                total_requests=89_000, total_errors=120,
                tags={"partner": "acme_corp", "revoked_reason": "contract_ended"},
            ),
        ]

        for key in sample_keys:
            self.keys[key.key_id] = key
            self._key_lookup[key.key_hash] = key.key_id

        # Generate sample usage records
        self._generate_usage_data()

    def _generate_usage_data(self):
        """Generate sample usage data for all keys"""
        endpoints = [
            "/api/v1/agents", "/api/v1/chat", "/api/v1/tasks",
            "/api/v1/reports", "/api/v1/analytics", "/api/v1/health",
        ]
        methods = ["GET", "POST", "PUT", "DELETE"]
        status_codes = [200, 200, 200, 200, 201, 204, 400, 401, 404, 500]

        import random
        random.seed(42)

        for key_id in list(self.keys.keys())[:4]:
            records = []
            for i in range(30):
                records.append(UsageRecord(
                    key_id=key_id,
                    timestamp=f"2024-03-20T{i % 24:02d}:{i % 60:02d}:00Z",
                    endpoint=random.choice(endpoints),
                    method=random.choice(methods),
                    status_code=random.choice(status_codes),
                    response_time_ms=round(random.uniform(5, 500), 1),
                    ip_address=f"10.0.{random.randint(0,255)}.{random.randint(1,254)}",
                    request_size_bytes=random.randint(100, 10000),
                    response_size_bytes=random.randint(200, 50000),
                ))
            self.usage_records[key_id] = records

    # ---- Key Management ----

    def list_keys(
        self,
        environment: Optional[KeyEnvironment] = None,
        status: Optional[KeyStatus] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """List API keys with filtering"""
        results = list(self.keys.values())

        if environment:
            results = [k for k in results if k.environment == environment]
        if status:
            results = [k for k in results if k.status == status]
        if search:
            search_lower = search.lower()
            results = [k for k in results if search_lower in k.name.lower() or search_lower in k.description.lower()]

        total = len(results)
        results.sort(key=lambda k: k.created_at, reverse=True)
        results = results[offset:offset + limit]

        return {
            "items": [self._key_to_dict(k) for k in results],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get_key(self, key_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific API key"""
        key = self.keys.get(key_id)
        return self._key_to_dict(key) if key else None

    def create_key(
        self,
        name: str,
        environment: KeyEnvironment,
        scopes: List[Dict[str, Any]],
        rate_limit: Optional[Dict[str, Any]] = None,
        expires_in_days: Optional[int] = None,
        description: str = "",
        ip_whitelist: Optional[List[str]] = None,
        allowed_origins: Optional[List[str]] = None,
        created_by: str = "system",
        tags: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Create a new API key"""
        # Generate secure key
        raw_key = f"nxs_{environment.value[:4]}_{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        prefix = raw_key[:12]

        key_id = f"ak_{secrets.token_hex(4)}"
        now = datetime.utcnow()

        expires_at = None
        if expires_in_days:
            expires_at = (now + timedelta(days=expires_in_days)).isoformat() + "Z"

        parsed_scopes = [
            APIKeyScope(resource=s.get("resource", "*"), actions=s.get("actions", ["read"]))
            for s in scopes
        ]

        rl = RateLimitConfig()
        if rate_limit:
            rl = RateLimitConfig(
                window=RateLimitWindow(rate_limit.get("window", "minute")),
                max_requests=rate_limit.get("max_requests", 1000),
                burst_limit=rate_limit.get("burst_limit", 100),
                retry_after_seconds=rate_limit.get("retry_after_seconds", 60),
            )

        api_key = APIKey(
            key_id=key_id, name=name, prefix=prefix, key_hash=key_hash,
            environment=environment, status=KeyStatus.ACTIVE,
            scopes=parsed_scopes, rate_limit=rl,
            created_at=now.isoformat() + "Z",
            expires_at=expires_at, last_used_at=None,
            created_by=created_by, description=description,
            ip_whitelist=ip_whitelist or [],
            allowed_origins=allowed_origins or [],
            tags=tags or {},
        )

        self.keys[key_id] = api_key
        self._key_lookup[key_hash] = key_id

        result = self._key_to_dict(api_key)
        result["raw_key"] = raw_key  # Only returned on creation
        return result

    def rotate_key(self, key_id: str, expire_old_in_hours: int = 24) -> Optional[Dict[str, Any]]:
        """Rotate an API key - creates a new one and schedules old for expiry"""
        old_key = self.keys.get(key_id)
        if not old_key:
            return None

        # Create new key with same config
        new_key_result = self.create_key(
            name=old_key.name,
            environment=old_key.environment,
            scopes=[{"resource": s.resource, "actions": s.actions} for s in old_key.scopes],
            description=f"Rotated from {key_id}: {old_key.description}",
            ip_whitelist=old_key.ip_whitelist,
            allowed_origins=old_key.allowed_origins,
            created_by=old_key.created_by,
            tags={**old_key.tags, "rotated_from": key_id},
        )

        # Schedule old key to expire
        old_key.expires_at = (datetime.utcnow() + timedelta(hours=expire_old_in_hours)).isoformat() + "Z"
        old_key.metadata["rotated_to"] = new_key_result.get("key_id")
        old_key.metadata["rotation_date"] = datetime.utcnow().isoformat() + "Z"

        return {
            "old_key_id": key_id,
            "new_key": new_key_result,
            "old_key_expires_at": old_key.expires_at,
        }

    def revoke_key(self, key_id: str, reason: str = "") -> bool:
        """Revoke an API key"""
        key = self.keys.get(key_id)
        if not key:
            return False

        key.status = KeyStatus.REVOKED
        key.metadata["revoked_at"] = datetime.utcnow().isoformat() + "Z"
        key.metadata["revoke_reason"] = reason
        self.rate_limiter.reset(key_id)
        return True

    def update_key(self, key_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update API key properties"""
        key = self.keys.get(key_id)
        if not key:
            return None

        if "name" in updates:
            key.name = updates["name"]
        if "description" in updates:
            key.description = updates["description"]
        if "status" in updates:
            key.status = KeyStatus(updates["status"])
        if "ip_whitelist" in updates:
            key.ip_whitelist = updates["ip_whitelist"]
        if "allowed_origins" in updates:
            key.allowed_origins = updates["allowed_origins"]
        if "tags" in updates:
            key.tags = updates["tags"]
        if "scopes" in updates:
            key.scopes = [
                APIKeyScope(resource=s["resource"], actions=s.get("actions", ["read"]))
                for s in updates["scopes"]
            ]
        if "rate_limit" in updates:
            rl = updates["rate_limit"]
            key.rate_limit = RateLimitConfig(
                window=RateLimitWindow(rl.get("window", key.rate_limit.window.value)),
                max_requests=rl.get("max_requests", key.rate_limit.max_requests),
                burst_limit=rl.get("burst_limit", key.rate_limit.burst_limit),
                retry_after_seconds=rl.get("retry_after_seconds", key.rate_limit.retry_after_seconds),
            )

        return self._key_to_dict(key)

    def delete_key(self, key_id: str) -> bool:
        """Permanently delete an API key"""
        key = self.keys.pop(key_id, None)
        if key:
            self._key_lookup.pop(key.key_hash, None)
            self.usage_records.pop(key_id, None)
            self.rate_limiter.reset(key_id)
            return True
        return False

    # ---- Authentication ----

    def authenticate(self, raw_key: str, endpoint: str = "", ip: str = "") -> Tuple[bool, Dict[str, Any]]:
        """Authenticate request with API key"""
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        key_id = self._key_lookup.get(key_hash)

        if not key_id:
            return False, {"error": "Invalid API key"}

        key = self.keys.get(key_id)
        if not key:
            return False, {"error": "Key not found"}

        if not key.is_active:
            return False, {"error": f"Key is {key.status.value}"}

        if key.ip_whitelist and ip:
            # Simplified IP check
            if not any(ip.startswith(allowed.split("/")[0].rsplit(".", 1)[0]) for allowed in key.ip_whitelist):
                return False, {"error": "IP not whitelisted"}

        # Rate limit check
        allowed, limit_info = self.rate_limiter.check(key_id, key.rate_limit)
        if not allowed:
            return False, {"error": "Rate limit exceeded", **limit_info}

        # Update usage
        key.last_used_at = datetime.utcnow().isoformat() + "Z"
        key.total_requests += 1

        return True, {"key_id": key_id, "scopes": [asdict(s) for s in key.scopes], **limit_info}

    # ---- Usage Analytics ----

    def get_usage_summary(self, key_id: str, period: str = "24h") -> Optional[Dict[str, Any]]:
        """Get usage summary for a key"""
        if key_id not in self.keys:
            return None

        records = self.usage_records.get(key_id, [])
        if not records:
            return asdict(UsageSummary(
                key_id=key_id, period=period,
                total_requests=0, successful_requests=0, failed_requests=0,
                average_response_time_ms=0, p95_response_time_ms=0, p99_response_time_ms=0,
                total_request_bytes=0, total_response_bytes=0,
                unique_endpoints=0, unique_ips=0,
            ))

        response_times = sorted([r.response_time_ms for r in records])
        successful = [r for r in records if 200 <= r.status_code < 400]
        failed = [r for r in records if r.status_code >= 400]

        # Top endpoints
        endpoint_counts: Dict[str, int] = {}
        for r in records:
            endpoint_counts[r.endpoint] = endpoint_counts.get(r.endpoint, 0) + 1
        top_endpoints = [
            {"endpoint": ep, "count": count}
            for ep, count in sorted(endpoint_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        # Error breakdown
        error_breakdown: Dict[int, int] = {}
        for r in failed:
            error_breakdown[r.status_code] = error_breakdown.get(r.status_code, 0) + 1

        # Hourly distribution
        hourly = [0] * 24
        for r in records:
            try:
                hour = int(r.timestamp[11:13])
                hourly[hour] += 1
            except (ValueError, IndexError):
                pass

        summary = UsageSummary(
            key_id=key_id, period=period,
            total_requests=len(records),
            successful_requests=len(successful),
            failed_requests=len(failed),
            average_response_time_ms=round(sum(response_times) / len(response_times), 1),
            p95_response_time_ms=response_times[int(len(response_times) * 0.95)] if response_times else 0,
            p99_response_time_ms=response_times[int(len(response_times) * 0.99)] if response_times else 0,
            total_request_bytes=sum(r.request_size_bytes for r in records),
            total_response_bytes=sum(r.response_size_bytes for r in records),
            unique_endpoints=len(set(r.endpoint for r in records)),
            unique_ips=len(set(r.ip_address for r in records)),
            top_endpoints=top_endpoints,
            error_breakdown=error_breakdown,
            hourly_distribution=hourly,
        )

        return asdict(summary)

    def get_aggregated_stats(self) -> Dict[str, Any]:
        """Get aggregated statistics across all keys"""
        all_keys = list(self.keys.values())
        active_keys = [k for k in all_keys if k.is_active]

        total_requests = sum(k.total_requests for k in all_keys)
        total_errors = sum(k.total_errors for k in all_keys)

        return {
            "total_keys": len(all_keys),
            "active_keys": len(active_keys),
            "revoked_keys": len([k for k in all_keys if k.status == KeyStatus.REVOKED]),
            "expired_keys": len([k for k in all_keys if k.is_expired]),
            "total_requests": total_requests,
            "total_errors": total_errors,
            "error_rate": round(total_errors / max(total_requests, 1) * 100, 2),
            "by_environment": {
                env.value: len([k for k in all_keys if k.environment == env])
                for env in KeyEnvironment
            },
            "by_status": {
                s.value: len([k for k in all_keys if k.status == s])
                for s in KeyStatus
            },
            "most_used": sorted(
                [{"key_id": k.key_id, "name": k.name, "requests": k.total_requests} for k in all_keys],
                key=lambda x: x["requests"], reverse=True
            )[:5],
        }

    # ---- Helpers ----

    def _key_to_dict(self, key: APIKey) -> Dict[str, Any]:
        return {
            "key_id": key.key_id,
            "name": key.name,
            "prefix": key.prefix,
            "environment": key.environment.value,
            "status": key.status.value,
            "scopes": [asdict(s) for s in key.scopes],
            "rate_limit": asdict(key.rate_limit),
            "created_at": key.created_at,
            "expires_at": key.expires_at,
            "last_used_at": key.last_used_at,
            "created_by": key.created_by,
            "description": key.description,
            "ip_whitelist": key.ip_whitelist,
            "allowed_origins": key.allowed_origins,
            "metadata": key.metadata,
            "total_requests": key.total_requests,
            "total_errors": key.total_errors,
            "tags": key.tags,
            "is_active": key.is_active,
            "is_expired": key.is_expired,
        }


# Singleton instance
_api_key_service: Optional[APIKeyService] = None


def get_api_key_service() -> APIKeyService:
    global _api_key_service
    if _api_key_service is None:
        _api_key_service = APIKeyService()
    return _api_key_service
