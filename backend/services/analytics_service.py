"""
Analytics & Metrics Service
Features: Event tracking, time-series metrics, dashboard analytics, usage stats, 
          performance monitoring, user engagement, feature usage tracking
"""
from __future__ import annotations

import statistics
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────
class MetricType(str, Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"
    RATE = "rate"


class EventCategory(str, Enum):
    USER = "user"
    AGENT = "agent"
    SYSTEM = "system"
    API = "api"
    TASK = "task"
    CHAT = "chat"
    HOME = "home"
    HEALTH = "health"
    FINANCE = "finance"
    SECURITY = "security"
    PERFORMANCE = "performance"
    ERROR = "error"


class TimeGranularity(str, Enum):
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


# ── Models ───────────────────────────────────────────────────────────
class AnalyticsEvent(BaseModel):
    id: str = ""
    timestamp: str = ""
    category: EventCategory
    action: str
    label: Optional[str] = None
    value: Optional[float] = None
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = {}
    session_id: Optional[str] = None


class MetricPoint(BaseModel):
    timestamp: str
    value: float
    labels: Dict[str, str] = {}


class TimeSeriesData(BaseModel):
    metric: str
    points: List[MetricPoint]
    aggregation: str = "avg"
    granularity: TimeGranularity = TimeGranularity.HOUR


class DashboardMetrics(BaseModel):
    total_users: int = 0
    active_sessions: int = 0
    total_tasks: int = 0
    completed_tasks: int = 0
    total_conversations: int = 0
    total_messages: int = 0
    active_agents: int = 0
    total_agents: int = 0
    system_uptime: float = 0
    api_requests_today: int = 0
    avg_response_time: float = 0
    error_rate: float = 0
    cpu_usage: float = 0
    memory_usage: float = 0
    disk_usage: float = 0
    network_throughput: float = 0


class AgentMetrics(BaseModel):
    agent_name: str
    total_actions: int = 0
    successful_actions: int = 0
    failed_actions: int = 0
    avg_response_time: float = 0
    uptime_percentage: float = 100.0
    last_active: Optional[str] = None
    actions_per_hour: float = 0
    error_rate: float = 0


class PerformanceMetrics(BaseModel):
    endpoint: str
    method: str
    avg_latency_ms: float = 0
    p50_latency_ms: float = 0
    p95_latency_ms: float = 0
    p99_latency_ms: float = 0
    request_count: int = 0
    error_count: int = 0
    throughput_rps: float = 0


class UsageReport(BaseModel):
    period: str
    start_date: str
    end_date: str
    total_events: int = 0
    unique_users: int = 0
    top_features: List[Dict[str, Any]] = []
    top_agents: List[Dict[str, Any]] = []
    peak_hours: List[Dict[str, Any]] = []
    error_summary: List[Dict[str, Any]] = []
    engagement_score: float = 0


class AlertRule(BaseModel):
    id: str
    name: str
    metric: str
    condition: str  # gt, lt, eq, gte, lte
    threshold: float
    duration_seconds: int = 60
    severity: str = "warning"
    enabled: bool = True
    notification_channels: List[str] = ["in_app"]
    last_triggered: Optional[str] = None
    cooldown_seconds: int = 300


class Alert(BaseModel):
    id: str
    rule_id: str
    metric: str
    value: float
    threshold: float
    severity: str
    timestamp: str
    resolved: bool = False
    resolved_at: Optional[str] = None
    message: str = ""


# ── Time Series Storage ──────────────────────────────────────────────
class TimeSeriesStore:
    """In-memory time-series data store with automatic downsampling."""

    def __init__(self, max_points_per_metric: int = 100_000):
        self._data: Dict[str, List[Tuple[float, float, Dict[str, str]]]] = defaultdict(list)
        self._max_points = max_points_per_metric

    def record(self, metric: str, value: float, labels: Optional[Dict[str, str]] = None):
        ts = time.time()
        self._data[metric].append((ts, value, labels or {}))
        # Trim if too many points
        if len(self._data[metric]) > self._max_points:
            self._data[metric] = self._data[metric][-self._max_points:]

    def query(
        self,
        metric: str,
        start: Optional[float] = None,
        end: Optional[float] = None,
        granularity: TimeGranularity = TimeGranularity.HOUR,
        aggregation: str = "avg",
        labels_filter: Optional[Dict[str, str]] = None,
    ) -> List[MetricPoint]:
        points = self._data.get(metric, [])
        now = time.time()
        start = start or (now - 86400)  # Default: last 24h
        end = end or now

        # Filter by time and labels
        filtered = []
        for ts, val, labels in points:
            if ts < start or ts > end:
                continue
            if labels_filter:
                if not all(labels.get(k) == v for k, v in labels_filter.items()):
                    continue
            filtered.append((ts, val, labels))

        if not filtered:
            return []

        # Bucket by granularity
        bucket_size = {
            TimeGranularity.MINUTE: 60,
            TimeGranularity.HOUR: 3600,
            TimeGranularity.DAY: 86400,
            TimeGranularity.WEEK: 604800,
            TimeGranularity.MONTH: 2592000,
        }[granularity]

        buckets: Dict[int, List[float]] = defaultdict(list)
        for ts, val, _ in filtered:
            bucket_key = int(ts // bucket_size) * bucket_size
            buckets[bucket_key].append(val)

        # Aggregate
        result = []
        for bucket_ts in sorted(buckets.keys()):
            vals = buckets[bucket_ts]
            if aggregation == "avg":
                agg_val = statistics.mean(vals)
            elif aggregation == "sum":
                agg_val = sum(vals)
            elif aggregation == "min":
                agg_val = min(vals)
            elif aggregation == "max":
                agg_val = max(vals)
            elif aggregation == "count":
                agg_val = len(vals)
            elif aggregation == "p95":
                sorted_vals = sorted(vals)
                idx = int(len(sorted_vals) * 0.95)
                agg_val = sorted_vals[min(idx, len(sorted_vals) - 1)]
            elif aggregation == "p99":
                sorted_vals = sorted(vals)
                idx = int(len(sorted_vals) * 0.99)
                agg_val = sorted_vals[min(idx, len(sorted_vals) - 1)]
            else:
                agg_val = statistics.mean(vals)

            result.append(MetricPoint(
                timestamp=datetime.fromtimestamp(bucket_ts, tz=timezone.utc).isoformat(),
                value=round(agg_val, 4),
            ))

        return result

    def get_latest(self, metric: str) -> Optional[float]:
        points = self._data.get(metric, [])
        return points[-1][1] if points else None

    def get_stats(self, metric: str, window_seconds: int = 3600) -> Dict[str, float]:
        now = time.time()
        points = self._data.get(metric, [])
        recent = [v for ts, v, _ in points if now - ts < window_seconds]

        if not recent:
            return {"count": 0, "avg": 0, "min": 0, "max": 0, "sum": 0, "stddev": 0}

        return {
            "count": len(recent),
            "avg": round(statistics.mean(recent), 4),
            "min": round(min(recent), 4),
            "max": round(max(recent), 4),
            "sum": round(sum(recent), 4),
            "stddev": round(statistics.stdev(recent) if len(recent) > 1 else 0, 4),
        }


# ── Analytics Engine ─────────────────────────────────────────────────
class AnalyticsEngine:
    """Core analytics processing engine."""

    def __init__(self):
        self.ts_store = TimeSeriesStore()
        self._events: List[AnalyticsEvent] = []
        self._counters: Dict[str, int] = defaultdict(int)
        self._gauges: Dict[str, float] = {}
        self._request_times: Dict[str, List[float]] = defaultdict(list)
        self._feature_usage: Dict[str, int] = defaultdict(int)
        self._user_sessions: Dict[str, Dict[str, Any]] = {}
        self._alert_rules: List[AlertRule] = []
        self._active_alerts: List[Alert] = []
        self._start_time = time.time()
        self._error_counts: Dict[str, int] = defaultdict(int)

        # Initialize default alert rules
        self._init_default_alerts()

    def _init_default_alerts(self):
        self._alert_rules = [
            AlertRule(id="alert-cpu", name="High CPU Usage", metric="system.cpu",
                      condition="gt", threshold=90, severity="critical"),
            AlertRule(id="alert-mem", name="High Memory Usage", metric="system.memory",
                      condition="gt", threshold=85, severity="warning"),
            AlertRule(id="alert-disk", name="Disk Space Low", metric="system.disk",
                      condition="gt", threshold=90, severity="critical"),
            AlertRule(id="alert-error", name="High Error Rate", metric="api.error_rate",
                      condition="gt", threshold=5, severity="warning"),
            AlertRule(id="alert-latency", name="High Latency", metric="api.latency_p95",
                      condition="gt", threshold=5000, severity="warning"),
        ]

    # ── Event Tracking ────────────────────────────────────
    def track_event(self, event: AnalyticsEvent):
        import secrets
        event.id = f"evt-{secrets.token_hex(8)}"
        event.timestamp = datetime.now(timezone.utc).isoformat()
        self._events.append(event)
        self._counters[f"events.{event.category.value}.{event.action}"] += 1
        self._feature_usage[event.action] += 1

        # Record to time series
        self.ts_store.record(f"events.{event.category.value}", 1, {"action": event.action})

        if event.value is not None:
            self.ts_store.record(f"events.{event.category.value}.value", event.value)

        # Trim events
        if len(self._events) > 50000:
            self._events = self._events[-50000:]

    def track_api_request(self, endpoint: str, method: str, latency_ms: float, status_code: int):
        key = f"{method}:{endpoint}"
        self._request_times[key].append(latency_ms)
        if len(self._request_times[key]) > 10000:
            self._request_times[key] = self._request_times[key][-10000:]

        self._counters["api.total_requests"] += 1
        self.ts_store.record("api.latency", latency_ms, {"endpoint": endpoint, "method": method})
        self.ts_store.record("api.requests", 1, {"endpoint": endpoint})

        if status_code >= 400:
            self._counters["api.errors"] += 1
            self._error_counts[endpoint] += 1
            self.ts_store.record("api.errors", 1, {"endpoint": endpoint, "status": str(status_code)})

    def track_agent_action(self, agent_name: str, action: str, success: bool, duration_ms: float):
        self.ts_store.record(f"agent.{agent_name}.actions", 1, {"action": action, "success": str(success)})
        self.ts_store.record(f"agent.{agent_name}.duration", duration_ms, {"action": action})
        if not success:
            self.ts_store.record(f"agent.{agent_name}.errors", 1, {"action": action})

    def track_system_metrics(self, cpu: float, memory: float, disk: float, network: float = 0):
        self.ts_store.record("system.cpu", cpu)
        self.ts_store.record("system.memory", memory)
        self.ts_store.record("system.disk", disk)
        self.ts_store.record("system.network", network)
        self._gauges["system.cpu"] = cpu
        self._gauges["system.memory"] = memory
        self._gauges["system.disk"] = disk
        self._gauges["system.network"] = network

        # Check alerts
        self._check_alerts()

    # ── Querying ──────────────────────────────────────────
    def get_dashboard_metrics(self) -> DashboardMetrics:
        uptime = time.time() - self._start_time
        total_req = self._counters.get("api.total_requests", 0)
        total_err = self._counters.get("api.errors", 0)

        # Calculate avg response time from all endpoints
        all_times: List[float] = []
        for times in self._request_times.values():
            all_times.extend(times[-100:])  # Last 100 per endpoint
        avg_time = statistics.mean(all_times) if all_times else 0

        return DashboardMetrics(
            total_users=len(self._user_sessions),
            active_sessions=sum(1 for s in self._user_sessions.values()
                                if time.time() - s.get("last_active", 0) < 3600),
            total_tasks=self._counters.get("events.task.created", 0),
            completed_tasks=self._counters.get("events.task.completed", 0),
            total_conversations=self._counters.get("events.chat.conversation_created", 0),
            total_messages=self._counters.get("events.chat.message_sent", 0),
            active_agents=self._gauges.get("agents.active", 0),
            total_agents=self._gauges.get("agents.total", 15),
            system_uptime=uptime,
            api_requests_today=total_req,
            avg_response_time=round(avg_time, 2),
            error_rate=round((total_err / max(total_req, 1)) * 100, 2),
            cpu_usage=self._gauges.get("system.cpu", 0),
            memory_usage=self._gauges.get("system.memory", 0),
            disk_usage=self._gauges.get("system.disk", 0),
            network_throughput=self._gauges.get("system.network", 0),
        )

    def get_performance_metrics(self) -> List[PerformanceMetrics]:
        metrics = []
        for key, times in self._request_times.items():
            if not times:
                continue
            method, endpoint = key.split(":", 1)
            sorted_times = sorted(times)
            n = len(sorted_times)

            metrics.append(PerformanceMetrics(
                endpoint=endpoint,
                method=method,
                avg_latency_ms=round(statistics.mean(times), 2),
                p50_latency_ms=round(sorted_times[n // 2], 2),
                p95_latency_ms=round(sorted_times[int(n * 0.95)], 2) if n > 1 else sorted_times[0],
                p99_latency_ms=round(sorted_times[int(n * 0.99)], 2) if n > 1 else sorted_times[0],
                request_count=n,
                error_count=self._error_counts.get(endpoint, 0),
                throughput_rps=round(n / max(time.time() - self._start_time, 1), 4),
            ))

        return sorted(metrics, key=lambda m: m.request_count, reverse=True)

    def get_usage_report(self, days: int = 7) -> UsageReport:
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=days)
        start_ts = start.isoformat()

        recent_events = [e for e in self._events if e.timestamp >= start_ts]

        # Top features
        feature_counts: Dict[str, int] = defaultdict(int)
        for e in recent_events:
            feature_counts[e.action] += 1
        top_features = [{"feature": k, "count": v} for k, v in
                        sorted(feature_counts.items(), key=lambda x: x[1], reverse=True)[:10]]

        # Unique users
        unique_users = len(set(e.user_id for e in recent_events if e.user_id))

        # Peak hours
        hour_counts: Dict[int, int] = defaultdict(int)
        for e in recent_events:
            try:
                h = datetime.fromisoformat(e.timestamp).hour
                hour_counts[h] += 1
            except Exception:
                pass
        peak_hours = [{"hour": h, "events": c} for h, c in sorted(hour_counts.items())]

        # Errors
        error_events = [e for e in recent_events if e.category == EventCategory.ERROR]
        error_by_type: Dict[str, int] = defaultdict(int)
        for e in error_events:
            error_by_type[e.action] += 1
        error_summary = [{"type": k, "count": v} for k, v in
                         sorted(error_by_type.items(), key=lambda x: x[1], reverse=True)[:10]]

        return UsageReport(
            period=f"{days}d",
            start_date=start.isoformat(),
            end_date=now.isoformat(),
            total_events=len(recent_events),
            unique_users=unique_users,
            top_features=top_features,
            peak_hours=peak_hours,
            error_summary=error_summary,
            engagement_score=min(100, len(recent_events) / max(unique_users, 1)),
        )

    def get_time_series(
        self,
        metric: str,
        start: Optional[str] = None,
        end: Optional[str] = None,
        granularity: TimeGranularity = TimeGranularity.HOUR,
        aggregation: str = "avg",
    ) -> TimeSeriesData:
        start_ts = datetime.fromisoformat(start).timestamp() if start else None
        end_ts = datetime.fromisoformat(end).timestamp() if end else None

        points = self.ts_store.query(metric, start_ts, end_ts, granularity, aggregation)
        return TimeSeriesData(
            metric=metric,
            points=points,
            aggregation=aggregation,
            granularity=granularity,
        )

    # ── Alerting ──────────────────────────────────────────
    def _check_alerts(self):
        now = datetime.now(timezone.utc)
        for rule in self._alert_rules:
            if not rule.enabled:
                continue

            value = self._gauges.get(rule.metric)
            if value is None:
                continue

            triggered = False
            if rule.condition == "gt" and value > rule.threshold:
                triggered = True
            elif rule.condition == "lt" and value < rule.threshold:
                triggered = True
            elif rule.condition == "gte" and value >= rule.threshold:
                triggered = True
            elif rule.condition == "lte" and value <= rule.threshold:
                triggered = True
            elif rule.condition == "eq" and value == rule.threshold:
                triggered = True

            if triggered:
                # Check cooldown
                if rule.last_triggered:
                    last = datetime.fromisoformat(rule.last_triggered)
                    if (now - last).total_seconds() < rule.cooldown_seconds:
                        continue

                import secrets
                alert = Alert(
                    id=f"alert-{secrets.token_hex(6)}",
                    rule_id=rule.id,
                    metric=rule.metric,
                    value=value,
                    threshold=rule.threshold,
                    severity=rule.severity,
                    timestamp=now.isoformat(),
                    message=f"{rule.name}: {rule.metric} is {value:.1f} (threshold: {rule.threshold})",
                )
                self._active_alerts.append(alert)
                rule.last_triggered = now.isoformat()

                if len(self._active_alerts) > 1000:
                    self._active_alerts = self._active_alerts[-1000:]

    def get_alerts(self, resolved: Optional[bool] = None) -> List[Alert]:
        alerts = self._active_alerts
        if resolved is not None:
            alerts = [a for a in alerts if a.resolved == resolved]
        return alerts

    def resolve_alert(self, alert_id: str):
        for alert in self._active_alerts:
            if alert.id == alert_id:
                alert.resolved = True
                alert.resolved_at = datetime.now(timezone.utc).isoformat()
                break

    def get_alert_rules(self) -> List[AlertRule]:
        return self._alert_rules

    def create_alert_rule(self, rule: AlertRule):
        self._alert_rules.append(rule)

    def update_alert_rule(self, rule_id: str, updates: Dict[str, Any]):
        for i, rule in enumerate(self._alert_rules):
            if rule.id == rule_id:
                data = rule.model_dump()
                data.update(updates)
                self._alert_rules[i] = AlertRule(**data)
                break

    def delete_alert_rule(self, rule_id: str):
        self._alert_rules = [r for r in self._alert_rules if r.id != rule_id]

    # ── Export ────────────────────────────────────────────
    def export_metrics(self, format: str = "json") -> Dict[str, Any]:
        return {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "dashboard": self.get_dashboard_metrics().model_dump(),
            "performance": [m.model_dump() for m in self.get_performance_metrics()],
            "usage": self.get_usage_report().model_dump(),
            "alerts": [a.model_dump() for a in self.get_alerts()],
            "counters": dict(self._counters),
            "gauges": dict(self._gauges),
        }


# ── Singleton ────────────────────────────────────────────────────────
_analytics_engine: Optional[AnalyticsEngine] = None


def get_analytics_engine() -> AnalyticsEngine:
    global _analytics_engine
    if _analytics_engine is None:
        _analytics_engine = AnalyticsEngine()
    return _analytics_engine
