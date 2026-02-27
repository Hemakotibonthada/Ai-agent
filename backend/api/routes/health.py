# NEXUS AI - Health & Wellness API Routes
"""
Endpoints for health tracking, mood logging, exercise recording,
sleep analysis, and wellness dashboard.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.repositories import HealthRepository
from api.dependencies import get_current_user_id


# ============================================================
# Request / Response Models
# ============================================================

class MoodLogRequest(BaseModel):
    """Request to log a mood entry."""
    mood_score: int = Field(..., ge=1, le=10, description="Mood score 1-10")
    energy_level: Optional[int] = Field(None, ge=1, le=10, description="Energy level 1-10")
    stress_level: Optional[int] = Field(None, ge=1, le=10, description="Stress level 1-10")
    notes: Optional[str] = Field(None, max_length=2000, description="Notes about mood")
    activities: Optional[List[str]] = Field(default_factory=list, description="Activities done")
    triggers: Optional[List[str]] = Field(default_factory=list, description="Mood triggers")


class MoodLogResponse(BaseModel):
    """Response after logging mood."""
    id: str
    mood_score: int
    energy_level: Optional[int] = None
    stress_level: Optional[int] = None
    notes: Optional[str] = None
    recorded_at: str
    message: str


class ExerciseLogRequest(BaseModel):
    """Request to log an exercise session."""
    exercise_type: str = Field(..., min_length=1, max_length=100, description="Type of exercise")
    duration_minutes: float = Field(..., gt=0, description="Duration in minutes")
    calories_burned: Optional[float] = Field(None, ge=0, description="Estimated calories burned")
    distance_km: Optional[float] = Field(None, ge=0, description="Distance in km")
    heart_rate_avg: Optional[int] = Field(None, ge=30, le=250, description="Average heart rate")
    intensity: Optional[str] = Field("moderate", description="Intensity: low, moderate, high")
    notes: Optional[str] = Field(None, max_length=1000)


class ExerciseLogResponse(BaseModel):
    """Response after logging exercise."""
    id: str
    exercise_type: str
    duration_minutes: float
    calories_burned: Optional[float] = None
    recorded_at: str
    message: str


class SleepLogRequest(BaseModel):
    """Request to log sleep data."""
    hours: float = Field(..., gt=0, le=24, description="Hours of sleep")
    quality: Optional[int] = Field(None, ge=1, le=10, description="Sleep quality 1-10")
    bedtime: Optional[str] = Field(None, description="Bedtime ISO string")
    wake_time: Optional[str] = Field(None, description="Wake time ISO string")
    interruptions: Optional[int] = Field(None, ge=0, description="Number of interruptions")
    notes: Optional[str] = Field(None, max_length=1000)


class SleepLogResponse(BaseModel):
    """Response after logging sleep."""
    id: str
    hours: float
    quality: Optional[int] = None
    recorded_at: str
    message: str


class HealthMetricOut(BaseModel):
    """A single health metric."""
    id: str
    metric_type: str
    value: float
    unit: str
    notes: Optional[str] = None
    source: Optional[str] = None
    recorded_at: str


class HealthSummaryResponse(BaseModel):
    """Health summary over a period."""
    period_days: int
    metrics: Dict[str, Any] = {}
    mood_average: Optional[float] = None
    total_exercise_minutes: float = 0.0
    average_sleep_hours: float = 0.0
    latest_metrics: List[HealthMetricOut] = []
    timestamp: str


class HealthTrendsResponse(BaseModel):
    """Health trends over time."""
    period_days: int
    mood_trend: List[Dict[str, Any]] = []
    exercise_trend: List[Dict[str, Any]] = []
    sleep_trend: List[Dict[str, Any]] = []
    weight_trend: List[Dict[str, Any]] = []
    timestamp: str


class HealthDashboardResponse(BaseModel):
    """Aggregated health dashboard."""
    mood: Dict[str, Any] = {}
    exercise: Dict[str, Any] = {}
    sleep: Dict[str, Any] = {}
    metrics: Dict[str, Any] = {}
    goals: List[Dict[str, Any]] = []
    insights: List[str] = []
    timestamp: str


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/health", tags=["Health & Wellness"])


@router.post(
    "/mood",
    response_model=MoodLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a mood entry",
)
async def log_mood(
    request: MoodLogRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Record a mood entry with optional energy, stress, and notes."""
    try:
        repo = HealthRepository(db)
        entry = await repo.add_mood_entry(
            user_id=user_id,
            mood_score=request.mood_score,
            energy_level=request.energy_level,
            stress_level=request.stress_level,
            notes=request.notes,
            activities=request.activities,
            triggers=request.triggers,
        )

        return MoodLogResponse(
            id=entry.id,
            mood_score=entry.mood_score,
            energy_level=entry.energy_level,
            stress_level=entry.stress_level,
            notes=entry.notes,
            recorded_at=entry.recorded_at.isoformat() if entry.recorded_at else datetime.utcnow().isoformat(),
            message="Mood logged successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error logging mood: {str(e)}",
        )


