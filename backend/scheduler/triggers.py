"""
Nexus AI OS - Event-Driven Triggers
System event triggers, time-based triggers, condition-based triggers,
compound triggers (AND/OR), templates, history, webhook triggers.
"""

import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional, Tuple

logger = logging.getLogger("nexus.scheduler.triggers")

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class TriggerType(str, Enum):
    EVENT = "event"
    TIME = "time"
    CONDITION = "condition"
    COMPOUND = "compound"
    WEBHOOK = "webhook"


class CompoundOp(str, Enum):
    AND = "and"
    OR = "or"


class TriggerStatus(str, Enum):
    ACTIVE = "active"
    DISABLED = "disabled"
    FIRED = "fired"
    ERROR = "error"


# ---------------------------------------------------------------------------
# Condition evaluator
# ---------------------------------------------------------------------------


class ConditionEvaluator:
    """Evaluates simple conditions like 'cpu > 90' against a context dict."""

    OPERATORS = {
        ">": lambda a, b: a > b,
        "<": lambda a, b: a < b,
        ">=": lambda a, b: a >= b,
        "<=": lambda a, b: a <= b,
        "==": lambda a, b: a == b,
        "!=": lambda a, b: a != b,
        "contains": lambda a, b: b in str(a),
        "not_contains": lambda a, b: b not in str(a),
        "starts_with": lambda a, b: str(a).startswith(str(b)),
        "ends_with": lambda a, b: str(a).endswith(str(b)),
        "in": lambda a, b: a in b,
        "not_in": lambda a, b: a not in b,
    }

    @classmethod
    def evaluate(cls, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """
        Evaluate a condition dict against a context.
        Condition format: {"field": "cpu_percent", "op": ">", "value": 90}
        """
        field = condition.get("field", "")
        op = condition.get("op", "==")
        expected = condition.get("value")

        # Support nested field access via dot notation
        actual = context
        for part in field.split("."):
            if isinstance(actual, dict):
                actual = actual.get(part)
            else:
                actual = None
                break

        if actual is None:
            return False

        op_func = cls.OPERATORS.get(op)
        if op_func is None:
            logger.warning("Unknown operator: %s", op)
            return False

        try:
            # Type coercion for numeric comparisons
            if op in (">", "<", ">=", "<=") and not isinstance(actual, (int, float)):
                actual = float(actual)
            return op_func(actual, expected)
        except (TypeError, ValueError) as exc:
            logger.debug("Condition evaluation error: %s", exc)
            return False


# ---------------------------------------------------------------------------
# Trigger definition
# ---------------------------------------------------------------------------


class TriggerDef:
    """Defines a single trigger."""

    def __init__(
        self,
        trigger_id: str,
        name: str,
        trigger_type: TriggerType,
        action_name: str,
        action_kwargs: Optional[Dict[str, Any]] = None,
        # event triggers
        event_name: Optional[str] = None,
        event_filter: Optional[Dict[str, Any]] = None,
        # condition triggers
        condition: Optional[Dict[str, Any]] = None,
        check_interval_seconds: int = 60,
        # compound triggers
        compound_op: CompoundOp = CompoundOp.AND,
        sub_trigger_ids: Optional[List[str]] = None,
        # webhook triggers
        webhook_path: Optional[str] = None,
        webhook_secret: Optional[str] = None,
        # general
        cooldown_seconds: int = 0,
        max_fires: int = 0,  # 0 = unlimited
        tags: Optional[List[str]] = None,
        description: str = "",
    ) -> None:
        self.trigger_id = trigger_id
        self.name = name
        self.trigger_type = trigger_type
        self.action_name = action_name
        self.action_kwargs = action_kwargs or {}
        self.event_name = event_name
        self.event_filter = event_filter
        self.condition = condition
        self.check_interval_seconds = check_interval_seconds
        self.compound_op = compound_op
        self.sub_trigger_ids = sub_trigger_ids or []
        self.webhook_path = webhook_path
        self.webhook_secret = webhook_secret
        self.cooldown_seconds = cooldown_seconds
        self.max_fires = max_fires
        self.tags = tags or []
        self.description = description

        self.status: TriggerStatus = TriggerStatus.ACTIVE
        self.fire_count: int = 0
        self.last_fired: Optional[str] = None
        self.last_result: Any = None
        self.last_error: Optional[str] = None
        self.created_at: str = datetime.now(timezone.utc).isoformat()
        self.enabled: bool = True

    def can_fire(self) -> bool:
        if not self.enabled or self.status == TriggerStatus.DISABLED:
            return False
        if self.max_fires > 0 and self.fire_count >= self.max_fires:
            return False
        if self.cooldown_seconds > 0 and self.last_fired:
            last = datetime.fromisoformat(self.last_fired)
            if (datetime.now(timezone.utc) - last).total_seconds() < self.cooldown_seconds:
                return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "trigger_id": self.trigger_id,
            "name": self.name,
            "trigger_type": self.trigger_type.value,
            "action_name": self.action_name,
            "event_name": self.event_name,
            "condition": self.condition,
            "compound_op": self.compound_op.value,
            "sub_trigger_ids": self.sub_trigger_ids,
            "webhook_path": self.webhook_path,
            "cooldown_seconds": self.cooldown_seconds,
            "max_fires": self.max_fires,
            "status": self.status.value,
            "fire_count": self.fire_count,
            "last_fired": self.last_fired,
            "last_error": self.last_error,
            "enabled": self.enabled,
            "created_at": self.created_at,
            "tags": self.tags,
            "description": self.description,
        }


