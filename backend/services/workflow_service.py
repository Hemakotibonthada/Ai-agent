"""
Workflow & Automation Engine
Features: Visual workflow builder, triggers, conditions, actions, scheduling,
          webhook handlers, template library, execution history
"""
from __future__ import annotations

import asyncio
import secrets
import time
from collections import defaultdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Type

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────
class WorkflowStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"
    ERROR = "error"


class NodeType(str, Enum):
    TRIGGER = "trigger"
    CONDITION = "condition"
    ACTION = "action"
    DELAY = "delay"
    LOOP = "loop"
    BRANCH = "branch"
    TRANSFORM = "transform"
    WEBHOOK = "webhook"
    AGENT = "agent"
    NOTIFICATION = "notification"
    API_CALL = "api_call"
    DATA_STORE = "data_store"
    EMAIL = "email"
    LOG = "log"
    END = "end"


class TriggerType(str, Enum):
    SCHEDULE = "schedule"
    WEBHOOK = "webhook"
    EVENT = "event"
    MANUAL = "manual"
    DEVICE_STATE = "device_state"
    METRIC_THRESHOLD = "metric_threshold"
    API_ENDPOINT = "api_endpoint"
    FILE_CHANGE = "file_change"
    TIME_OF_DAY = "time_of_day"


class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"
    PAUSED = "paused"


