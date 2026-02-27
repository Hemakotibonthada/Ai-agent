"""
Feature Flags Service
Features: Feature toggles, A/B testing, gradual rollouts, user targeting,
          percentage-based rollout, environment-based flags, audit trail
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import random
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set


class FlagType(str, Enum):
    BOOLEAN = "boolean"
    PERCENTAGE = "percentage"
    USER_LIST = "user_list"
    ENVIRONMENT = "environment"
    TIME_BASED = "time_based"
    AB_TEST = "ab_test"
    GRADUAL_ROLLOUT = "gradual_rollout"


class FlagStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class ABTestVariant(str, Enum):
    CONTROL = "control"
    VARIANT_A = "variant_a"
    VARIANT_B = "variant_b"
    VARIANT_C = "variant_c"


@dataclass
class FeatureFlag:
    id: str
    name: str
    description: str
    flag_type: FlagType
    status: FlagStatus = FlagStatus.ACTIVE
    enabled: bool = False
    percentage: float = 0.0
    allowed_users: List[str] = field(default_factory=list)
    blocked_users: List[str] = field(default_factory=list)
    environments: List[str] = field(default_factory=list)
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    variants: Dict[str, float] = field(default_factory=dict)
    rollout_start: Optional[float] = None
    rollout_end: Optional[float] = None
    rollout_start_percentage: float = 0.0
    rollout_end_percentage: float = 100.0
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    created_by: str = "system"
    category: str = "general"
    dependencies: List[str] = field(default_factory=list)


@dataclass
class FlagEvaluation:
    flag_id: str
    user_id: str
    enabled: bool
    variant: Optional[str] = None
    reason: str = ""
    timestamp: float = field(default_factory=time.time)


@dataclass
class FlagAuditEntry:
    id: str
    flag_id: str
    action: str
    old_value: Any
    new_value: Any
    user_id: str
    timestamp: float = field(default_factory=time.time)
    details: str = ""


@dataclass
class ABTestResult:
    flag_id: str
    variant: str
    impressions: int = 0
    conversions: int = 0
    conversion_rate: float = 0.0
    avg_engagement: float = 0.0


class FeatureFlagService:
    """
    Feature flag management system.

    Features:
    - Boolean on/off flags
    - Percentage-based rollout
    - User-targeted flags
    - Environment-based flags (dev, staging, production)
    - Time-based flags (scheduled)
    - A/B testing with multiple variants
    - Gradual rollout over time
    - Flag dependencies
    - Audit trail
    - Real-time evaluation
    - Analytics on flag usage
    """

    def __init__(self, environment: str = "production"):
        self.environment = environment
        self._flags: Dict[str, FeatureFlag] = {}
        self._evaluations: List[FlagEvaluation] = []
        self._audit_log: List[FlagAuditEntry] = []
        self._ab_test_data: Dict[str, Dict[str, ABTestResult]] = {}
        self._evaluation_cache: Dict[str, Dict[str, bool]] = {}
        self._listeners: Dict[str, List[Callable]] = {}
        self._init_default_flags()

    def _init_default_flags(self):
        """Initialize default feature flags."""
        default_flags = [
            FeatureFlag(
                id="dark-mode-v2",
                name="Dark Mode V2",
                description="Enhanced dark mode with OLED-optimized colors and smooth transitions",
                flag_type=FlagType.BOOLEAN,
                enabled=True,
                tags=["ui", "theme"],
                category="UI",
            ),
            FeatureFlag(
                id="ai-suggestions",
                name="AI-Powered Suggestions",
                description="Show AI-powered suggestions in the command palette and search",
                flag_type=FlagType.PERCENTAGE,
                enabled=True,
                percentage=75.0,
                tags=["ai", "ux"],
                category="AI",
            ),
            FeatureFlag(
                id="new-dashboard",
                name="New Dashboard Layout",
                description="Redesigned dashboard with customizable widget grid",
                flag_type=FlagType.AB_TEST,
                enabled=True,
                variants={
                    "control": 33.3,
                    "variant_a": 33.3,
                    "variant_b": 33.4,
                },
                tags=["ui", "dashboard"],
                category="UI",
            ),
            FeatureFlag(
                id="voice-commands-v3",
                name="Voice Commands V3",
                description="Advanced voice commands with natural language processing",
                flag_type=FlagType.GRADUAL_ROLLOUT,
                enabled=True,
                rollout_start=time.time() - 86400 * 7,
                rollout_end=time.time() + 86400 * 21,
                rollout_start_percentage=10.0,
                rollout_end_percentage=100.0,
                tags=["voice", "ai"],
                category="Voice",
            ),
            FeatureFlag(
                id="real-time-collab",
                name="Real-time Collaboration",
                description="Multi-user real-time collaboration on tasks and documents",
                flag_type=FlagType.USER_LIST,
                enabled=True,
                allowed_users=["admin", "demo"],
                tags=["collaboration", "beta"],
                category="Collaboration",
            ),
            FeatureFlag(
                id="advanced-analytics",
                name="Advanced Analytics Dashboard",
                description="Detailed analytics with custom reports and data export",
                flag_type=FlagType.ENVIRONMENT,
                enabled=True,
                environments=["production", "staging"],
                tags=["analytics", "reporting"],
                category="Analytics",
            ),
            FeatureFlag(
                id="plugin-marketplace",
                name="Plugin Marketplace",
                description="Browse and install plugins from the marketplace",
                flag_type=FlagType.BOOLEAN,
                enabled=True,
                tags=["plugins", "marketplace"],
                category="Plugins",
            ),
            FeatureFlag(
                id="3d-visualization",
                name="3D Data Visualization",
                description="Interactive 3D charts and network topology visualization",
                flag_type=FlagType.PERCENTAGE,
                enabled=True,
                percentage=50.0,
                tags=["visualization", "3d", "beta"],
                category="UI",
            ),
            FeatureFlag(
                id="auto-backup",
                name="Automatic Cloud Backup",
                description="Automatically backup data to cloud storage on schedule",
                flag_type=FlagType.BOOLEAN,
                enabled=False,
                tags=["backup", "cloud"],
                category="System",
            ),
            FeatureFlag(
                id="smart-notifications",
                name="Smart Notification Grouping",
                description="AI-powered notification grouping and priority sorting",
                flag_type=FlagType.PERCENTAGE,
                enabled=True,
                percentage=60.0,
                tags=["notifications", "ai"],
                category="AI",
            ),
            FeatureFlag(
                id="biometric-auth",
                name="Biometric Authentication",
                description="Support for fingerprint and face recognition login",
                flag_type=FlagType.TIME_BASED,
                enabled=True,
                start_time=time.time() - 86400,
                end_time=time.time() + 86400 * 30,
                tags=["security", "auth"],
                category="Security",
            ),
            FeatureFlag(
                id="workflow-builder",
                name="Visual Workflow Builder",
                description="Drag-and-drop workflow builder with conditional logic",
                flag_type=FlagType.BOOLEAN,
                enabled=True,
                tags=["workflow", "automation"],
                category="Automation",
            ),
        ]

        for flag in default_flags:
            self._flags[flag.id] = flag

    async def create_flag(self, flag: FeatureFlag) -> FeatureFlag:
        """Create a new feature flag."""
        if flag.id in self._flags:
            raise ValueError(f"Flag '{flag.id}' already exists")
        flag.created_at = time.time()
        flag.updated_at = time.time()
        self._flags[flag.id] = flag
        self._add_audit("create", flag.id, None, flag.enabled, flag.created_by)
        return flag

    async def update_flag(
        self, flag_id: str, updates: Dict[str, Any], user_id: str = "system"
    ) -> FeatureFlag:
        """Update an existing feature flag."""
        flag = self._flags.get(flag_id)
        if not flag:
            raise ValueError(f"Flag '{flag_id}' not found")

        for key, value in updates.items():
            if hasattr(flag, key):
                old_value = getattr(flag, key)
                setattr(flag, key, value)
                self._add_audit(
                    f"update_{key}", flag_id, old_value, value, user_id
                )

        flag.updated_at = time.time()
        self._evaluation_cache.pop(flag_id, None)

        for listener in self._listeners.get(flag_id, []):
            try:
                if asyncio.iscoroutinefunction(listener):
                    await listener(flag)
                else:
                    listener(flag)
            except Exception:
                pass

        return flag

    async def delete_flag(self, flag_id: str, user_id: str = "system") -> bool:
        """Delete a feature flag."""
        if flag_id not in self._flags:
            raise ValueError(f"Flag '{flag_id}' not found")
        self._add_audit("delete", flag_id, True, None, user_id)
        del self._flags[flag_id]
        self._evaluation_cache.pop(flag_id, None)
        return True

    async def evaluate(
        self, flag_id: str, user_id: str = "anonymous", context: Dict[str, Any] = None
    ) -> FlagEvaluation:
        """Evaluate a feature flag for a specific user."""
        flag = self._flags.get(flag_id)
        if not flag or flag.status != FlagStatus.ACTIVE:
            return FlagEvaluation(
                flag_id=flag_id, user_id=user_id, enabled=False, reason="flag_not_found"
            )

        if not flag.enabled:
            return FlagEvaluation(
                flag_id=flag_id, user_id=user_id, enabled=False, reason="flag_disabled"
            )

        for dep_id in flag.dependencies:
            dep_eval = await self.evaluate(dep_id, user_id, context)
            if not dep_eval.enabled:
                return FlagEvaluation(
                    flag_id=flag_id,
                    user_id=user_id,
                    enabled=False,
                    reason=f"dependency_{dep_id}_not_met",
                )

        if user_id in flag.blocked_users:
            return FlagEvaluation(
                flag_id=flag_id, user_id=user_id, enabled=False, reason="user_blocked"
            )

        evaluation = self._evaluate_by_type(flag, user_id, context)
        self._evaluations.append(evaluation)

        if len(self._evaluations) > 10000:
            self._evaluations = self._evaluations[-5000:]

        return evaluation

    def _evaluate_by_type(
        self, flag: FeatureFlag, user_id: str, context: Dict[str, Any] = None
    ) -> FlagEvaluation:
        """Evaluate flag based on its type."""
        if flag.flag_type == FlagType.BOOLEAN:
            return FlagEvaluation(
                flag_id=flag.id,
                user_id=user_id,
                enabled=flag.enabled,
                reason="boolean_flag",
            )

        elif flag.flag_type == FlagType.PERCENTAGE:
            user_hash = self._user_hash(flag.id, user_id)
            enabled = user_hash < flag.percentage
            return FlagEvaluation(
                flag_id=flag.id,
                user_id=user_id,
                enabled=enabled,
                reason=f"percentage_{flag.percentage}%",
            )

        elif flag.flag_type == FlagType.USER_LIST:
            enabled = user_id in flag.allowed_users
            return FlagEvaluation(
                flag_id=flag.id,
                user_id=user_id,
                enabled=enabled,
                reason="user_list",
            )

        elif flag.flag_type == FlagType.ENVIRONMENT:
            enabled = self.environment in flag.environments
            return FlagEvaluation(
                flag_id=flag.id,
                user_id=user_id,
                enabled=enabled,
                reason=f"environment_{self.environment}",
            )

        elif flag.flag_type == FlagType.TIME_BASED:
            now = time.time()
            enabled = True
            if flag.start_time and now < flag.start_time:
                enabled = False
            if flag.end_time and now > flag.end_time:
                enabled = False
            return FlagEvaluation(
                flag_id=flag.id,
                user_id=user_id,
                enabled=enabled,
                reason="time_based",
            )

        elif flag.flag_type == FlagType.AB_TEST:
            variant = self._assign_variant(flag, user_id)
            enabled = variant != "control"
            evaluation = FlagEvaluation(
                flag_id=flag.id,
                user_id=user_id,
                enabled=enabled,
                variant=variant,
                reason=f"ab_test_{variant}",
            )
            self._track_ab_impression(flag.id, variant)
            return evaluation

        elif flag.flag_type == FlagType.GRADUAL_ROLLOUT:
            current_percentage = self._calculate_rollout_percentage(flag)
            user_hash = self._user_hash(flag.id, user_id)
            enabled = user_hash < current_percentage
            return FlagEvaluation(
                flag_id=flag.id,
                user_id=user_id,
                enabled=enabled,
                reason=f"gradual_rollout_{current_percentage:.1f}%",
            )

        return FlagEvaluation(
            flag_id=flag.id,
            user_id=user_id,
            enabled=False,
            reason="unknown_type",
        )

    def _user_hash(self, flag_id: str, user_id: str) -> float:
        """Deterministic hash of user+flag to a 0-100 value."""
        combined = f"{flag_id}:{user_id}"
        hash_val = int(hashlib.md5(combined.encode()).hexdigest(), 16)
        return (hash_val % 10000) / 100.0

    def _assign_variant(self, flag: FeatureFlag, user_id: str) -> str:
        """Assign a consistent A/B test variant to a user."""
        if not flag.variants:
            return "control"
        user_hash = self._user_hash(flag.id, user_id)
        cumulative = 0.0
        for variant, percentage in flag.variants.items():
            cumulative += percentage
            if user_hash < cumulative:
                return variant
        return list(flag.variants.keys())[-1]

    def _calculate_rollout_percentage(self, flag: FeatureFlag) -> float:
        """Calculate current percentage for gradual rollout."""
        if not flag.rollout_start or not flag.rollout_end:
            return flag.rollout_end_percentage

        now = time.time()
        if now <= flag.rollout_start:
            return flag.rollout_start_percentage
        if now >= flag.rollout_end:
            return flag.rollout_end_percentage

        progress = (now - flag.rollout_start) / (flag.rollout_end - flag.rollout_start)
        return flag.rollout_start_percentage + progress * (
            flag.rollout_end_percentage - flag.rollout_start_percentage
        )

    def _track_ab_impression(self, flag_id: str, variant: str):
        """Track an A/B test impression."""
        if flag_id not in self._ab_test_data:
            self._ab_test_data[flag_id] = {}
        if variant not in self._ab_test_data[flag_id]:
            self._ab_test_data[flag_id][variant] = ABTestResult(
                flag_id=flag_id, variant=variant
            )
        self._ab_test_data[flag_id][variant].impressions += 1

    async def track_conversion(self, flag_id: str, user_id: str):
        """Track an A/B test conversion."""
        flag = self._flags.get(flag_id)
        if not flag or flag.flag_type != FlagType.AB_TEST:
            return

        variant = self._assign_variant(flag, user_id)
        if flag_id in self._ab_test_data and variant in self._ab_test_data[flag_id]:
            result = self._ab_test_data[flag_id][variant]
            result.conversions += 1
            if result.impressions > 0:
                result.conversion_rate = result.conversions / result.impressions

    async def get_flag(self, flag_id: str) -> Optional[Dict[str, Any]]:
        """Get a feature flag by ID."""
        flag = self._flags.get(flag_id)
        if not flag:
            return None
        return self._serialize_flag(flag)

    async def list_flags(
        self,
        category: Optional[str] = None,
        status: Optional[FlagStatus] = None,
        tag: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List all feature flags."""
        flags = list(self._flags.values())
        if category:
            flags = [f for f in flags if f.category == category]
        if status:
            flags = [f for f in flags if f.status == status]
        if tag:
            flags = [f for f in flags if tag in f.tags]
        return [self._serialize_flag(f) for f in flags]

    async def get_ab_test_results(
        self, flag_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get A/B test results for a flag."""
        if flag_id not in self._ab_test_data:
            return None
        return {
            "flag_id": flag_id,
            "variants": {
                variant: {
                    "impressions": result.impressions,
                    "conversions": result.conversions,
                    "conversion_rate": round(result.conversion_rate * 100, 2),
                }
                for variant, result in self._ab_test_data[flag_id].items()
            },
        }

    async def get_evaluation_stats(
        self, flag_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get evaluation statistics."""
        evals = self._evaluations
        if flag_id:
            evals = [e for e in evals if e.flag_id == flag_id]

        enabled_count = sum(1 for e in evals if e.enabled)
        disabled_count = sum(1 for e in evals if not e.enabled)
        total = len(evals)

        return {
            "total_evaluations": total,
            "enabled": enabled_count,
            "disabled": disabled_count,
            "enable_rate": round(enabled_count / total * 100, 2) if total > 0 else 0,
            "unique_users": len(set(e.user_id for e in evals)),
            "unique_flags": len(set(e.flag_id for e in evals)),
        }

    async def get_audit_log(
        self, flag_id: Optional[str] = None, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get audit log entries."""
        entries = self._audit_log
        if flag_id:
            entries = [e for e in entries if e.flag_id == flag_id]
        entries = entries[-limit:][::-1]
        return [
            {
                "id": e.id,
                "flag_id": e.flag_id,
                "action": e.action,
                "old_value": e.old_value,
                "new_value": e.new_value,
                "user_id": e.user_id,
                "timestamp": e.timestamp,
                "details": e.details,
            }
            for e in entries
        ]

    def on_change(self, flag_id: str, listener: Callable):
        """Register a change listener for a flag."""
        if flag_id not in self._listeners:
            self._listeners[flag_id] = []
        self._listeners[flag_id].append(listener)

    def _add_audit(
        self, action: str, flag_id: str, old_value: Any, new_value: Any, user_id: str
    ):
        self._audit_log.append(
            FlagAuditEntry(
                id=str(uuid.uuid4()),
                flag_id=flag_id,
                action=action,
                old_value=old_value,
                new_value=new_value,
                user_id=user_id,
            )
        )

    def _serialize_flag(self, flag: FeatureFlag) -> Dict[str, Any]:
        result = {
            "id": flag.id,
            "name": flag.name,
            "description": flag.description,
            "flag_type": flag.flag_type.value,
            "status": flag.status.value,
            "enabled": flag.enabled,
            "percentage": flag.percentage,
            "allowed_users": flag.allowed_users,
            "environments": flag.environments,
            "variants": flag.variants,
            "tags": flag.tags,
            "category": flag.category,
            "dependencies": flag.dependencies,
            "metadata": flag.metadata,
            "created_at": flag.created_at,
            "updated_at": flag.updated_at,
            "created_by": flag.created_by,
        }
        if flag.flag_type == FlagType.GRADUAL_ROLLOUT:
            result["current_rollout_percentage"] = round(
                self._calculate_rollout_percentage(flag), 1
            )
        return result


# ── Singleton ─────────────────────────────────────────────────────────
_feature_flag_service: Optional[FeatureFlagService] = None

def get_feature_flag_service() -> FeatureFlagService:
    global _feature_flag_service
    if _feature_flag_service is None:
        _feature_flag_service = FeatureFlagService()
    return _feature_flag_service
