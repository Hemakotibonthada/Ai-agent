"""
Nexus AI OS - Workflow Engine
Multi-step workflow definition, sequential/parallel execution, conditional branching,
templates, retry logic, status tracking, Mermaid diagram generation, and context passing.
"""

import asyncio
import copy
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger("nexus.scheduler.workflows")

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class StepType(str, Enum):
    ACTION = "action"
    CONDITION = "condition"
    PARALLEL = "parallel"
    SUB_WORKFLOW = "sub_workflow"
    WAIT = "wait"
    NOTIFY = "notify"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    RETRYING = "retrying"


class WorkflowStatus(str, Enum):
    DRAFT = "draft"
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


# ---------------------------------------------------------------------------
# Step definition
# ---------------------------------------------------------------------------


class WorkflowStep:
    """A single step in a workflow."""

    def __init__(
        self,
        step_id: str,
        name: str,
        step_type: StepType = StepType.ACTION,
        action_name: str = "",
        action_kwargs: Optional[Dict[str, Any]] = None,
        # condition branching
        condition_field: str = "",
        condition_op: str = "==",
        condition_value: Any = None,
        on_true_step: str = "",
        on_false_step: str = "",
        # parallel sub-steps
        parallel_steps: Optional[List[str]] = None,
        # retry
        max_retries: int = 2,
        retry_delay: float = 1.0,
        # flow control
        next_step: str = "",
        timeout_seconds: int = 300,
        # context
        output_key: str = "",
    ) -> None:
        self.step_id = step_id
        self.name = name
        self.step_type = step_type
        self.action_name = action_name
        self.action_kwargs = action_kwargs or {}
        self.condition_field = condition_field
        self.condition_op = condition_op
        self.condition_value = condition_value
        self.on_true_step = on_true_step
        self.on_false_step = on_false_step
        self.parallel_steps = parallel_steps or []
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.next_step = next_step
        self.timeout_seconds = timeout_seconds
        self.output_key = output_key

        self.status: StepStatus = StepStatus.PENDING
        self.result: Any = None
        self.error: Optional[str] = None
        self.started_at: Optional[str] = None
        self.finished_at: Optional[str] = None
        self.duration_ms: float = 0.0
        self.retry_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_id": self.step_id,
            "name": self.name,
            "step_type": self.step_type.value,
            "action_name": self.action_name,
            "status": self.status.value,
            "result": self.result if not callable(self.result) else str(self.result),
            "error": self.error,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_ms": self.duration_ms,
            "retry_count": self.retry_count,
            "next_step": self.next_step,
            "output_key": self.output_key,
        }

    def reset(self) -> None:
        self.status = StepStatus.PENDING
        self.result = None
        self.error = None
        self.started_at = None
        self.finished_at = None
        self.duration_ms = 0.0
        self.retry_count = 0


# ---------------------------------------------------------------------------
# Workflow definition
# ---------------------------------------------------------------------------


class WorkflowDef:
    """Defines a complete workflow with steps and execution context."""

    def __init__(
        self,
        workflow_id: str,
        name: str,
        description: str = "",
        steps: Optional[List[WorkflowStep]] = None,
        variables: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
    ) -> None:
        self.workflow_id = workflow_id
        self.name = name
        self.description = description
        self.steps: Dict[str, WorkflowStep] = {}
        self.step_order: List[str] = []
        if steps:
            for s in steps:
                self.add_step(s)
        self.variables: Dict[str, Any] = variables or {}
        self.tags = tags or []
        self.status: WorkflowStatus = WorkflowStatus.DRAFT
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.started_at: Optional[str] = None
        self.finished_at: Optional[str] = None
        self.duration_ms: float = 0.0
        self.error: Optional[str] = None
        self.context: Dict[str, Any] = {}  # runtime context / step outputs

    def add_step(self, step: WorkflowStep) -> None:
        self.steps[step.step_id] = step
        if step.step_id not in self.step_order:
            self.step_order.append(step.step_id)

    def get_step(self, step_id: str) -> Optional[WorkflowStep]:
        return self.steps.get(step_id)

    def remove_step(self, step_id: str) -> bool:
        if step_id in self.steps:
            del self.steps[step_id]
            self.step_order = [s for s in self.step_order if s != step_id]
            return True
        return False

    def reset(self) -> None:
        self.status = WorkflowStatus.READY
        self.started_at = None
        self.finished_at = None
        self.duration_ms = 0.0
        self.error = None
        self.context.clear()
        for step in self.steps.values():
            step.reset()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "workflow_id": self.workflow_id,
            "name": self.name,
            "description": self.description,
            "status": self.status.value,
            "steps": [self.steps[sid].to_dict() for sid in self.step_order if sid in self.steps],
            "variables": self.variables,
            "tags": self.tags,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_ms": self.duration_ms,
            "error": self.error,
        }


