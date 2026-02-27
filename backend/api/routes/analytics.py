"""
Analytics API Routes
Features: Event tracking, dashboard metrics, time-series data, alerts, reports
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ...services.analytics_service import (
    AnalyticsEngine, get_analytics_engine,
    EventCategory, MetricType, TimeGranularity
)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


class TrackEventRequest(BaseModel):
    event_name: str
    category: str = "system"
    data: Dict[str, Any] = {}
    user_id: Optional[str] = None


class RecordMetricRequest(BaseModel):
    name: str
    value: float
    metric_type: str = "gauge"
    tags: Dict[str, str] = {}


class CreateAlertRequest(BaseModel):
    name: str
    metric_name: str
    condition: str
    threshold: float
    severity: str = "warning"
    cooldown: float = 300


@router.post("/events")
async def track_event(data: TrackEventRequest):
    """Track an analytics event."""
    engine = get_analytics_engine()
    try:
        category = EventCategory(data.category)
    except ValueError:
        category = EventCategory.SYSTEM

    await engine.track_event(data.event_name, category, data.data, data.user_id)
    return {"status": "tracked", "event": data.event_name}


@router.post("/metrics")
async def record_metric(data: RecordMetricRequest):
    """Record a metric value."""
    engine = get_analytics_engine()
    await engine.record_metric(data.name, data.value, data.tags)
    return {"status": "recorded", "metric": data.name}


@router.get("/dashboard")
async def get_dashboard_metrics():
    """Get dashboard metrics summary."""
    engine = get_analytics_engine()
    return await engine.get_dashboard_metrics()


@router.get("/performance")
async def get_performance_metrics():
    """Get system performance metrics."""
    engine = get_analytics_engine()
    return await engine.get_performance_metrics()


@router.get("/usage-report")
async def get_usage_report(
    period: str = Query("day", regex="^(hour|day|week|month)$"),
):
    """Get usage report for a given period."""
    engine = get_analytics_engine()
    return await engine.get_usage_report(period)


@router.get("/time-series/{metric_name}")
async def get_time_series(
    metric_name: str,
    granularity: str = Query("hour", regex="^(minute|hour|day|week|month)$"),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get time-series data for a metric."""
    engine = get_analytics_engine()
    try:
        gran = TimeGranularity(granularity)
    except ValueError:
        gran = TimeGranularity.HOUR
    data = await engine.get_time_series(metric_name, gran, limit)
    return data


@router.get("/events")
async def get_events(
    category: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    """Get recent analytics events."""
    engine = get_analytics_engine()
    cat = None
    if category:
        try:
            cat = EventCategory(category)
        except ValueError:
            pass
    events = await engine.get_events(cat, limit)
    return events


@router.post("/alerts")
async def create_alert(data: CreateAlertRequest):
    """Create an alert rule."""
    engine = get_analytics_engine()
    rule = await engine.create_alert_rule(
        name=data.name,
        metric_name=data.metric_name,
        condition=data.condition,
        threshold=data.threshold,
        severity=data.severity,
        cooldown=data.cooldown,
    )
    return rule


@router.get("/alerts")
async def get_alerts(active_only: bool = True):
    """Get alert rules and recent alerts."""
    engine = get_analytics_engine()
    return await engine.get_alerts(active_only)


@router.get("/export")
async def export_metrics(format: str = Query("json", regex="^(json|csv)$")):
    """Export all metrics data."""
    engine = get_analytics_engine()
    return await engine.export_metrics(format)