class ConditionOperator(str, Enum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    MATCHES_REGEX = "matches_regex"
    IN_LIST = "in_list"
    BETWEEN = "between"


# ── Models ───────────────────────────────────────────────────────────
class Position(BaseModel):
    x: float = 0
    y: float = 0


class WorkflowNode(BaseModel):
    id: str = Field(default_factory=lambda: f"node-{secrets.token_hex(6)}")
    type: NodeType
    name: str
    description: str = ""
    position: Position = Position()
    config: Dict[str, Any] = {}
    inputs: List[str] = []
    outputs: List[str] = []
    metadata: Dict[str, Any] = {}


class WorkflowEdge(BaseModel):
    id: str = Field(default_factory=lambda: f"edge-{secrets.token_hex(6)}")
    source: str
    target: str
    label: str = ""
    condition: Optional[str] = None


class WorkflowCondition(BaseModel):
    field: str
    operator: ConditionOperator
    value: Any
    and_conditions: List["WorkflowCondition"] = []
    or_conditions: List["WorkflowCondition"] = []


class Workflow(BaseModel):
    id: str = Field(default_factory=lambda: f"wf-{secrets.token_hex(8)}")
    name: str
    description: str = ""
    status: WorkflowStatus = WorkflowStatus.DRAFT
    nodes: List[WorkflowNode] = []
    edges: List[WorkflowEdge] = []
    trigger: Optional[Dict[str, Any]] = None
    variables: Dict[str, Any] = {}
    tags: List[str] = []
    category: str = "general"
    version: int = 1
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: str = ""
    last_run: Optional[str] = None
    run_count: int = 0
    avg_duration_ms: float = 0
    error_count: int = 0


class NodeExecution(BaseModel):
    node_id: str
    node_name: str
    node_type: NodeType
    status: ExecutionStatus
    started_at: str
    completed_at: Optional[str] = None
    duration_ms: float = 0
    input_data: Dict[str, Any] = {}
    output_data: Dict[str, Any] = {}
    error: Optional[str] = None
    logs: List[str] = []


class WorkflowExecution(BaseModel):
    id: str = Field(default_factory=lambda: f"exec-{secrets.token_hex(8)}")
    workflow_id: str
    workflow_name: str
    status: ExecutionStatus = ExecutionStatus.PENDING
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    duration_ms: float = 0
    trigger_type: str = "manual"
    trigger_data: Dict[str, Any] = {}
    node_executions: List[NodeExecution] = []
    variables: Dict[str, Any] = {}
    error: Optional[str] = None
    output: Dict[str, Any] = {}


class WorkflowTemplate(BaseModel):
    id: str
    name: str
    description: str
    category: str
    icon: str = "zap"
    tags: List[str] = []
    workflow: Workflow
    popularity: int = 0


class WebhookConfig(BaseModel):
    id: str = Field(default_factory=lambda: f"wh-{secrets.token_hex(8)}")
    workflow_id: str
    url: str = ""
    secret: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    events: List[str] = ["*"]
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_triggered: Optional[str] = None
    trigger_count: int = 0


# ── Workflow Engine ──────────────────────────────────────────────────
class WorkflowEngine:
    """Executes workflow graphs, evaluating conditions and running actions."""

    def __init__(self):
        self._workflows: Dict[str, Workflow] = {}
        self._executions: List[WorkflowExecution] = []
        self._webhooks: Dict[str, WebhookConfig] = {}
        self._templates: List[WorkflowTemplate] = []
        self._action_handlers: Dict[NodeType, Callable] = {}
        self._event_listeners: Dict[str, List[str]] = defaultdict(list)
        self._running: Dict[str, bool] = {}

        # Initialize templates
        self._init_templates()
        self._register_default_handlers()

    def _register_default_handlers(self):
        self._action_handlers[NodeType.LOG] = self._handle_log
        self._action_handlers[NodeType.DELAY] = self._handle_delay
        self._action_handlers[NodeType.TRANSFORM] = self._handle_transform
        self._action_handlers[NodeType.CONDITION] = self._handle_condition
        self._action_handlers[NodeType.NOTIFICATION] = self._handle_notification
        self._action_handlers[NodeType.DATA_STORE] = self._handle_data_store
        self._action_handlers[NodeType.AGENT] = self._handle_agent
        self._action_handlers[NodeType.API_CALL] = self._handle_api_call
        self._action_handlers[NodeType.EMAIL] = self._handle_email

    async def _handle_log(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
        message = node.config.get("message", "")
        level = node.config.get("level", "info")
        return {"logged": True, "message": message, "level": level}

    async def _handle_delay(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
        delay_ms = node.config.get("delay_ms", 1000)
        await asyncio.sleep(min(delay_ms / 1000, 30))  # Cap at 30s
        return {"delayed_ms": delay_ms}

    async def _handle_transform(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
        transform_type = node.config.get("transform", "passthrough")
        data = context.get("data", {})

        if transform_type == "uppercase":
            return {k: v.upper() if isinstance(v, str) else v for k, v in data.items()}
        elif transform_type == "lowercase":
            return {k: v.lower() if isinstance(v, str) else v for k, v in data.items()}
        elif transform_type == "filter":
            filter_key = node.config.get("filter_key", "")
            filter_value = node.config.get("filter_value", "")
            if isinstance(data, list):
                return {"filtered": [d for d in data if d.get(filter_key) == filter_value]}
            return data
        elif transform_type == "map":
            mapping = node.config.get("mapping", {})
            return {mapping.get(k, k): v for k, v in data.items()}
        return data

    async def _handle_condition(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
        field = node.config.get("field", "")
        operator = node.config.get("operator", "equals")
        value = node.config.get("value")
        actual = context.get(field, context.get("data", {}).get(field))

        result = False
        if operator == "equals":
            result = actual == value
        elif operator == "not_equals":
            result = actual != value
        elif operator == "greater_than":
            result = (actual or 0) > (value or 0)
        elif operator == "less_than":
            result = (actual or 0) < (value or 0)
        elif operator == "contains":
            result = str(value) in str(actual)
        elif operator == "is_empty":
            result = not actual
        elif operator == "is_not_empty":
            result = bool(actual)

        return {"condition_result": result, "branch": "true" if result else "false"}

    async def _handle_notification(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "notification_sent": True,
            "channel": node.config.get("channel", "in_app"),
            "title": node.config.get("title", "Workflow Notification"),
            "message": node.config.get("message", ""),
        }

    async def _handle_data_store(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
        operation = node.config.get("operation", "read")
        key = node.config.get("key", "")
        return {"operation": operation, "key": key, "success": True}

    async def _handle_agent(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
        agent_name = node.config.get("agent", "personal")
        action = node.config.get("action", "process")
        return {"agent": agent_name, "action": action, "result": "processed"}

    async def _handle_api_call(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
        url = node.config.get("url", "")
        method = node.config.get("method", "GET")
        return {"url": url, "method": method, "status": 200, "response": {}}

    async def _handle_email(self, node: WorkflowNode, context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "email_sent": True,
            "to": node.config.get("to", ""),
            "subject": node.config.get("subject", ""),
        }

    def _init_templates(self):
        self._templates = [
            WorkflowTemplate(
                id="tpl-daily-summary",
                name="Daily Summary Report",
                description="Generate and send a daily summary report at a scheduled time",
                category="reports",
                icon="file-text",
                tags=["daily", "report", "automated"],
                workflow=Workflow(
                    name="Daily Summary",
                    nodes=[
                        WorkflowNode(id="n1", type=NodeType.TRIGGER, name="Daily Schedule",
                                     config={"type": "schedule", "cron": "0 8 * * *"}),
                        WorkflowNode(id="n2", type=NodeType.AGENT, name="Gather Data",
                                     config={"agent": "report", "action": "gather_metrics"}),
                        WorkflowNode(id="n3", type=NodeType.TRANSFORM, name="Format Report",
                                     config={"transform": "template", "template": "daily_summary"}),
                        WorkflowNode(id="n4", type=NodeType.EMAIL, name="Send Email",
                                     config={"subject": "Daily Summary", "template": "report"}),
                    ],
                    edges=[
                        WorkflowEdge(source="n1", target="n2"),
                        WorkflowEdge(source="n2", target="n3"),
                        WorkflowEdge(source="n3", target="n4"),
                    ],
                ),
            ),
            WorkflowTemplate(
                id="tpl-security-alert",
                name="Security Alert Pipeline",
                description="Detect and respond to security events automatically",
                category="security",
                icon="shield",
                tags=["security", "alert", "monitoring"],
                workflow=Workflow(
                    name="Security Alerts",
                    nodes=[
                        WorkflowNode(id="n1", type=NodeType.TRIGGER, name="Security Event",
                                     config={"type": "event", "event": "security.*"}),
                        WorkflowNode(id="n2", type=NodeType.CONDITION, name="Check Severity",
                                     config={"field": "severity", "operator": "greater_than", "value": 7}),
                        WorkflowNode(id="n3", type=NodeType.NOTIFICATION, name="Alert Admin",
                                     config={"channel": "push", "priority": "high"}),
                        WorkflowNode(id="n4", type=NodeType.LOG, name="Log Event",
                                     config={"level": "warning"}),
                        WorkflowNode(id="n5", type=NodeType.AGENT, name="Investigate",
                                     config={"agent": "security", "action": "investigate"}),
                    ],
                    edges=[
                        WorkflowEdge(source="n1", target="n2"),
                        WorkflowEdge(source="n2", target="n3", condition="true"),
                        WorkflowEdge(source="n2", target="n4", condition="false"),
                        WorkflowEdge(source="n3", target="n5"),
                    ],
                ),
            ),
            WorkflowTemplate(
                id="tpl-smart-home",
                name="Smart Home Automation",
                description="Automate home devices based on conditions and schedules",
                category="home",
                icon="home",
                tags=["home", "iot", "automation"],
                workflow=Workflow(
                    name="Smart Home",
                    nodes=[
                        WorkflowNode(id="n1", type=NodeType.TRIGGER, name="Motion Detected",
                                     config={"type": "device_state", "device": "motion_sensor"}),
                        WorkflowNode(id="n2", type=NodeType.CONDITION, name="Is Night Time",
                                     config={"field": "time_of_day", "operator": "between", "value": "18:00-06:00"}),
                        WorkflowNode(id="n3", type=NodeType.ACTION, name="Turn On Lights",
                                     config={"device": "living_room_lights", "action": "on", "brightness": 80}),
                        WorkflowNode(id="n4", type=NodeType.DELAY, name="Wait 10 min",
                                     config={"delay_ms": 600000}),
                        WorkflowNode(id="n5", type=NodeType.ACTION, name="Dim Lights",
                                     config={"device": "living_room_lights", "action": "dim", "brightness": 30}),
                    ],
                    edges=[
                        WorkflowEdge(source="n1", target="n2"),
                        WorkflowEdge(source="n2", target="n3", condition="true"),
                        WorkflowEdge(source="n3", target="n4"),
                        WorkflowEdge(source="n4", target="n5"),
                    ],
                ),
            ),
            WorkflowTemplate(
                id="tpl-health-check",
                name="Health Data Pipeline",
                description="Process and analyze health metrics automatically",
                category="health",
                icon="heart",
                tags=["health", "data", "monitoring"],
                workflow=Workflow(
                    name="Health Pipeline",
                    nodes=[
                        WorkflowNode(id="n1", type=NodeType.TRIGGER, name="New Health Data",
                                     config={"type": "event", "event": "health.metric_logged"}),
                        WorkflowNode(id="n2", type=NodeType.TRANSFORM, name="Normalize Data",
                                     config={"transform": "normalize"}),
                        WorkflowNode(id="n3", type=NodeType.AGENT, name="Analyze Trends",
                                     config={"agent": "health", "action": "analyze_trends"}),
                        WorkflowNode(id="n4", type=NodeType.CONDITION, name="Anomaly Detected?",
                                     config={"field": "anomaly_score", "operator": "greater_than", "value": 0.8}),
                        WorkflowNode(id="n5", type=NodeType.NOTIFICATION, name="Health Alert",
                                     config={"channel": "push", "title": "Health Anomaly Detected"}),
                    ],
                    edges=[
                        WorkflowEdge(source="n1", target="n2"),
                        WorkflowEdge(source="n2", target="n3"),
                        WorkflowEdge(source="n3", target="n4"),
                        WorkflowEdge(source="n4", target="n5", condition="true"),
                    ],
                ),
            ),
            WorkflowTemplate(
                id="tpl-data-backup",
                name="Automated Data Backup",
                description="Schedule regular data backups with verification",
                category="system",
                icon="database",
                tags=["backup", "data", "system"],
                workflow=Workflow(
                    name="Data Backup",
                    nodes=[
                        WorkflowNode(id="n1", type=NodeType.TRIGGER, name="Daily at 3 AM",
                                     config={"type": "schedule", "cron": "0 3 * * *"}),
                        WorkflowNode(id="n2", type=NodeType.ACTION, name="Create Backup",
                                     config={"action": "backup_database"}),
                        WorkflowNode(id="n3", type=NodeType.CONDITION, name="Backup OK?",
                                     config={"field": "success", "operator": "equals", "value": True}),
                        WorkflowNode(id="n4", type=NodeType.NOTIFICATION, name="Backup Success",
                                     config={"channel": "in_app", "title": "Backup Completed"}),
                        WorkflowNode(id="n5", type=NodeType.NOTIFICATION, name="Backup Failed",
                                     config={"channel": "push", "title": "Backup Failed!", "priority": "high"}),
                    ],
                    edges=[
                        WorkflowEdge(source="n1", target="n2"),
                        WorkflowEdge(source="n2", target="n3"),
                        WorkflowEdge(source="n3", target="n4", condition="true"),
                        WorkflowEdge(source="n3", target="n5", condition="false"),
                    ],
                ),
            ),
        ]

    # ── CRUD Operations ──────────────────────────────────
    def create_workflow(self, workflow: Workflow) -> Workflow:
        workflow.id = f"wf-{secrets.token_hex(8)}"
        workflow.created_at = datetime.now(timezone.utc).isoformat()
        workflow.updated_at = workflow.created_at
        self._workflows[workflow.id] = workflow
        return workflow

    def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        return self._workflows.get(workflow_id)

    def list_workflows(
        self,
        status: Optional[WorkflowStatus] = None,
        category: Optional[str] = None,
        limit: int = 50,
    ) -> List[Workflow]:
        wfs = list(self._workflows.values())
        if status:
            wfs = [w for w in wfs if w.status == status]
        if category:
            wfs = [w for w in wfs if w.category == category]
        return sorted(wfs, key=lambda w: w.updated_at, reverse=True)[:limit]

    def update_workflow(self, workflow_id: str, updates: Dict[str, Any]) -> Optional[Workflow]:
        wf = self._workflows.get(workflow_id)
        if not wf:
            return None
        data = wf.model_dump()
        data.update(updates)
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        data["version"] = wf.version + 1
        self._workflows[workflow_id] = Workflow(**data)
        return self._workflows[workflow_id]

    def delete_workflow(self, workflow_id: str) -> bool:
        return self._workflows.pop(workflow_id, None) is not None

    def duplicate_workflow(self, workflow_id: str) -> Optional[Workflow]:
        original = self._workflows.get(workflow_id)
        if not original:
            return None
        data = original.model_dump()
        data["id"] = f"wf-{secrets.token_hex(8)}"
        data["name"] = f"{original.name} (Copy)"
        data["status"] = WorkflowStatus.DRAFT
        data["run_count"] = 0
        data["error_count"] = 0
        data["created_at"] = datetime.now(timezone.utc).isoformat()
        data["updated_at"] = data["created_at"]
        new_wf = Workflow(**data)
        self._workflows[new_wf.id] = new_wf
        return new_wf

    # ── Execution ─────────────────────────────────────────
    async def execute_workflow(
        self,
        workflow_id: str,
        trigger_data: Optional[Dict[str, Any]] = None,
        trigger_type: str = "manual",
    ) -> WorkflowExecution:
        wf = self._workflows.get(workflow_id)
        if not wf:
            raise ValueError(f"Workflow {workflow_id} not found")

        execution = WorkflowExecution(
            workflow_id=workflow_id,
            workflow_name=wf.name,
            trigger_type=trigger_type,
            trigger_data=trigger_data or {},
            variables={**wf.variables},
        )
        execution.status = ExecutionStatus.RUNNING

        start_time = time.time()
        context: Dict[str, Any] = {"trigger": trigger_data or {}, "data": {}, "variables": wf.variables}

        try:
            # Build adjacency list
            adj: Dict[str, List[str]] = defaultdict(list)
            edge_conditions: Dict[str, str] = {}
            for edge in wf.edges:
                adj[edge.source].append(edge.target)
                if edge.condition:
                    edge_conditions[f"{edge.source}->{edge.target}"] = edge.condition

            # Find trigger nodes (no incoming edges)
            targets = set()
            for edge in wf.edges:
                targets.add(edge.target)
            start_nodes = [n.id for n in wf.nodes if n.id not in targets]

            if not start_nodes:
                start_nodes = [wf.nodes[0].id] if wf.nodes else []

            # BFS execution
            node_map = {n.id: n for n in wf.nodes}
            visited: set = set()
            queue = list(start_nodes)

            while queue:
                node_id = queue.pop(0)
                if node_id in visited:
                    continue
                visited.add(node_id)

                node = node_map.get(node_id)
                if not node:
                    continue

                node_start = time.time()
                node_exec = NodeExecution(
                    node_id=node.id,
                    node_name=node.name,
                    node_type=node.type,
                    status=ExecutionStatus.RUNNING,
                    started_at=datetime.now(timezone.utc).isoformat(),
                    input_data=dict(context.get("data", {})),
                )

                try:
                    handler = self._action_handlers.get(node.type)
                    if handler:
                        result = await handler(node, context)
                        node_exec.output_data = result
                        context["data"].update(result)
                    elif node.type == NodeType.END:
                        execution.output = dict(context.get("data", {}))
                    else:
                        node_exec.output_data = {"passthrough": True}

                    node_exec.status = ExecutionStatus.COMPLETED
                    node_exec.logs.append(f"Node {node.name} completed successfully")

                    # Determine next nodes based on condition results
                    branch_result = context["data"].get("branch")
                    for next_id in adj.get(node_id, []):
                        edge_key = f"{node_id}->{next_id}"
                        condition = edge_conditions.get(edge_key)
                        if condition and branch_result and condition != branch_result:
                            continue
                        queue.append(next_id)

                except Exception as e:
                    node_exec.status = ExecutionStatus.FAILED
                    node_exec.error = str(e)
                    node_exec.logs.append(f"Error: {e}")

                node_exec.completed_at = datetime.now(timezone.utc).isoformat()
                node_exec.duration_ms = (time.time() - node_start) * 1000
                execution.node_executions.append(node_exec)

            execution.status = ExecutionStatus.COMPLETED
            execution.output = dict(context.get("data", {}))

        except Exception as e:
            execution.status = ExecutionStatus.FAILED
            execution.error = str(e)
            wf.error_count += 1

        execution.completed_at = datetime.now(timezone.utc).isoformat()
        execution.duration_ms = (time.time() - start_time) * 1000

        # Update workflow stats
        wf.last_run = execution.completed_at
        wf.run_count += 1
        wf.avg_duration_ms = (
            (wf.avg_duration_ms * (wf.run_count - 1) + execution.duration_ms) / wf.run_count
        )

        self._executions.append(execution)
        if len(self._executions) > 10000:
            self._executions = self._executions[-10000:]

        return execution

    def get_executions(
        self,
        workflow_id: Optional[str] = None,
        status: Optional[ExecutionStatus] = None,
        limit: int = 50,
    ) -> List[WorkflowExecution]:
        execs = self._executions
        if workflow_id:
            execs = [e for e in execs if e.workflow_id == workflow_id]
        if status:
            execs = [e for e in execs if e.status == status]
        return list(reversed(execs[-limit:]))

    def get_execution(self, execution_id: str) -> Optional[WorkflowExecution]:
        for e in self._executions:
            if e.id == execution_id:
                return e
        return None

    # ── Templates ─────────────────────────────────────────
    def get_templates(self, category: Optional[str] = None) -> List[WorkflowTemplate]:
        templates = self._templates
        if category:
            templates = [t for t in templates if t.category == category]
        return templates

    def create_from_template(self, template_id: str) -> Optional[Workflow]:
        template = next((t for t in self._templates if t.id == template_id), None)
        if not template:
            return None
        wf_data = template.workflow.model_dump()
        wf_data["id"] = f"wf-{secrets.token_hex(8)}"
        wf_data["created_at"] = datetime.now(timezone.utc).isoformat()
        wf_data["updated_at"] = wf_data["created_at"]
        wf = Workflow(**wf_data)
        self._workflows[wf.id] = wf
        return wf

    # ── Webhooks ──────────────────────────────────────────
    def create_webhook(self, workflow_id: str) -> WebhookConfig:
        webhook = WebhookConfig(workflow_id=workflow_id)
        webhook.url = f"/api/webhooks/{webhook.id}"
        self._webhooks[webhook.id] = webhook
        return webhook

    def get_webhooks(self, workflow_id: Optional[str] = None) -> List[WebhookConfig]:
        webhooks = list(self._webhooks.values())
        if workflow_id:
            webhooks = [w for w in webhooks if w.workflow_id == workflow_id]
        return webhooks

    async def trigger_webhook(self, webhook_id: str, data: Dict[str, Any]) -> Optional[WorkflowExecution]:
        webhook = self._webhooks.get(webhook_id)
        if not webhook or not webhook.active:
            return None
        webhook.last_triggered = datetime.now(timezone.utc).isoformat()
        webhook.trigger_count += 1
        return await self.execute_workflow(webhook.workflow_id, data, "webhook")

    # ── Stats ─────────────────────────────────────────────
    def get_stats(self) -> Dict[str, Any]:
        total_wfs = len(self._workflows)
        active_wfs = sum(1 for w in self._workflows.values() if w.status == WorkflowStatus.ACTIVE)
        total_execs = len(self._executions)
        successful = sum(1 for e in self._executions if e.status == ExecutionStatus.COMPLETED)
        failed = sum(1 for e in self._executions if e.status == ExecutionStatus.FAILED)
        avg_duration = (
            sum(e.duration_ms for e in self._executions) / total_execs if total_execs else 0
        )

        return {
            "total_workflows": total_wfs,
            "active_workflows": active_wfs,
            "total_executions": total_execs,
            "successful_executions": successful,
            "failed_executions": failed,
            "success_rate": round((successful / max(total_execs, 1)) * 100, 1),
            "avg_duration_ms": round(avg_duration, 2),
            "total_webhooks": len(self._webhooks),
            "total_templates": len(self._templates),
        }


# ── Singleton ────────────────────────────────────────────────────────
_workflow_engine: Optional[WorkflowEngine] = None


def get_workflow_engine() -> WorkflowEngine:
    global _workflow_engine
    if _workflow_engine is None:
        _workflow_engine = WorkflowEngine()
    return _workflow_engine