# ---------------------------------------------------------------------------
# Mermaid diagram generation
# ---------------------------------------------------------------------------


def generate_mermaid_diagram(workflow: WorkflowDef) -> str:
    """Generate a Mermaid flowchart from a workflow definition."""
    lines: List[str] = ["graph TD"]

    status_styles = {
        StepStatus.COMPLETED: ":::completed",
        StepStatus.FAILED: ":::failed",
        StepStatus.RUNNING: ":::running",
        StepStatus.SKIPPED: ":::skipped",
    }

    for step_id in workflow.step_order:
        step = workflow.steps.get(step_id)
        if not step:
            continue

        style = status_styles.get(step.status, "")
        label = step.name.replace('"', "'")

        if step.step_type == StepType.CONDITION:
            lines.append(f'    {step_id}{{"{label}"}}{style}')
            if step.on_true_step:
                lines.append(f"    {step_id} -->|Yes| {step.on_true_step}")
            if step.on_false_step:
                lines.append(f"    {step_id} -->|No| {step.on_false_step}")
        elif step.step_type == StepType.PARALLEL:
            lines.append(f'    {step_id}[/"{label}"\\]{style}')
            for ps in step.parallel_steps:
                lines.append(f"    {step_id} --> {ps}")
        else:
            lines.append(f'    {step_id}["{label}"]{style}')
            if step.next_step:
                lines.append(f"    {step_id} --> {step.next_step}")

    # Auto-link sequential steps that don't have explicit next_step
    for i in range(len(workflow.step_order) - 1):
        current_id = workflow.step_order[i]
        next_id = workflow.step_order[i + 1]
        current = workflow.steps.get(current_id)
        if current and not current.next_step and current.step_type == StepType.ACTION:
            lines.append(f"    {current_id} --> {next_id}")

    # Style definitions
    lines.extend([
        "",
        "    classDef completed fill:#28a745,stroke:#1e7e34,color:white",
        "    classDef failed fill:#dc3545,stroke:#bd2130,color:white",
        "    classDef running fill:#ffc107,stroke:#e0a800,color:black",
        "    classDef skipped fill:#6c757d,stroke:#545b62,color:white",
    ])

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Workflow templates
# ---------------------------------------------------------------------------