# ---------------------------------------------------------------------------
# Trigger history
# ---------------------------------------------------------------------------


class TriggerHistoryEntry:
    def __init__(self, trigger_id: str, fired_at: str, success: bool, result: Any = None, error: Optional[str] = None):
        self.trigger_id = trigger_id
        self.fired_at = fired_at
        self.success = success
        self.result = result
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "trigger_id": self.trigger_id,
            "fired_at": self.fired_at,
            "success": self.success,
            "error": self.error,
        }


# ---------------------------------------------------------------------------
# Trigger templates
# ---------------------------------------------------------------------------


TRIGGER_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "high_cpu_alert": {
        "name": "High CPU Alert",
        "trigger_type": TriggerType.CONDITION,
        "condition": {"field": "cpu_percent", "op": ">", "value": 90},
        "cooldown_seconds": 300,
        "description": "Alert when CPU usage exceeds 90%",
    },
    "low_disk_alert": {
        "name": "Low Disk Space Alert",
        "trigger_type": TriggerType.CONDITION,
        "condition": {"field": "disk_percent", "op": ">", "value": 90},
        "cooldown_seconds": 3600,
        "description": "Alert when disk usage exceeds 90%",
    },
    "high_memory_alert": {
        "name": "High Memory Alert",
        "trigger_type": TriggerType.CONDITION,
        "condition": {"field": "memory_percent", "op": ">", "value": 85},
        "cooldown_seconds": 300,
        "description": "Alert when memory usage exceeds 85%",
    },
    "new_email": {
        "name": "New Email Notification",
        "trigger_type": TriggerType.EVENT,
        "event_name": "email.received",
        "description": "Trigger on new email received",
    },
    "model_training_complete": {
        "name": "Model Training Complete",
        "trigger_type": TriggerType.EVENT,
        "event_name": "training.completed",
        "description": "Trigger when model training finishes",
    },
    "daily_backup": {
        "name": "Daily Backup Reminder",
        "trigger_type": TriggerType.TIME,
        "description": "Daily backup check trigger",
    },
}


# ---------------------------------------------------------------------------
# Trigger Engine
# ---------------------------------------------------------------------------


