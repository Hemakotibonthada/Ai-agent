"""
Rate Limiting Service for Nexus AI
Configurable rate limiting with sliding windows, token buckets, and quotas
"""

import asyncio
import hashlib
import time
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional


class RateLimitAlgorithm(str, Enum):
    SLIDING_WINDOW = "sliding_window"
    TOKEN_BUCKET = "token_bucket"
    FIXED_WINDOW = "fixed_window"
    LEAKY_BUCKET = "leaky_bucket"


class RateLimitScope(str, Enum):
    GLOBAL = "global"
    PER_USER = "per_user"
    PER_IP = "per_ip"
    PER_API_KEY = "per_api_key"
    PER_ENDPOINT = "per_endpoint"


class RateLimitAction(str, Enum):
    REJECT = "reject"
    THROTTLE = "throttle"
    QUEUE = "queue"
    LOG_ONLY = "log_only"


@dataclass
class RateLimitRule:
    id: str
    name: str
    endpoint_pattern: str
    requests_per_window: int
    window_seconds: int
    algorithm: RateLimitAlgorithm = RateLimitAlgorithm.SLIDING_WINDOW
    scope: RateLimitScope = RateLimitScope.PER_USER
    action: RateLimitAction = RateLimitAction.REJECT
    burst_limit: int = 0
    retry_after_seconds: int = 60
    enabled: bool = True
    priority: int = 0
    exempt_roles: List[str] = field(default_factory=list)
    exempt_ips: List[str] = field(default_factory=list)
    custom_response_code: int = 429
    custom_message: str = "Rate limit exceeded"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_dict(self) -> Dict:
        d = asdict(self)
        for k in ["created_at", "updated_at"]:
            if d[k]:
                d[k] = d[k].isoformat() if isinstance(d[k], datetime) else d[k]
        return d


@dataclass
class RateLimitCounter:
    key: str
    rule_id: str
    count: int = 0
    window_start: float = 0.0
    tokens: float = 0.0
    last_refill: float = 0.0
    blocked_count: int = 0
    last_blocked: Optional[float] = None

    def to_dict(self) -> Dict:
        return {
            "key": self.key,
            "rule_id": self.rule_id,
            "count": self.count,
            "blocked_count": self.blocked_count,
            "window_start": datetime.fromtimestamp(self.window_start).isoformat() if self.window_start else None,
            "last_blocked": datetime.fromtimestamp(self.last_blocked).isoformat() if self.last_blocked else None,
        }


@dataclass
class RateLimitEvent:
    timestamp: datetime
    rule_id: str
    key: str
    action: str
    endpoint: str
    allowed: bool
    remaining: int = 0
    retry_after: int = 0
    ip_address: str = ""
    user_id: str = ""

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["timestamp"] = self.timestamp.isoformat()
        return d


@dataclass
class QuotaPlan:
    id: str
    name: str
    description: str = ""
    daily_limit: int = 0
    monthly_limit: int = 0
    rate_per_minute: int = 0
    rate_per_hour: int = 0
    burst_limit: int = 0
    features: List[str] = field(default_factory=list)
    price_monthly: float = 0.0
    is_active: bool = True

    def to_dict(self) -> Dict:
        return asdict(self)