def _create_template_steps(template_name: str) -> List[WorkflowStep]:
    """Create steps for a built-in workflow template."""
    templates: Dict[str, List[WorkflowStep]] = {
        "morning_routine": [
            WorkflowStep("check_systems", "Check System Health", action_name="check_health", next_step="run_maintenance"),
            WorkflowStep("run_maintenance", "Run Maintenance", action_name="system_maintenance", next_step="consolidate_memory"),
            WorkflowStep("consolidate_memory", "Consolidate Memory", action_name="memory_consolidation", next_step="compile_briefing"),
            WorkflowStep("compile_briefing", "Compile Morning Briefing", action_name="morning_briefing", next_step="send_notification"),
            WorkflowStep("send_notification", "Send Notification", step_type=StepType.NOTIFY, action_name="notify_user"),
        ],
        "weekly_review": [
            WorkflowStep("gather_stats", "Gather Weekly Stats", action_name="gather_weekly_stats", next_step="analyze_performance"),
            WorkflowStep("analyze_performance", "Analyze Performance", action_name="analyze_performance", next_step="generate_report"),
            WorkflowStep("generate_report", "Generate Report", action_name="generate_weekly_report", next_step="check_training"),
            WorkflowStep("check_training", "Check Training Need", step_type=StepType.CONDITION,
                         action_name="check_training_data", condition_field="needs_training",
                         condition_op="==", condition_value=True,
                         on_true_step="trigger_training", on_false_step="finalize"),
            WorkflowStep("trigger_training", "Trigger Training", action_name="trigger_model_training", next_step="finalize"),
            WorkflowStep("finalize", "Finalize Review", action_name="finalize_weekly_review"),
        ],
        "incident_response": [
            WorkflowStep("detect", "Detect Incident", action_name="detect_incident", next_step="assess_severity"),
            WorkflowStep("assess_severity", "Assess Severity", step_type=StepType.CONDITION,
                         action_name="assess_severity", condition_field="severity",
                         condition_op=">=", condition_value=3,
                         on_true_step="escalate", on_false_step="auto_resolve"),
            WorkflowStep("escalate", "Escalate to User", step_type=StepType.NOTIFY,
                         action_name="escalate_incident", next_step="await_response"),
            WorkflowStep("auto_resolve", "Auto-Resolve", action_name="auto_resolve_incident", next_step="log_incident"),
            WorkflowStep("await_response", "Await Response", step_type=StepType.WAIT,
                         action_name="wait_for_response", timeout_seconds=600, next_step="log_incident"),
            WorkflowStep("log_incident", "Log Incident", action_name="log_incident"),
        ],
        "deployment": [
            WorkflowStep("pre_check", "Pre-deployment Check", action_name="pre_deploy_check", next_step="backup"),
            WorkflowStep("backup", "Create Backup", action_name="create_backup", next_step="deploy_steps"),
            WorkflowStep("deploy_steps", "Deploy (Parallel)", step_type=StepType.PARALLEL,
                         action_name="parallel_deploy", parallel_steps=["deploy_models", "deploy_config"]),
            WorkflowStep("deploy_models", "Deploy Models", action_name="deploy_models"),
            WorkflowStep("deploy_config", "Deploy Config", action_name="deploy_config"),
            WorkflowStep("verify", "Verify Deployment", action_name="verify_deployment",
                         next_step="health_check"),
            WorkflowStep("health_check", "Health Check", step_type=StepType.CONDITION,
                         action_name="health_check", condition_field="healthy",
                         condition_op="==", condition_value=True,
                         on_true_step="complete", on_false_step="rollback"),
            WorkflowStep("rollback", "Rollback", action_name="rollback_deployment", next_step="notify_failure"),
            WorkflowStep("notify_failure", "Notify Failure", step_type=StepType.NOTIFY, action_name="notify_deploy_failure"),
            WorkflowStep("complete", "Complete", step_type=StepType.NOTIFY, action_name="notify_deploy_success"),
        ],
    }
    return templates.get(template_name, [])


WORKFLOW_TEMPLATES = ["morning_routine", "weekly_review", "incident_response", "deployment"]


# ---------------------------------------------------------------------------
# Workflow Engine
# ---------------------------------------------------------------------------