class TriggerEngine:
    """Manages event-driven, condition-based, and compound triggers."""

    def __init__(self, persist_path: Optional[str] = None, history_limit: int = 500) -> None:
        self.triggers: Dict[str, TriggerDef] = {}
        self.history: List[TriggerHistoryEntry] = []
        self._action_registry: Dict[str, Callable] = {}
        self._condition_check_task: Optional[asyncio.Task] = None
        self._running = False
        self._persist_path = persist_path
        self._history_limit = history_limit

        if persist_path:
            self._load_state()

    # -- persistence ---------------------------------------------------------

    def _load_state(self) -> None:
        if not self._persist_path or not os.path.exists(self._persist_path):
            return
        try:
            with open(self._persist_path) as f:
                data = json.load(f)
            for td in data.get("triggers", []):
                t = self._trigger_from_dict(td)
                self.triggers[t.trigger_id] = t
            logger.info("Loaded %d triggers from %s", len(self.triggers), self._persist_path)
        except Exception as exc:
            logger.error("Failed to load triggers: %s", exc)

    def _save_state(self) -> None:
        if not self._persist_path:
            return
        os.makedirs(os.path.dirname(self._persist_path), exist_ok=True)
        data = {"triggers": [t.to_dict() for t in self.triggers.values()]}
        with open(self._persist_path, "w") as f:
            json.dump(data, f, indent=2)

    @staticmethod
    def _trigger_from_dict(d: Dict[str, Any]) -> TriggerDef:
        t = TriggerDef(
            trigger_id=d["trigger_id"],
            name=d["name"],
            trigger_type=TriggerType(d["trigger_type"]),
            action_name=d.get("action_name", ""),
            event_name=d.get("event_name"),
            condition=d.get("condition"),
            compound_op=CompoundOp(d.get("compound_op", "and")),
            sub_trigger_ids=d.get("sub_trigger_ids", []),
            webhook_path=d.get("webhook_path"),
            cooldown_seconds=d.get("cooldown_seconds", 0),
            max_fires=d.get("max_fires", 0),
            tags=d.get("tags", []),
            description=d.get("description", ""),
        )
        t.status = TriggerStatus(d.get("status", "active"))
        t.fire_count = d.get("fire_count", 0)
        t.last_fired = d.get("last_fired")
        t.enabled = d.get("enabled", True)
        t.created_at = d.get("created_at", "")
        return t

    # -- action registry -----------------------------------------------------

    def register_action(self, name: str, func: Callable) -> None:
        self._action_registry[name] = func

    # -- CRUD ----------------------------------------------------------------

    def create_trigger(self, **kwargs: Any) -> TriggerDef:
        trigger_id = kwargs.pop("trigger_id", f"trig_{uuid.uuid4().hex[:10]}")
        t = TriggerDef(trigger_id=trigger_id, **kwargs)
        self.triggers[trigger_id] = t
        self._save_state()
        logger.info("Created trigger %s (%s)", t.name, trigger_id)
        return t

    def create_from_template(self, template_name: str, action_name: str, **overrides: Any) -> Optional[TriggerDef]:
        template = TRIGGER_TEMPLATES.get(template_name)
        if not template:
            logger.warning("Unknown trigger template: %s", template_name)
            return None
        params = {**template, "action_name": action_name, **overrides}
        return self.create_trigger(**params)

    def get_trigger(self, trigger_id: str) -> Optional[Dict[str, Any]]:
        t = self.triggers.get(trigger_id)
        return t.to_dict() if t else None

    def update_trigger(self, trigger_id: str, **updates: Any) -> Optional[TriggerDef]:
        t = self.triggers.get(trigger_id)
        if not t:
            return None
        for key, value in updates.items():
            if hasattr(t, key):
                setattr(t, key, value)
        self._save_state()
        return t

    def delete_trigger(self, trigger_id: str) -> bool:
        if trigger_id not in self.triggers:
            return False
        del self.triggers[trigger_id]
        self._save_state()
        return True

    def enable_trigger(self, trigger_id: str) -> bool:
        t = self.triggers.get(trigger_id)
        if not t:
            return False
        t.enabled = True
        t.status = TriggerStatus.ACTIVE
        self._save_state()
        return True

    def disable_trigger(self, trigger_id: str) -> bool:
        t = self.triggers.get(trigger_id)
        if not t:
            return False
        t.enabled = False
        t.status = TriggerStatus.DISABLED
        self._save_state()
        return True

    def list_triggers(
        self,
        trigger_type: Optional[TriggerType] = None,
        tag: Optional[str] = None,
        enabled_only: bool = False,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for t in self.triggers.values():
            if trigger_type and t.trigger_type != trigger_type:
                continue
            if tag and tag not in t.tags:
                continue
            if enabled_only and not t.enabled:
                continue
            results.append(t.to_dict())
        return results

    # -- firing --------------------------------------------------------------

    async def fire_trigger(self, trigger_id: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        t = self.triggers.get(trigger_id)
        if not t:
            return {"error": "Trigger not found"}
        if not t.can_fire():
            return {"status": "skipped", "reason": "Cooldown or max fires reached"}

        action = self._action_registry.get(t.action_name)
        if not action:
            error = f"Action '{t.action_name}' not registered"
            t.last_error = error
            t.status = TriggerStatus.ERROR
            self._record_history(trigger_id, False, error=error)
            return {"error": error}

        try:
            kwargs = {**t.action_kwargs}
            if context:
                kwargs["trigger_context"] = context
            if asyncio.iscoroutinefunction(action):
                result = await action(**kwargs)
            else:
                result = action(**kwargs)
            t.fire_count += 1
            t.last_fired = datetime.now(timezone.utc).isoformat()
            t.last_result = result
            t.last_error = None
            t.status = TriggerStatus.FIRED if (t.max_fires > 0 and t.fire_count >= t.max_fires) else TriggerStatus.ACTIVE
            self._record_history(trigger_id, True, result=result)
            self._save_state()
            return {"status": "fired", "result": result}
        except Exception as exc:
            t.last_error = str(exc)
            t.status = TriggerStatus.ERROR
            self._record_history(trigger_id, False, error=str(exc))
            self._save_state()
            return {"error": str(exc)}

    # -- event handling ------------------------------------------------------

    async def handle_event(self, event_name: str, event_data: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Process an incoming event and fire matching triggers."""
        results: List[Dict[str, Any]] = []
        for t in self.triggers.values():
            if t.trigger_type != TriggerType.EVENT:
                continue
            if t.event_name != event_name:
                continue
            if not t.can_fire():
                continue
            # Apply event filter if present
            if t.event_filter and event_data:
                match = all(
                    ConditionEvaluator.evaluate({"field": k, "op": "==", "value": v}, event_data)
                    for k, v in t.event_filter.items()
                )
                if not match:
                    continue
            result = await self.fire_trigger(t.trigger_id, context=event_data)
            results.append({"trigger_id": t.trigger_id, **result})
        return results

    # -- condition checking --------------------------------------------------

    async def check_conditions(self, system_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Evaluate all condition-based triggers against the current system context."""
        results: List[Dict[str, Any]] = []
        for t in self.triggers.values():
            if t.trigger_type != TriggerType.CONDITION:
                continue
            if not t.can_fire() or not t.condition:
                continue
            if ConditionEvaluator.evaluate(t.condition, system_context):
                result = await self.fire_trigger(t.trigger_id, context=system_context)
                results.append({"trigger_id": t.trigger_id, **result})
        return results

    # -- compound trigger evaluation -----------------------------------------

    async def evaluate_compound(self, trigger_id: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        t = self.triggers.get(trigger_id)
        if not t or t.trigger_type != TriggerType.COMPOUND:
            return {"error": "Not a compound trigger"}
        if not t.can_fire():
            return {"status": "skipped"}

        sub_results: List[bool] = []
        for sub_id in t.sub_trigger_ids:
            sub = self.triggers.get(sub_id)
            if not sub:
                sub_results.append(False)
                continue
            if sub.trigger_type == TriggerType.CONDITION and sub.condition:
                sub_results.append(ConditionEvaluator.evaluate(sub.condition, context or {}))
            elif sub.trigger_type == TriggerType.EVENT:
                # Event sub-triggers are True if they've fired recently
                sub_results.append(sub.last_fired is not None)
            else:
                sub_results.append(False)

        should_fire = all(sub_results) if t.compound_op == CompoundOp.AND else any(sub_results)
        if should_fire:
            return await self.fire_trigger(trigger_id, context=context)
        return {"status": "not_met", "sub_results": sub_results}

    # -- webhook handling ----------------------------------------------------

    async def handle_webhook(self, path: str, payload: Dict[str, Any], secret: Optional[str] = None) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for t in self.triggers.values():
            if t.trigger_type != TriggerType.WEBHOOK:
                continue
            if t.webhook_path != path:
                continue
            if t.webhook_secret and t.webhook_secret != secret:
                continue
            if not t.can_fire():
                continue
            result = await self.fire_trigger(t.trigger_id, context=payload)
            results.append({"trigger_id": t.trigger_id, **result})
        return results

    # -- background condition-checking loop ----------------------------------

    async def start_condition_loop(
        self,
        context_provider: Callable[[], Coroutine[Any, Any, Dict[str, Any]]],
        interval: int = 30,
    ) -> None:
        """Start a background loop that periodically checks condition triggers."""
        self._running = True

        async def _loop() -> None:
            while self._running:
                try:
                    ctx = await context_provider()
                    await self.check_conditions(ctx)
                    # Also evaluate compound triggers
                    for t in list(self.triggers.values()):
                        if t.trigger_type == TriggerType.COMPOUND and t.can_fire():
                            await self.evaluate_compound(t.trigger_id, ctx)
                except Exception as exc:
                    logger.error("Condition check loop error: %s", exc)
                await asyncio.sleep(interval)

        self._condition_check_task = asyncio.create_task(_loop())
        logger.info("Condition check loop started (interval=%ds)", interval)

    async def stop_condition_loop(self) -> None:
        self._running = False
        if self._condition_check_task:
            self._condition_check_task.cancel()
            try:
                await self._condition_check_task
            except asyncio.CancelledError:
                pass
            self._condition_check_task = None

    # -- history -------------------------------------------------------------

    def _record_history(self, trigger_id: str, success: bool, result: Any = None, error: Optional[str] = None) -> None:
        entry = TriggerHistoryEntry(
            trigger_id=trigger_id,
            fired_at=datetime.now(timezone.utc).isoformat(),
            success=success,
            result=result,
            error=error,
        )
        self.history.append(entry)
        if len(self.history) > self._history_limit:
            self.history = self.history[-self._history_limit:]

    def get_history(self, trigger_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        entries = self.history
        if trigger_id:
            entries = [e for e in entries if e.trigger_id == trigger_id]
        return [e.to_dict() for e in entries[-limit:]]

    # -- stats ---------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        by_type: Dict[str, int] = {}
        for t in self.triggers.values():
            by_type[t.trigger_type.value] = by_type.get(t.trigger_type.value, 0) + 1
        total_fires = sum(t.fire_count for t in self.triggers.values())
        return {
            "total_triggers": len(self.triggers),
            "by_type": by_type,
            "active": sum(1 for t in self.triggers.values() if t.enabled),
            "disabled": sum(1 for t in self.triggers.values() if not t.enabled),
            "total_fires": total_fires,
            "history_entries": len(self.history),
            "registered_actions": list(self._action_registry.keys()),
            "available_templates": list(TRIGGER_TEMPLATES.keys()),
        }

    def list_templates(self) -> Dict[str, Dict[str, Any]]:
        return {k: {**v, "trigger_type": v["trigger_type"].value if isinstance(v["trigger_type"], TriggerType) else v["trigger_type"]} for k, v in TRIGGER_TEMPLATES.items()}