class RateLimitService:
    """Advanced rate limiting with multiple algorithms and quotas"""

    def __init__(self):
        self.rules: Dict[str, RateLimitRule] = {}
        self.counters: Dict[str, RateLimitCounter] = {}
        self.events: List[RateLimitEvent] = []
        self.quota_plans: Dict[str, QuotaPlan] = {}
        self.user_quotas: Dict[str, Dict] = {}
        self._initialized = False

    async def initialize(self):
        if self._initialized:
            return
        await self._create_sample_data()
        self._initialized = True

    async def _create_sample_data(self):
        now = datetime.now()
        rules = [
            RateLimitRule(
                id="rl-001", name="API General Limit",
                endpoint_pattern="/api/v1/*", requests_per_window=100,
                window_seconds=60, scope=RateLimitScope.PER_USER,
                burst_limit=20, created_at=now - timedelta(days=90),
            ),
            RateLimitRule(
                id="rl-002", name="AI Chat Limit",
                endpoint_pattern="/api/v1/chat/*", requests_per_window=30,
                window_seconds=60, scope=RateLimitScope.PER_USER,
                algorithm=RateLimitAlgorithm.TOKEN_BUCKET,
                burst_limit=5, created_at=now - timedelta(days=90),
            ),
            RateLimitRule(
                id="rl-003", name="Auth Endpoints",
                endpoint_pattern="/api/v1/auth/*", requests_per_window=10,
                window_seconds=300, scope=RateLimitScope.PER_IP,
                action=RateLimitAction.REJECT, retry_after_seconds=300,
                created_at=now - timedelta(days=90),
            ),
            RateLimitRule(
                id="rl-004", name="File Upload Limit",
                endpoint_pattern="/api/v1/files/upload", requests_per_window=10,
                window_seconds=3600, scope=RateLimitScope.PER_USER,
                burst_limit=3, created_at=now - timedelta(days=60),
            ),
            RateLimitRule(
                id="rl-005", name="Search Limit",
                endpoint_pattern="/api/v1/search/*", requests_per_window=60,
                window_seconds=60, scope=RateLimitScope.PER_API_KEY,
                algorithm=RateLimitAlgorithm.LEAKY_BUCKET,
                created_at=now - timedelta(days=45),
            ),
            RateLimitRule(
                id="rl-006", name="Webhook Delivery",
                endpoint_pattern="/api/v1/webhooks/deliver", requests_per_window=1000,
                window_seconds=3600, scope=RateLimitScope.GLOBAL,
                action=RateLimitAction.QUEUE,
                created_at=now - timedelta(days=30),
            ),
            RateLimitRule(
                id="rl-007", name="Admin API",
                endpoint_pattern="/api/v1/admin/*", requests_per_window=200,
                window_seconds=60, scope=RateLimitScope.PER_USER,
                exempt_roles=["super_admin"],
                created_at=now - timedelta(days=90),
            ),
        ]
        for r in rules:
            self.rules[r.id] = r

        # Quota plans
        plans = [
            QuotaPlan(
                id="plan-free", name="Free", description="Basic access",
                daily_limit=100, monthly_limit=2000, rate_per_minute=10,
                rate_per_hour=100, burst_limit=5,
                features=["basic-chat", "basic-search"],
            ),
            QuotaPlan(
                id="plan-pro", name="Pro", description="Professional access",
                daily_limit=5000, monthly_limit=100000, rate_per_minute=60,
                rate_per_hour=2000, burst_limit=20,
                features=["advanced-chat", "search", "file-upload", "webhooks", "analytics"],
                price_monthly=29.99,
            ),
            QuotaPlan(
                id="plan-enterprise", name="Enterprise", description="Unlimited access",
                daily_limit=0, monthly_limit=0, rate_per_minute=600,
                rate_per_hour=20000, burst_limit=100,
                features=["all"],
                price_monthly=199.99,
            ),
        ]
        for p in plans:
            self.quota_plans[p.id] = p

        # Generate sample events
        for i in range(50):
            self.events.append(RateLimitEvent(
                timestamp=now - timedelta(minutes=i * 5),
                rule_id=rules[i % len(rules)].id,
                key=f"user-{i % 5}",
                action="reject" if i % 7 == 0 else "allow",
                endpoint=rules[i % len(rules)].endpoint_pattern,
                allowed=i % 7 != 0,
                remaining=max(0, 100 - (i * 3) % 100),
                ip_address=f"192.168.1.{10 + i % 20}",
                user_id=f"user-{i % 5}",
            ))

    async def check_rate_limit(self, endpoint: str, key: str,
                               ip_address: str = "", user_id: str = "") -> Dict:
        """Check if a request is within rate limits"""
        now = time.time()
        matching_rules = [r for r in self.rules.values()
                          if r.enabled and self._match_endpoint(endpoint, r.endpoint_pattern)]

        for rule in sorted(matching_rules, key=lambda r: r.priority, reverse=True):
            counter_key = f"{rule.id}:{key}"
            counter = self.counters.get(counter_key)

            if not counter:
                counter = RateLimitCounter(key=key, rule_id=rule.id, window_start=now, tokens=rule.burst_limit)
                self.counters[counter_key] = counter

            allowed, remaining, retry_after = self._check_counter(rule, counter, now)

            self.events.append(RateLimitEvent(
                timestamp=datetime.now(), rule_id=rule.id, key=key,
                action=rule.action.value, endpoint=endpoint, allowed=allowed,
                remaining=remaining, retry_after=retry_after,
                ip_address=ip_address, user_id=user_id,
            ))

            if not allowed:
                counter.blocked_count += 1
                counter.last_blocked = now
                return {
                    "allowed": False,
                    "rule": rule.name,
                    "remaining": 0,
                    "retry_after": retry_after,
                    "message": rule.custom_message,
                    "status_code": rule.custom_response_code,
                }

        return {"allowed": True, "remaining": -1, "retry_after": 0}

    def _match_endpoint(self, endpoint: str, pattern: str) -> bool:
        """Simple endpoint pattern matching"""
        if pattern.endswith("*"):
            return endpoint.startswith(pattern[:-1])
        return endpoint == pattern

    def _check_counter(self, rule: RateLimitRule, counter: RateLimitCounter,
                       now: float) -> tuple:
        """Check rate limit counter"""
        window = rule.window_seconds
        if now - counter.window_start >= window:
            counter.window_start = now
            counter.count = 0
            counter.tokens = rule.burst_limit

        counter.count += 1
        remaining = rule.requests_per_window - counter.count

        if counter.count > rule.requests_per_window:
            retry_after = int(window - (now - counter.window_start))
            return False, 0, max(1, retry_after)

        return True, max(0, remaining), 0

    # Rule CRUD
    async def list_rules(self, enabled_only: bool = False) -> List[Dict]:
        rules = list(self.rules.values())
        if enabled_only:
            rules = [r for r in rules if r.enabled]
        return [r.to_dict() for r in rules]

    async def get_rule(self, rule_id: str) -> Optional[Dict]:
        rule = self.rules.get(rule_id)
        return rule.to_dict() if rule else None

    async def create_rule(self, name: str, endpoint_pattern: str,
                          requests_per_window: int, window_seconds: int,
                          **kwargs) -> Dict:
        rule_id = f"rl-{hashlib.md5(name.encode()).hexdigest()[:6]}"
        rule = RateLimitRule(
            id=rule_id, name=name, endpoint_pattern=endpoint_pattern,
            requests_per_window=requests_per_window,
            window_seconds=window_seconds,
            created_at=datetime.now(), **kwargs,
        )
        self.rules[rule_id] = rule
        return rule.to_dict()

    async def update_rule(self, rule_id: str, **kwargs) -> Optional[Dict]:
        rule = self.rules.get(rule_id)
        if not rule:
            return None
        for key, value in kwargs.items():
            if hasattr(rule, key):
                setattr(rule, key, value)
        rule.updated_at = datetime.now()
        return rule.to_dict()

    async def delete_rule(self, rule_id: str) -> bool:
        if rule_id in self.rules:
            del self.rules[rule_id]
            return True
        return False

    async def toggle_rule(self, rule_id: str) -> Optional[Dict]:
        rule = self.rules.get(rule_id)
        if rule:
            rule.enabled = not rule.enabled
            return rule.to_dict()
        return None

    # Events & Analytics
    async def get_events(self, rule_id: Optional[str] = None,
                         limit: int = 100, blocked_only: bool = False) -> List[Dict]:
        events = self.events
        if rule_id:
            events = [e for e in events if e.rule_id == rule_id]
        if blocked_only:
            events = [e for e in events if not e.allowed]
        return [e.to_dict() for e in events[-limit:]]

    async def get_analytics(self) -> Dict:
        now = datetime.now()
        hour_ago = now - timedelta(hours=1)
        recent = [e for e in self.events if e.timestamp >= hour_ago]

        total = len(recent)
        blocked = len([e for e in recent if not e.allowed])

        return {
            "total_requests_last_hour": total,
            "blocked_requests_last_hour": blocked,
            "block_rate_percent": round(blocked / max(1, total) * 100, 1),
            "active_rules": len([r for r in self.rules.values() if r.enabled]),
            "total_rules": len(self.rules),
            "top_blocked_endpoints": self._get_top_blocked_endpoints(recent),
            "top_blocked_users": self._get_top_blocked_users(recent),
            "requests_by_rule": self._get_requests_by_rule(recent),
        }

    def _get_top_blocked_endpoints(self, events: List[RateLimitEvent]) -> List[Dict]:
        blocked = [e for e in events if not e.allowed]
        counts: Dict[str, int] = {}
        for e in blocked:
            counts[e.endpoint] = counts.get(e.endpoint, 0) + 1
        return [{"endpoint": ep, "count": c} for ep, c in
                sorted(counts.items(), key=lambda x: x[1], reverse=True)[:5]]

    def _get_top_blocked_users(self, events: List[RateLimitEvent]) -> List[Dict]:
        blocked = [e for e in events if not e.allowed]
        counts: Dict[str, int] = {}
        for e in blocked:
            counts[e.user_id] = counts.get(e.user_id, 0) + 1
        return [{"user_id": uid, "count": c} for uid, c in
                sorted(counts.items(), key=lambda x: x[1], reverse=True)[:5]]

    def _get_requests_by_rule(self, events: List[RateLimitEvent]) -> List[Dict]:
        counts: Dict[str, Dict] = {}
        for e in events:
            if e.rule_id not in counts:
                counts[e.rule_id] = {"total": 0, "blocked": 0, "rule_name": ""}
            counts[e.rule_id]["total"] += 1
            if not e.allowed:
                counts[e.rule_id]["blocked"] += 1
            rule = self.rules.get(e.rule_id)
            if rule:
                counts[e.rule_id]["rule_name"] = rule.name

        return [{"rule_id": rid, **data} for rid, data in counts.items()]

    # Quota Plans
    async def list_quota_plans(self) -> List[Dict]:
        return [p.to_dict() for p in self.quota_plans.values()]

    async def get_user_quota(self, user_id: str) -> Dict:
        quota = self.user_quotas.get(user_id, {
            "plan_id": "plan-free",
            "daily_used": 42,
            "monthly_used": 890,
            "reset_daily": (datetime.now() + timedelta(hours=8)).isoformat(),
            "reset_monthly": (datetime.now() + timedelta(days=12)).isoformat(),
        })
        plan = self.quota_plans.get(quota.get("plan_id", "plan-free"))
        if plan:
            quota["plan"] = plan.to_dict()
        return quota

    async def get_summary(self) -> Dict:
        return {
            "total_rules": len(self.rules),
            "active_rules": len([r for r in self.rules.values() if r.enabled]),
            "total_events": len(self.events),
            "blocked_events": len([e for e in self.events if not e.allowed]),
            "quota_plans": len(self.quota_plans),
        }