class WorkflowEngine:
    """Executes and manages multi-step workflows."""

    def __init__(self, persist_dir: Optional[str] = None) -> None:
        self.workflows: Dict[str, WorkflowDef] = {}
        self._action_registry: Dict[str, Callable] = {}
        self._persist_dir = persist_dir
        if persist_dir:
            os.makedirs(persist_dir, exist_ok=True)
            self._load_workflows()

    # -- persistence ---------------------------------------------------------

    def _workflow_path(self, workflow_id: str) -> str:
        return os.path.join(self._persist_dir or ".", f"{workflow_id}.json")

    def _load_workflows(self) -> None:
        if not self._persist_dir or not os.path.isdir(self._persist_dir):
            return
        for entry in os.scandir(self._persist_dir):
            if entry.is_file() and entry.name.endswith(".json"):
                try:
                    with open(entry.path) as f:
                        data = json.load(f)
                    wf = self._workflow_from_dict(data)
                    self.workflows[wf.workflow_id] = wf
                except Exception as exc:
                    logger.error("Failed to load workflow %s: %s", entry.name, exc)
        logger.info("Loaded %d workflows", len(self.workflows))

    def _save_workflow(self, wf: WorkflowDef) -> None:
        if not self._persist_dir:
            return
        path = self._workflow_path(wf.workflow_id)
        with open(path, "w") as f:
            json.dump(wf.to_dict(), f, indent=2)

    @staticmethod
    def _workflow_from_dict(data: Dict[str, Any]) -> WorkflowDef:
        steps: List[WorkflowStep] = []
        for sd in data.get("steps", []):
            s = WorkflowStep(
                step_id=sd["step_id"],
                name=sd["name"],
                step_type=StepType(sd.get("step_type", "action")),
                action_name=sd.get("action_name", ""),
                next_step=sd.get("next_step", ""),
                output_key=sd.get("output_key", ""),
            )
            s.status = StepStatus(sd.get("status", "pending"))
            s.result = sd.get("result")
            s.error = sd.get("error")
            s.started_at = sd.get("started_at")
            s.finished_at = sd.get("finished_at")
            s.duration_ms = sd.get("duration_ms", 0.0)
            steps.append(s)
        wf = WorkflowDef(
            workflow_id=data["workflow_id"],
            name=data["name"],
            description=data.get("description", ""),
            steps=steps,
            variables=data.get("variables", {}),
            tags=data.get("tags", []),
        )
        wf.status = WorkflowStatus(data.get("status", "draft"))
        wf.created_at = data.get("created_at", "")
        wf.started_at = data.get("started_at")
        wf.finished_at = data.get("finished_at")
        wf.duration_ms = data.get("duration_ms", 0.0)
        return wf

    # -- action registry -----------------------------------------------------

    def register_action(self, name: str, func: Callable) -> None:
        self._action_registry[name] = func

    def register_actions(self, actions: Dict[str, Callable]) -> None:
        self._action_registry.update(actions)

    # -- CRUD ----------------------------------------------------------------

    def create_workflow(
        self,
        name: str,
        description: str = "",
        steps: Optional[List[WorkflowStep]] = None,
        variables: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
    ) -> WorkflowDef:
        wf_id = f"wf_{uuid.uuid4().hex[:10]}"
        wf = WorkflowDef(
            workflow_id=wf_id,
            name=name,
            description=description,
            steps=steps,
            variables=variables,
            tags=tags,
        )
        wf.status = WorkflowStatus.READY
        self.workflows[wf_id] = wf
        self._save_workflow(wf)
        logger.info("Created workflow %s (%s)", name, wf_id)
        return wf

    def create_from_template(self, template_name: str, variables: Optional[Dict[str, Any]] = None) -> Optional[WorkflowDef]:
        if template_name not in WORKFLOW_TEMPLATES:
            logger.warning("Unknown workflow template: %s", template_name)
            return None
        steps = _create_template_steps(template_name)
        return self.create_workflow(
            name=template_name.replace("_", " ").title(),
            description=f"Created from template: {template_name}",
            steps=steps,
            variables=variables,
            tags=["template", template_name],
        )

    def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        wf = self.workflows.get(workflow_id)
        return wf.to_dict() if wf else None

    def delete_workflow(self, workflow_id: str) -> bool:
        if workflow_id not in self.workflows:
            return False
        del self.workflows[workflow_id]
        if self._persist_dir:
            path = self._workflow_path(workflow_id)
            if os.path.exists(path):
                os.unlink(path)
        return True

    def list_workflows(self, tag: Optional[str] = None, status: Optional[WorkflowStatus] = None) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for wf in self.workflows.values():
            if tag and tag not in wf.tags:
                continue
            if status and wf.status != status:
                continue
            results.append(wf.to_dict())
        return results

    # -- execution -----------------------------------------------------------

    async def run_workflow(
        self,
        workflow_id: str,
        input_variables: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        wf = self.workflows.get(workflow_id)
        if not wf:
            return {"error": "Workflow not found"}
        if wf.status == WorkflowStatus.RUNNING:
            return {"error": "Workflow already running"}

        wf.reset()
        wf.status = WorkflowStatus.RUNNING
        wf.started_at = datetime.now(timezone.utc).isoformat()
        if input_variables:
            wf.variables.update(input_variables)
        wf.context = dict(wf.variables)

        start = time.monotonic()
        try:
            if wf.step_order:
                await self._execute_step(wf, wf.step_order[0])
            wf.status = WorkflowStatus.COMPLETED
        except Exception as exc:
            wf.status = WorkflowStatus.FAILED
            wf.error = str(exc)
            logger.error("Workflow %s failed: %s", wf.name, exc)

        wf.finished_at = datetime.now(timezone.utc).isoformat()
        wf.duration_ms = round((time.monotonic() - start) * 1000, 2)
        self._save_workflow(wf)
        return wf.to_dict()

    async def _execute_step(self, wf: WorkflowDef, step_id: str) -> None:
        step = wf.steps.get(step_id)
        if not step:
            return

        step.status = StepStatus.RUNNING
        step.started_at = datetime.now(timezone.utc).isoformat()
        start = time.monotonic()

        try:
            if step.step_type == StepType.CONDITION:
                await self._execute_condition_step(wf, step)
            elif step.step_type == StepType.PARALLEL:
                await self._execute_parallel_step(wf, step)
            elif step.step_type == StepType.WAIT:
                await self._execute_wait_step(wf, step)
            else:
                await self._execute_action_step(wf, step)

            step.duration_ms = round((time.monotonic() - start) * 1000, 2)
            step.finished_at = datetime.now(timezone.utc).isoformat()
            step.status = StepStatus.COMPLETED

            # Store output in context
            if step.output_key and step.result is not None:
                wf.context[step.output_key] = step.result

            # Follow next step
            next_id = step.next_step
            if next_id and next_id in wf.steps:
                await self._execute_step(wf, next_id)

        except Exception as exc:
            step.duration_ms = round((time.monotonic() - start) * 1000, 2)
            step.finished_at = datetime.now(timezone.utc).isoformat()

            if step.retry_count < step.max_retries:
                step.retry_count += 1
                step.status = StepStatus.RETRYING
                logger.warning("Step %s retry %d/%d: %s", step.name, step.retry_count, step.max_retries, exc)
                await asyncio.sleep(step.retry_delay * step.retry_count)
                await self._execute_step(wf, step_id)
            else:
                step.status = StepStatus.FAILED
                step.error = str(exc)
                raise

    async def _execute_action_step(self, wf: WorkflowDef, step: WorkflowStep) -> None:
        action = self._action_registry.get(step.action_name)
        if not action:
            logger.warning("Action '%s' not registered, skipping step %s", step.action_name, step.name)
            step.status = StepStatus.SKIPPED
            step.result = {"skipped": True, "reason": f"Action '{step.action_name}' not registered"}
            return

        # Merge step kwargs with workflow context
        kwargs = {**step.action_kwargs}
        for key, val in kwargs.items():
            if isinstance(val, str) and val.startswith("$"):
                ctx_key = val[1:]
                if ctx_key in wf.context:
                    kwargs[key] = wf.context[ctx_key]

        try:
            if asyncio.iscoroutinefunction(action):
                result = await asyncio.wait_for(action(**kwargs), timeout=step.timeout_seconds)
            else:
                result = action(**kwargs)
            step.result = result
        except asyncio.TimeoutError:
            raise TimeoutError(f"Step '{step.name}' timed out after {step.timeout_seconds}s")

    async def _execute_condition_step(self, wf: WorkflowDef, step: WorkflowStep) -> None:
        # First execute the action to get result
        action = self._action_registry.get(step.action_name)
        result: Dict[str, Any] = {}
        if action:
            if asyncio.iscoroutinefunction(action):
                result = await action(**step.action_kwargs) or {}
            else:
                result = action(**step.action_kwargs) or {}
            step.result = result
            wf.context.update(result if isinstance(result, dict) else {})

        # Evaluate condition
        field_value = wf.context.get(step.condition_field, result.get(step.condition_field) if isinstance(result, dict) else None)
        condition_met = self._eval_condition(field_value, step.condition_op, step.condition_value)

        step.finished_at = datetime.now(timezone.utc).isoformat()
        step.status = StepStatus.COMPLETED

        # Branch
        next_step = step.on_true_step if condition_met else step.on_false_step
        if next_step and next_step in wf.steps:
            await self._execute_step(wf, next_step)

    @staticmethod
    def _eval_condition(actual: Any, op: str, expected: Any) -> bool:
        try:
            if op == "==":
                return actual == expected
            if op == "!=":
                return actual != expected
            if op == ">":
                return float(actual) > float(expected)
            if op == "<":
                return float(actual) < float(expected)
            if op == ">=":
                return float(actual) >= float(expected)
            if op == "<=":
                return float(actual) <= float(expected)
            if op == "in":
                return actual in expected
            if op == "contains":
                return expected in actual
            return False
        except (TypeError, ValueError):
            return False

    async def _execute_parallel_step(self, wf: WorkflowDef, step: WorkflowStep) -> None:
        tasks: List[asyncio.Task] = []
        for sub_id in step.parallel_steps:
            if sub_id in wf.steps:
                task = asyncio.create_task(self._execute_step(wf, sub_id))
                tasks.append(task)
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            errors = [str(r) for r in results if isinstance(r, Exception)]
            if errors:
                step.error = "; ".join(errors)
                # Don't raise — partial failures in parallel are logged but workflow continues
                logger.warning("Parallel step %s had errors: %s", step.name, step.error)
        step.result = {"parallel_count": len(step.parallel_steps), "completed": len(tasks)}

    async def _execute_wait_step(self, wf: WorkflowDef, step: WorkflowStep) -> None:
        action = self._action_registry.get(step.action_name)
        if action:
            try:
                if asyncio.iscoroutinefunction(action):
                    result = await asyncio.wait_for(action(**step.action_kwargs), timeout=step.timeout_seconds)
                else:
                    result = action(**step.action_kwargs)
                step.result = result
            except asyncio.TimeoutError:
                step.result = {"timed_out": True}
                logger.warning("Wait step %s timed out", step.name)
        else:
            await asyncio.sleep(min(step.timeout_seconds, 1))
            step.result = {"waited": True}

    # -- workflow control ----------------------------------------------------

    def cancel_workflow(self, workflow_id: str) -> bool:
        wf = self.workflows.get(workflow_id)
        if not wf:
            return False
        wf.status = WorkflowStatus.CANCELLED
        wf.finished_at = datetime.now(timezone.utc).isoformat()
        self._save_workflow(wf)
        return True

    def pause_workflow(self, workflow_id: str) -> bool:
        wf = self.workflows.get(workflow_id)
        if not wf or wf.status != WorkflowStatus.RUNNING:
            return False
        wf.status = WorkflowStatus.PAUSED
        self._save_workflow(wf)
        return True

    # -- visualization -------------------------------------------------------

    def get_mermaid_diagram(self, workflow_id: str) -> Optional[str]:
        wf = self.workflows.get(workflow_id)
        if not wf:
            return None
        return generate_mermaid_diagram(wf)

    # -- templates -----------------------------------------------------------

    def list_templates(self) -> List[str]:
        return list(WORKFLOW_TEMPLATES)

    # -- stats ---------------------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        by_status: Dict[str, int] = {}
        for wf in self.workflows.values():
            by_status[wf.status.value] = by_status.get(wf.status.value, 0) + 1
        total_steps = sum(len(wf.steps) for wf in self.workflows.values())
        return {
            "total_workflows": len(self.workflows),
            "by_status": by_status,
            "total_steps": total_steps,
            "registered_actions": list(self._action_registry.keys()),
            "available_templates": WORKFLOW_TEMPLATES,
        }