@router.post(
    "/exercise",
    response_model=ExerciseLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log an exercise session",
)
async def log_exercise(
    request: ExerciseLogRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Record an exercise session with duration, calories, and other metrics."""
    try:
        repo = HealthRepository(db)

        metadata = {
            "exercise_type": request.exercise_type,
            "intensity": request.intensity,
            "distance_km": request.distance_km,
            "heart_rate_avg": request.heart_rate_avg,
            "notes": request.notes,
        }

        # Store duration as the primary metric
        metric = await repo.add_metric(
            user_id=user_id,
            metric_type="exercise",
            value=request.duration_minutes,
            unit="minutes",
            source="manual",
            notes=request.notes,
            metadata=metadata,
        )

        # Also store calories if provided
        if request.calories_burned:
            await repo.add_metric(
                user_id=user_id,
                metric_type="calories",
                value=request.calories_burned,
                unit="kcal",
                source="manual",
                metadata={"exercise_type": request.exercise_type},
            )

        return ExerciseLogResponse(
            id=metric.id,
            exercise_type=request.exercise_type,
            duration_minutes=request.duration_minutes,
            calories_burned=request.calories_burned,
            recorded_at=metric.recorded_at.isoformat() if metric.recorded_at else datetime.utcnow().isoformat(),
            message="Exercise session logged successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error logging exercise: {str(e)}",
        )


@router.post(
    "/sleep",
    response_model=SleepLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log sleep data",
)
async def log_sleep(
    request: SleepLogRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Record sleep duration and quality."""
    try:
        repo = HealthRepository(db)

        metadata = {
            "quality": request.quality,
            "bedtime": request.bedtime,
            "wake_time": request.wake_time,
            "interruptions": request.interruptions,
            "notes": request.notes,
        }

        metric = await repo.add_metric(
            user_id=user_id,
            metric_type="sleep",
            value=request.hours,
            unit="hours",
            source="manual",
            notes=request.notes,
            metadata=metadata,
        )

        return SleepLogResponse(
            id=metric.id,
            hours=request.hours,
            quality=request.quality,
            recorded_at=metric.recorded_at.isoformat() if metric.recorded_at else datetime.utcnow().isoformat(),
            message="Sleep data logged successfully",
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error logging sleep: {str(e)}",
        )


@router.get(
    "/summary",
    response_model=HealthSummaryResponse,
    summary="Get health summary",
)
async def get_health_summary(
    days: int = Query(30, ge=1, le=365, description="Period in days"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get a summary of health metrics over a given period."""
    try:
        repo = HealthRepository(db)

        # All metrics for the period
        all_metrics = await repo.get_metrics(user_id=user_id, days=days, limit=1000)

        # Group by type
        by_type: Dict[str, List] = {}
        for m in all_metrics:
            by_type.setdefault(m.metric_type, []).append(m)

        metrics_summary: Dict[str, Any] = {}
        for metric_type, entries in by_type.items():
            values = [e.value for e in entries]
            metrics_summary[metric_type] = {
                "count": len(values),
                "average": round(sum(values) / len(values), 2) if values else 0,
                "min": round(min(values), 2) if values else 0,
                "max": round(max(values), 2) if values else 0,
                "latest": round(values[0], 2) if values else 0,
                "unit": entries[0].unit if entries else "",
            }

        # Mood
        mood_avg = await repo.get_average_mood(user_id=user_id, days=days)

        # Exercise total
        exercise_entries = by_type.get("exercise", [])
        total_exercise = sum(e.value for e in exercise_entries)

        # Sleep average
        sleep_entries = by_type.get("sleep", [])
        avg_sleep = (sum(e.value for e in sleep_entries) / len(sleep_entries)) if sleep_entries else 0.0

        # Latest metrics
        latest = [
            HealthMetricOut(
                id=m.id,
                metric_type=m.metric_type,
                value=m.value,
                unit=m.unit,
                notes=m.notes,
                source=m.source,
                recorded_at=m.recorded_at.isoformat() if m.recorded_at else "",
            )
            for m in all_metrics[:20]
        ]

        return HealthSummaryResponse(
            period_days=days,
            metrics=metrics_summary,
            mood_average=round(mood_avg, 2) if mood_avg else None,
            total_exercise_minutes=round(total_exercise, 1),
            average_sleep_hours=round(avg_sleep, 2),
            latest_metrics=latest,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching health summary: {str(e)}",
        )


@router.get(
    "/trends",
    response_model=HealthTrendsResponse,
    summary="Get health trends over time",
)
async def get_health_trends(
    days: int = Query(30, ge=7, le=365, description="Period in days"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get trend data for mood, exercise, sleep, and weight."""
    try:
        repo = HealthRepository(db)

        # Mood trend
        mood_entries = await repo.get_mood_history(user_id=user_id, days=days)
        mood_trend = [
            {
                "date": e.recorded_at.isoformat() if e.recorded_at else "",
                "score": e.mood_score,
                "energy": e.energy_level,
                "stress": e.stress_level,
            }
            for e in mood_entries
        ]

        # Exercise trend
        exercise_metrics = await repo.get_metrics(user_id=user_id, metric_type="exercise", days=days)
        exercise_trend = [
            {
                "date": m.recorded_at.isoformat() if m.recorded_at else "",
                "duration_minutes": m.value,
                "metadata": m.metadata or {},
            }
            for m in exercise_metrics
        ]

        # Sleep trend
        sleep_metrics = await repo.get_metrics(user_id=user_id, metric_type="sleep", days=days)
        sleep_trend = [
            {
                "date": m.recorded_at.isoformat() if m.recorded_at else "",
                "hours": m.value,
                "metadata": m.metadata or {},
            }
            for m in sleep_metrics
        ]

        # Weight trend
        weight_metrics = await repo.get_metrics(user_id=user_id, metric_type="weight", days=days)
        weight_trend = [
            {
                "date": m.recorded_at.isoformat() if m.recorded_at else "",
                "weight": m.value,
                "unit": m.unit,
            }
            for m in weight_metrics
        ]

        return HealthTrendsResponse(
            period_days=days,
            mood_trend=mood_trend,
            exercise_trend=exercise_trend,
            sleep_trend=sleep_trend,
            weight_trend=weight_trend,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching health trends: {str(e)}",
        )


@router.get(
    "/dashboard",
    response_model=HealthDashboardResponse,
    summary="Get health dashboard",
)
async def health_dashboard(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get an aggregated health and wellness dashboard."""
    try:
        repo = HealthRepository(db)

        # Mood (last 7 days)
        mood_avg_7d = await repo.get_average_mood(user_id=user_id, days=7)
        mood_avg_30d = await repo.get_average_mood(user_id=user_id, days=30)
        recent_moods = await repo.get_mood_history(user_id=user_id, days=7)
        mood_data = {
            "average_7d": round(mood_avg_7d, 2) if mood_avg_7d else None,
            "average_30d": round(mood_avg_30d, 2) if mood_avg_30d else None,
            "entries_7d": len(recent_moods),
            "latest": recent_moods[0].mood_score if recent_moods else None,
        }

        # Exercise (last 7 days)
        exercise_metrics = await repo.get_metrics(user_id=user_id, metric_type="exercise", days=7)
        total_ex = sum(m.value for m in exercise_metrics)
        exercise_data = {
            "total_minutes_7d": round(total_ex, 1),
            "sessions_7d": len(exercise_metrics),
            "avg_per_session": round(total_ex / len(exercise_metrics), 1) if exercise_metrics else 0,
        }

        # Sleep (last 7 days)
        sleep_metrics = await repo.get_metrics(user_id=user_id, metric_type="sleep", days=7)
        sleep_vals = [m.value for m in sleep_metrics]
        sleep_data = {
            "average_hours_7d": round(sum(sleep_vals) / len(sleep_vals), 2) if sleep_vals else 0,
            "entries_7d": len(sleep_vals),
            "latest": round(sleep_vals[0], 2) if sleep_vals else None,
        }

        # All metric types summary
        all_metrics = await repo.get_metrics(user_id=user_id, days=7, limit=500)
        metric_types = set(m.metric_type for m in all_metrics)
        metrics_data = {
            "types_tracked": list(metric_types),
            "total_entries_7d": len(all_metrics),
        }

        # Insights
        insights: List[str] = []
        if mood_avg_7d and mood_avg_7d < 5:
            insights.append("Your mood has been below average this week. Consider relaxation activities.")
        if total_ex < 150:
            insights.append("You haven't reached 150 minutes of exercise this week (WHO recommendation).")
        if sleep_vals and sum(sleep_vals) / len(sleep_vals) < 7:
            insights.append("Your average sleep is below 7 hours. Aim for 7-9 hours per night.")
        if not insights:
            insights.append("You're doing great! Keep up the healthy habits.")

        return HealthDashboardResponse(
            mood=mood_data,
            exercise=exercise_data,
            sleep=sleep_data,
            metrics=metrics_data,
            goals=[],
            insights=insights,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error building health dashboard: {str(e)}",
        )
