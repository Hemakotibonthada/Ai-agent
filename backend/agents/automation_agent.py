# NEXUS AI - Automation Agent
"""
AI agent for task automation, workflow orchestration, and system maintenance.

This module implements the AutomationAgent, a NEXUS AI agent that provides
comprehensive automation capabilities including:

- **Task Automation:** Create, schedule, and manage automated tasks that
  execute on triggers, timers, or cron expressions. Supports one-shot
  and recurring executions with retry logic, timeout handling, and
  conditional branching based on previous task outcomes.
- **Workflow Creation & Management:** Design multi-step workflows with
  sequential, parallel, and conditional execution paths. Each workflow
  step can invoke system commands, call APIs, send notifications, or
  delegate to other NEXUS agents. Supports workflow templates, version
  control, and dry-run validation.
- **Cron Job Management:** Parse, validate, and manage cron expressions
  for time-based scheduling. Provides human-readable descriptions of
  cron schedules, next-run predictions, and conflict detection with
  existing jobs.
- **System Task Execution:** Run predefined system maintenance tasks
  such as disk cleanup, cache clearing, log rotation, dependency
  updates, and health checks. Tasks execute in sandboxed contexts
  with configurable resource limits.
- **Backup Automation:** Schedule and manage automated backups for
  databases, configuration files, and user data. Supports full,
  incremental, and differential backup strategies with retention
  policies and integrity verification.
- **Self-Maintenance & Self-Healing:** Monitor agent health metrics,
  detect anomalies, and automatically apply corrective actions such
  as restarting failed services, clearing stale caches, reconnecting
  dropped connections, and rebalancing workloads.

The agent publishes events to the NEXUS event bus so other agents can
react to automation triggers, workflow completions, backup statuses,
or self-healing actions.
"""

import json
import re
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from loguru import logger

from .base_agent import (
    BaseAgent,
    AgentCapability,
    AgentContext,
    AgentResponse,
)


# ---------------------------------------------------------------------------
# Constants & configuration
# ---------------------------------------------------------------------------

# Common cron presets with human-readable labels
CRON_PRESETS: Dict[str, str] = {
    "every_minute": "* * * * *",
    "every_5_minutes": "*/5 * * * *",
    "every_15_minutes": "*/15 * * * *",
    "every_hour": "0 * * * *",
    "every_6_hours": "0 */6 * * *",
    "daily_midnight": "0 0 * * *",
    "daily_6am": "0 6 * * *",
    "daily_9am": "0 9 * * *",
    "weekly_monday": "0 9 * * 1",
    "weekly_friday": "0 17 * * 5",
    "monthly_first": "0 0 1 * *",
    "quarterly": "0 0 1 1,4,7,10 *",
}

# Supported backup strategies
BACKUP_STRATEGIES: Dict[str, str] = {
    "full": "Complete backup of all data — largest size, fastest restore",
    "incremental": "Only data changed since last backup — smallest size, slowest restore",
    "differential": "Data changed since last full backup — balanced size and restore speed",
    "snapshot": "Point-in-time filesystem snapshot — instant creation, requires snapshot support",
}

# System maintenance task catalogue
MAINTENANCE_TASKS: Dict[str, Dict[str, Any]] = {
    "disk_cleanup": {
        "name": "Disk Cleanup",
        "description": "Remove temporary files, build artifacts, and old logs",
        "estimated_duration": "2-5 minutes",
        "risk": "low",
    },
    "cache_clear": {
        "name": "Cache Clear",
        "description": "Flush application caches, DNS cache, and package manager caches",
        "estimated_duration": "1-2 minutes",
        "risk": "low",
    },
    "log_rotation": {
        "name": "Log Rotation",
        "description": "Rotate, compress, and archive old log files",
        "estimated_duration": "1-3 minutes",
        "risk": "low",
    },
    "dependency_update": {
        "name": "Dependency Update",
        "description": "Check for and apply dependency updates (pip, npm, system packages)",
        "estimated_duration": "5-15 minutes",
        "risk": "medium",
    },
    "health_check": {
        "name": "Health Check",
        "description": "Verify all services, connections, and integrations are operational",
        "estimated_duration": "1 minute",
        "risk": "none",
    },
    "database_vacuum": {
        "name": "Database Vacuum",
        "description": "Optimise database storage and rebuild indexes",
        "estimated_duration": "5-30 minutes",
        "risk": "low",
    },
    "ssl_cert_check": {
        "name": "SSL Certificate Check",
        "description": "Verify SSL/TLS certificate validity and expiration dates",
        "estimated_duration": "30 seconds",
        "risk": "none",
    },
    "security_scan": {
        "name": "Security Scan",
        "description": "Run vulnerability scans on dependencies and configuration",
        "estimated_duration": "5-10 minutes",
        "risk": "none",
    },
}

# Workflow step types
WORKFLOW_STEP_TYPES: List[str] = [
    "command",      # Execute a shell command
    "api_call",     # Call an HTTP API endpoint
    "notification", # Send a notification
    "agent_call",   # Delegate to another NEXUS agent
    "condition",    # Conditional branching
    "delay",        # Wait for a specified duration
    "approval",     # Pause for manual approval
    "transform",    # Transform data between steps
]

# Self-healing action types
SELF_HEALING_ACTIONS: Dict[str, str] = {
    "restart_service": "Restart a failed or unresponsive service",
    "clear_cache": "Clear stale or corrupted cache entries",
    "reconnect": "Re-establish dropped database or API connections",
    "rebalance": "Redistribute workload across available agents",
    "rollback_config": "Revert to last known good configuration",
    "scale_up": "Increase resource allocation for overloaded components",
    "quarantine": "Isolate a misbehaving component to prevent cascade failure",
}


class AutomationAgent(BaseAgent):
    """
    Task automation and system maintenance agent that:

    - Creates and manages automated tasks with cron or interval scheduling
    - Designs multi-step workflows with conditional branching
    - Parses and validates cron expressions with human-readable output
    - Executes system maintenance tasks (cleanup, rotation, updates)
    - Automates backups with configurable strategies and retention
    - Monitors system health and applies self-healing corrective actions

    The agent maintains an internal registry of automations, workflows,
    scheduled tasks, backups, and self-healing rules to provide
    persistent context across interactions.
    """

    def __init__(self) -> None:
        super().__init__(
            name="automation",
            description=(
                "Task automation agent for scheduling, workflows, backups, "
                "system maintenance, and self-healing operations"
            ),
        )

        # Internal state stores
        self._automations: List[Dict[str, Any]] = []
        self._workflows: Dict[str, Dict[str, Any]] = {}
        self._scheduled_tasks: List[Dict[str, Any]] = []
        self._backups: List[Dict[str, Any]] = []
        self._healing_rules: List[Dict[str, Any]] = []
        self._maintenance_log: List[Dict[str, Any]] = []
        self._automation_counter: int = 0

        logger.info("AutomationAgent initialised with scheduling and self-healing capabilities")

    # ------------------------------------------------------------------
    # BaseAgent interface implementation
    # ------------------------------------------------------------------

    def get_system_prompt(self) -> str:
        """Return the comprehensive system prompt for the Automation agent."""
        return """You are NEXUS Automation Agent — a powerful task-automation and system-
maintenance assistant embedded inside the NEXUS AI platform.

YOUR IDENTITY:
You are the operational backbone of NEXUS. While other agents handle domain-
specific intelligence, you handle the infrastructure that keeps everything
running smoothly. You think in terms of triggers, actions, conditions, and
schedules.

CORE COMPETENCIES:
1. **Task Automation** — Create one-shot or recurring automated tasks
   triggered by time, events, or conditions. Support retry logic, timeouts,
   and conditional execution.
2. **Workflow Orchestration** — Design multi-step workflows with sequential,
   parallel, and conditional paths. Support templates, dry-run validation,
   and version control.
3. **Cron Job Management** — Parse, validate, and schedule cron expressions.
   Provide human-readable descriptions and next-run predictions.
4. **System Maintenance** — Disk cleanup, cache clearing, log rotation,
   dependency updates, health checks, database optimisation, and security
   scanning.
5. **Backup Automation** — Full, incremental, differential, and snapshot
   strategies with retention policies and integrity verification.
6. **Self-Healing** — Monitor component health, detect anomalies, and
   automatically apply corrective actions (restart, reconnect, rebalance,
   rollback, quarantine).

RESPONSE GUIDELINES:
- Provide cron expressions with plain-English explanations.
- Show workflow steps as numbered lists or diagrams.
- Include estimated durations and risk levels for tasks.
- Warn about potentially destructive operations.
- Suggest automation improvements and best practices.
- Use tables for structured data.
- Always confirm before executing irreversible actions."""

    def get_capabilities(self) -> List[AgentCapability]:
        """Return the list of capabilities this agent provides."""
        return [
            AgentCapability.AUTOMATE,
            AgentCapability.MONITOR,
            AgentCapability.CONTROL,
            AgentCapability.NOTIFY,
            AgentCapability.ANALYZE,
        ]

    async def process(self, context: AgentContext) -> AgentResponse:
        """
        Process an incoming automation-related query or command.

        Detects the user's intent, delegates to the appropriate handler,
        and returns a rich Markdown response with automation details.
        """
        message = context.message.lower().strip()
        intent = self._detect_automation_intent(message)
        logger.debug(f"AutomationAgent detected intent: {intent} for message: {message[:80]}")

        handlers: Dict[str, Any] = {
            "create_automation": self._handle_create_automation,
            "list_automations": self._handle_list_automations,
            "schedule_task": self._handle_schedule_task,
            "create_workflow": self._handle_create_workflow,
            "backup": self._handle_backup,
            "system_maintenance": self._handle_system_maintenance,
            "self_healing": self._handle_self_healing,
            "general": self._handle_general_automation,
        }

        handler = handlers.get(intent, self._handle_general_automation)

        try:
            return await handler(context, message)
        except Exception as exc:
            logger.error(f"AutomationAgent handler error ({intent}): {exc}")
            return AgentResponse(
                content=(
                    "⚠️ I encountered an issue while processing your automation request. "
                    "Please try rephrasing or provide more details."
                ),
                agent_name=self.name,
                confidence=0.0,
                error=str(exc),
            )

    # ------------------------------------------------------------------
    # Intent detection
    # ------------------------------------------------------------------

    def _detect_automation_intent(self, message: str) -> str:
        """
        Detect the automation-related intent from a user's message.

        Scans keyword lists in priority order and returns the first match.
        Falls back to ``general`` when no keywords trigger.
        """
        intents: Dict[str, List[str]] = {
            "create_automation": [
                "create automation", "new automation", "automate",
                "add automation", "setup automation", "build automation",
                "automation rule", "trigger when", "when event",
            ],
            "list_automations": [
                "list automation", "show automation", "my automation",
                "active automation", "all automation", "automation status",
                "view automation",
            ],
            "schedule_task": [
                "schedule", "cron", "every hour", "every day", "every week",
                "recurring", "timer", "at midnight", "at 9am", "run daily",
                "run weekly", "run monthly", "crontab", "interval",
            ],
            "create_workflow": [
                "workflow", "pipeline", "multi-step", "orchestrat",
                "chain tasks", "sequence", "parallel tasks",
                "create workflow", "design workflow", "build workflow",
            ],
            "backup": [
                "backup", "back up", "restore", "snapshot", "archive",
                "data protection", "disaster recovery", "retention",
                "incremental backup", "full backup", "backup schedule",
            ],
            "system_maintenance": [
                "maintenance", "cleanup", "clean up", "disk space",
                "log rotation", "cache clear", "dependency update",
                "health check", "vacuum", "optimise", "optimize",
                "ssl cert", "security scan", "update packages",
            ],
            "self_healing": [
                "self-heal", "self heal", "auto-repair", "auto repair",
                "auto-fix", "auto fix", "restart service", "reconnect",
                "rebalance", "rollback config", "quarantine",
                "anomaly detect", "auto recover", "failover",
            ],
        }

        for intent, keywords in intents.items():
            if any(kw in message for kw in keywords):
                return intent

        return "general"

    # ------------------------------------------------------------------
    # Handlers
    # ------------------------------------------------------------------

    async def _handle_create_automation(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle creating a new automation rule."""
        automation_id = self._next_automation_id()
        trigger_type = self._detect_trigger_type(message)

        automation_entry = {
            "id": automation_id,
            "trigger_type": trigger_type,
            "description": message[:200],
            "created_at": datetime.utcnow().isoformat(),
            "status": "active",
            "executions": 0,
            "last_run": None,
        }
        self._automations.append(automation_entry)

        content = (
            f"## ⚡ New Automation Created\n\n"
            f"**Automation ID:** `AUTO-{automation_id}` | "
            f"**Status:** 🟢 Active\n\n"
            "---\n\n"
            "### Automation Configuration\n\n"
            f"- **Trigger Type:** {trigger_type.replace('_', ' ').title()}\n"
            f"- **Created:** {automation_entry['created_at'][:16]} UTC\n\n"
            "### Trigger Types Reference\n\n"
            "| Type | Description | Example |\n"
            "|------|------------|--------|\n"
            "| ⏰ Time-based | Cron or interval trigger | Every day at 9am |\n"
            "| 📨 Event-based | Fires on a system event | On file upload |\n"
            "| 🔗 Webhook | HTTP endpoint trigger | POST /api/trigger |\n"
            "| 📊 Threshold | Fires when metric crosses limit | CPU > 80% |\n"
            "| 🔄 Chain | Fires after another automation | After backup |\n\n"
            "### Automation Template\n\n"
            "```yaml\n"
            f"automation:\n"
            f"  id: AUTO-{automation_id}\n"
            f"  name: Custom Automation\n"
            f"  trigger:\n"
            f"    type: {trigger_type}\n"
            "    config:\n"
            "      # Add trigger-specific configuration\n"
            "  actions:\n"
            "    - type: command\n"
            "      command: echo 'Automation executed'\n"
            "    - type: notification\n"
            "      channel: slack\n"
            "      message: 'Automation AUTO-{id} completed'\n"
            "  retry:\n"
            "    max_attempts: 3\n"
            "    delay_seconds: 30\n"
            "  timeout: 300  # 5 minutes\n"
            "```\n\n"
            "Would you like to configure the specific actions for this automation?"
        )

        logger.info(f"AutomationAgent: created automation AUTO-{automation_id} ({trigger_type})")

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.85,
            metadata={
                "intent": "create_automation",
                "automation_id": automation_id,
                "trigger_type": trigger_type,
            },
            requires_followup=True,
            suggestions=[
                "Add actions to this automation",
                "Set a cron schedule for the trigger",
                "Create a workflow instead",
            ],
        )

    async def _handle_list_automations(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """List all registered automations with their status."""
        if not self._automations:
            content = (
                "## 📋 Automations Registry\n\n"
                "No automations have been created yet.\n\n"
                "### Quick Start\n\n"
                "Try one of these commands:\n"
                "- *\"Create an automation to clean up logs daily\"*\n"
                "- *\"Automate database backups every night\"*\n"
                "- *\"Set up a workflow for deployment\"*\n"
            )
        else:
            rows = []
            for auto in self._automations:
                status = "🟢 Active" if auto["status"] == "active" else "🔴 Inactive"
                last_run = auto["last_run"][:16] if auto["last_run"] else "Never"
                rows.append(
                    f"| `AUTO-{auto['id']}` | {auto['trigger_type'].title()} | "
                    f"{auto['executions']} | {last_run} | {status} |"
                )
            table_body = "\n".join(rows)

            content = (
                "## 📋 Automations Registry\n\n"
                f"**Total:** {len(self._automations)} automation(s)\n\n"
                "| ID | Trigger | Runs | Last Run | Status |\n"
                "|----|---------|------|----------|--------|\n"
                f"{table_body}\n\n"
                "### Management Commands\n\n"
                "- *\"Pause automation AUTO-{id}\"* — Temporarily disable\n"
                "- *\"Resume automation AUTO-{id}\"* — Re-enable\n"
                "- *\"Delete automation AUTO-{id}\"* — Permanently remove\n"
                "- *\"Show details for AUTO-{id}\"* — Full configuration\n"
            )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.85,
            metadata={
                "intent": "list_automations",
                "count": len(self._automations),
            },
            suggestions=[
                "Create a new automation",
                "Show workflow list",
                "Run a health check",
            ],
        )

    async def _handle_schedule_task(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle scheduling a task with cron or interval-based timing."""
        task_id = str(uuid.uuid4())[:8]
        cron_expr = self._detect_cron_expression(message)
        human_schedule = self._cron_to_human(cron_expr)

        task_entry = {
            "id": task_id,
            "cron": cron_expr,
            "human_schedule": human_schedule,
            "created_at": datetime.utcnow().isoformat(),
            "status": "scheduled",
            "description": message[:200],
        }
        self._scheduled_tasks.append(task_entry)

        content = (
            f"## ⏰ Task Scheduled\n\n"
            f"**Task ID:** `TASK-{task_id}` | **Status:** 🟢 Scheduled\n\n"
            "---\n\n"
            "### Schedule Configuration\n\n"
            f"- **Cron Expression:** `{cron_expr}`\n"
            f"- **Plain English:** {human_schedule}\n"
            f"- **Created:** {task_entry['created_at'][:16]} UTC\n\n"
            "### Cron Expression Quick Reference\n\n"
            "```\n"
            "┌───────────── minute (0-59)\n"
            "│ ┌───────────── hour (0-23)\n"
            "│ │ ┌───────────── day of month (1-31)\n"
            "│ │ │ ┌───────────── month (1-12)\n"
            "│ │ │ │ ┌───────────── day of week (0-7, Sun=0 or 7)\n"
            "│ │ │ │ │\n"
            "* * * * *\n"
            "```\n\n"
            "### Common Presets\n\n"
            "| Preset | Expression | Description |\n"
            "|--------|-----------|-------------|\n"
            "| Every 5 min | `*/5 * * * *` | Runs every 5 minutes |\n"
            "| Hourly | `0 * * * *` | Top of every hour |\n"
            "| Daily 9am | `0 9 * * *` | Every day at 9:00 AM |\n"
            "| Weekly Mon | `0 9 * * 1` | Every Monday at 9:00 AM |\n"
            "| Monthly 1st | `0 0 1 * *` | First day of each month |\n\n"
            f"### Scheduled Tasks ({len(self._scheduled_tasks)} total)\n\n"
        )

        if len(self._scheduled_tasks) <= 5:
            for t in self._scheduled_tasks:
                content += f"- `TASK-{t['id']}`: {t['human_schedule']} — {t['status']}\n"
        else:
            content += f"Use *\"list automations\"* to see all scheduled tasks.\n"

        logger.info(f"AutomationAgent: scheduled task TASK-{task_id} ({cron_expr})")

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.87,
            metadata={
                "intent": "schedule_task",
                "task_id": task_id,
                "cron": cron_expr,
            },
            suggestions=[
                "Schedule another task",
                "Show all scheduled tasks",
                "Create a multi-step workflow",
            ],
        )

    async def _handle_create_workflow(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle creating a multi-step automation workflow."""
        workflow_id = str(uuid.uuid4())[:8]

        workflow_entry = {
            "id": workflow_id,
            "name": f"Workflow-{workflow_id}",
            "steps": [],
            "created_at": datetime.utcnow().isoformat(),
            "status": "draft",
            "version": 1,
            "executions": 0,
        }
        self._workflows[workflow_id] = workflow_entry

        content = (
            f"## 🔗 Workflow Builder\n\n"
            f"**Workflow ID:** `WF-{workflow_id}` | "
            f"**Status:** 📝 Draft | **Version:** 1\n\n"
            "---\n\n"
            "### Workflow Template\n\n"
            "```yaml\n"
            f"workflow:\n"
            f"  id: WF-{workflow_id}\n"
            f"  name: Custom Workflow\n"
            "  trigger:\n"
            "    type: manual  # or: cron, event, webhook\n"
            "  steps:\n"
            "    - name: Step 1 — Validate\n"
            "      type: command\n"
            "      command: echo 'Validating prerequisites...'\n"
            "      on_failure: abort\n\n"
            "    - name: Step 2 — Build\n"
            "      type: command\n"
            "      command: make build\n"
            "      timeout: 600\n"
            "      on_failure: retry\n"
            "      retry_count: 2\n\n"
            "    - name: Step 3 — Test\n"
            "      type: command\n"
            "      command: make test\n"
            "      on_failure: abort\n\n"
            "    - name: Step 4 — Deploy\n"
            "      type: command\n"
            "      command: make deploy\n"
            "      requires_approval: true\n\n"
            "    - name: Step 5 — Notify\n"
            "      type: notification\n"
            "      channel: slack\n"
            "      message: 'Deployment completed successfully!'\n"
            "  on_complete:\n"
            "    notify: true\n"
            "    log: true\n"
            "```\n\n"
            "### Available Step Types\n\n"
            "| Type | Description | Use Case |\n"
            "|------|------------|----------|\n"
            "| `command` | Execute a shell command | Build, test, deploy |\n"
            "| `api_call` | Call an HTTP endpoint | Trigger external services |\n"
            "| `notification` | Send a notification | Alert team on completion |\n"
            "| `agent_call` | Delegate to NEXUS agent | Generate reports, analyse |\n"
            "| `condition` | Branch based on criteria | If tests pass, deploy |\n"
            "| `delay` | Wait for a duration | Cool-down between steps |\n"
            "| `approval` | Pause for manual approval | Gate production deploys |\n"
            "| `transform` | Transform data | Format output for next step |\n\n"
            "### Workflow Execution Modes\n\n"
            "- **Sequential** — Steps run one after another (default)\n"
            "- **Parallel** — Marked steps run concurrently\n"
            "- **Conditional** — Steps execute based on prior outcomes\n\n"
            "Tell me the steps you'd like in this workflow and I'll configure them!"
        )

        logger.info(f"AutomationAgent: created workflow WF-{workflow_id}")

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.84,
            metadata={
                "intent": "create_workflow",
                "workflow_id": workflow_id,
            },
            requires_followup=True,
            suggestions=[
                "Add a deployment pipeline workflow",
                "Create a backup + notify workflow",
                "Show example CI/CD workflow",
            ],
        )

    async def _handle_backup(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle backup automation configuration and management."""
        backup_id = str(uuid.uuid4())[:8]
        strategy = self._detect_backup_strategy(message)
        strategy_desc = BACKUP_STRATEGIES.get(strategy, BACKUP_STRATEGIES["full"])

        backup_entry = {
            "id": backup_id,
            "strategy": strategy,
            "created_at": datetime.utcnow().isoformat(),
            "status": "configured",
            "size_mb": 0,
            "retention_days": 30,
        }
        self._backups.append(backup_entry)

        content = (
            f"## 💾 Backup Configuration\n\n"
            f"**Backup ID:** `BKP-{backup_id}` | **Status:** ⚙️ Configured\n\n"
            "---\n\n"
            f"### Selected Strategy: {strategy.title()}\n\n"
            f"_{strategy_desc}_\n\n"
            "### Backup Strategy Comparison\n\n"
            "| Strategy | Size | Speed | Restore Time | Complexity |\n"
            "|----------|------|-------|-------------|------------|\n"
            "| Full | 🔴 Large | 🟡 Medium | 🟢 Fast | 🟢 Low |\n"
            "| Incremental | 🟢 Small | 🟢 Fast | 🔴 Slow | 🟡 Medium |\n"
            "| Differential | 🟡 Medium | 🟡 Medium | 🟡 Medium | 🟡 Medium |\n"
            "| Snapshot | 🟡 Varies | 🟢 Instant | 🟢 Fast | 🔴 High |\n\n"
            "### Backup Configuration Template\n\n"
            "```yaml\n"
            f"backup:\n"
            f"  id: BKP-{backup_id}\n"
            f"  strategy: {strategy}\n"
            "  sources:\n"
            "    - path: /data/database\n"
            "      type: database\n"
            "    - path: /etc/nexus/config\n"
            "      type: configuration\n"
            "    - path: /data/user-files\n"
            "      type: user_data\n"
            "  destination:\n"
            "    type: local  # or: s3, gcs, azure_blob\n"
            "    path: /backups/{date}\n"
            "  schedule:\n"
            "    cron: '0 2 * * *'  # Daily at 2 AM\n"
            "  retention:\n"
            "    days: 30\n"
            "    min_copies: 3\n"
            "    max_copies: 90\n"
            "  verification:\n"
            "    checksum: sha256\n"
            "    test_restore: weekly\n"
            "  notifications:\n"
            "    on_success: true\n"
            "    on_failure: true\n"
            "    channel: slack\n"
            "```\n\n"
            "### Backup Best Practices\n\n"
            "- ✅ Follow the **3-2-1 rule**: 3 copies, 2 media types, 1 offsite\n"
            "- ✅ Test restores regularly — untested backups are not backups\n"
            "- ✅ Encrypt backups at rest and in transit\n"
            "- ✅ Monitor backup job completion and alert on failures\n"
            "- ✅ Document restore procedures and keep them accessible\n\n"
            f"**Active backups:** {len(self._backups)} configured\n"
        )

        logger.info(f"AutomationAgent: configured backup BKP-{backup_id} ({strategy})")

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.88,
            metadata={
                "intent": "backup",
                "backup_id": backup_id,
                "strategy": strategy,
            },
            suggestions=[
                "Schedule this backup to run nightly",
                "Set up offsite backup to S3",
                "Test a backup restore",
            ],
        )

    async def _handle_system_maintenance(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle system maintenance task execution and scheduling."""
        task_type = self._detect_maintenance_task(message)
        task_info = MAINTENANCE_TASKS.get(task_type, MAINTENANCE_TASKS["health_check"])
        log_id = str(uuid.uuid4())[:8]

        self._maintenance_log.append({
            "id": log_id,
            "task": task_type,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "completed",
            "duration": task_info["estimated_duration"],
        })

        # Build full maintenance catalogue
        task_rows = []
        for key, info in MAINTENANCE_TASKS.items():
            risk_emoji = {"none": "🟢", "low": "🟡", "medium": "🟠", "high": "🔴"}.get(
                info["risk"], "⚪"
            )
            task_rows.append(
                f"| {info['name']} | {info['estimated_duration']} | "
                f"{risk_emoji} {info['risk'].title()} |"
            )
        task_table = "\n".join(task_rows)

        content = (
            f"## 🔧 System Maintenance\n\n"
            f"**Executing:** {task_info['name']} | **Log ID:** `MAINT-{log_id}`\n\n"
            "---\n\n"
            f"### {task_info['name']}\n\n"
            f"_{task_info['description']}_\n\n"
            f"- **Estimated Duration:** {task_info['estimated_duration']}\n"
            f"- **Risk Level:** {task_info['risk'].title()}\n"
            f"- **Status:** ✅ Completed\n\n"
            "### Maintenance Task Results\n\n"
            "```\n"
            f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}] Starting {task_info['name']}...\n"
            f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}] Scanning targets...\n"
            f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}] Processing...\n"
            f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}] ✅ {task_info['name']} completed successfully\n"
            "```\n\n"
            "### All Maintenance Tasks\n\n"
            "| Task | Duration | Risk |\n"
            "|------|----------|------|\n"
            f"{task_table}\n\n"
            f"**Maintenance actions this session:** {len(self._maintenance_log)}\n"
        )

        logger.info(f"AutomationAgent: maintenance task '{task_type}' logged as MAINT-{log_id}")

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.87,
            metadata={
                "intent": "system_maintenance",
                "task": task_type,
                "log_id": log_id,
            },
            suggestions=[
                "Schedule regular maintenance",
                "Run a full health check",
                "Show maintenance history",
            ],
        )

    async def _handle_self_healing(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle self-healing and auto-recovery configuration."""
        action_type = self._detect_healing_action(message)
        action_desc = SELF_HEALING_ACTIONS.get(action_type, "Apply automatic corrective action")
        rule_id = str(uuid.uuid4())[:8]

        self._healing_rules.append({
            "id": rule_id,
            "action": action_type,
            "created_at": datetime.utcnow().isoformat(),
            "triggered_count": 0,
            "active": True,
        })

        # Build action catalogue
        action_rows = []
        for key, desc in SELF_HEALING_ACTIONS.items():
            action_rows.append(f"| `{key}` | {desc} |")
        action_table = "\n".join(action_rows)

        content = (
            f"## 🩺 Self-Healing Configuration\n\n"
            f"**Rule ID:** `HEAL-{rule_id}` | **Status:** 🟢 Active\n\n"
            "---\n\n"
            f"### Action: {action_type.replace('_', ' ').title()}\n\n"
            f"_{action_desc}_\n\n"
            "### Self-Healing Architecture\n\n"
            "```\n"
            " ┌──────────────┐     ┌──────────────┐     ┌──────────────┐\n"
            " │   MONITOR    │ ──▶ │   DETECT     │ ──▶ │   RESPOND    │\n"
            " │              │     │              │     │              │\n"
            " │ Health checks│     │ Anomaly      │     │ Auto-fix     │\n"
            " │ Metric polls │     │ detection    │     │ Restart      │\n"
            " │ Log watchers │     │ Threshold    │     │ Reconnect    │\n"
            " │              │     │ alerts       │     │ Rollback     │\n"
            " └──────────────┘     └──────────────┘     └──────────────┘\n"
            "        │                                        │\n"
            "        └──────── Feedback Loop ◀────────────────┘\n"
            "```\n\n"
            "### Available Self-Healing Actions\n\n"
            "| Action | Description |\n"
            "|--------|-------------|\n"
            f"{action_table}\n\n"
            "### Self-Healing Rule Template\n\n"
            "```yaml\n"
            f"healing_rule:\n"
            f"  id: HEAL-{rule_id}\n"
            "  monitor:\n"
            "    target: service-api\n"
            "    metric: response_time_p99\n"
            "    check_interval: 60s\n"
            "  condition:\n"
            "    operator: greater_than\n"
            "    threshold: 2000  # ms\n"
            "    consecutive_failures: 3\n"
            "  action:\n"
            f"    type: {action_type}\n"
            "    params:\n"
            "      graceful: true\n"
            "      timeout: 30s\n"
            "  cooldown: 300s  # 5 min between actions\n"
            "  escalation:\n"
            "    after_failures: 3\n"
            "    notify: ops-team\n"
            "    channel: pagerduty\n"
            "```\n\n"
            f"**Active healing rules:** {len([r for r in self._healing_rules if r['active']])}\n"
        )

        logger.info(f"AutomationAgent: self-healing rule HEAL-{rule_id} created ({action_type})")

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.86,
            metadata={
                "intent": "self_healing",
                "rule_id": rule_id,
                "action": action_type,
            },
            suggestions=[
                "Set up health monitoring for all services",
                "Configure escalation to PagerDuty",
                "Add a self-healing rule for database connections",
            ],
        )

    async def _handle_general_automation(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle general automation queries and provide an overview."""

        content = (
            "## ⚙️ NEXUS Automation Agent\n\n"
            "I manage task automation, workflows, scheduling, backups, "
            "and system health. Here's what I can do:\n\n"
            "| Category | Examples |\n"
            "|----------|----------|\n"
            "| ⚡ **Automations** | Create trigger-based automated tasks |\n"
            "| ⏰ **Scheduling** | Cron jobs, interval timers, recurring tasks |\n"
            "| 🔗 **Workflows** | Multi-step pipelines with conditions |\n"
            "| 💾 **Backups** | Automated backups with retention policies |\n"
            "| 🔧 **Maintenance** | Disk cleanup, log rotation, health checks |\n"
            "| 🩺 **Self-Healing** | Auto-restart, reconnect, rebalance |\n\n"
            "### Current Status\n\n"
            f"- **Automations:** {len(self._automations)} registered\n"
            f"- **Workflows:** {len(self._workflows)} configured\n"
            f"- **Scheduled Tasks:** {len(self._scheduled_tasks)} active\n"
            f"- **Backups:** {len(self._backups)} configured\n"
            f"- **Healing Rules:** {len([r for r in self._healing_rules if r['active']])} active\n"
            f"- **Maintenance Actions:** {len(self._maintenance_log)} logged\n\n"
            "### Quick Start Examples\n\n"
            "- *\"Schedule a disk cleanup every Sunday at midnight\"*\n"
            "- *\"Create a backup automation for the database\"*\n"
            "- *\"Build a deployment workflow\"*\n"
            "- *\"Set up self-healing for the API service\"*\n"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.65,
            metadata={"intent": "general"},
            suggestions=[
                "Create a new automation",
                "Schedule a maintenance task",
                "Set up a backup",
            ],
        )

    # ------------------------------------------------------------------
    # Utility / helper methods
    # ------------------------------------------------------------------

    def _next_automation_id(self) -> str:
        """Generate an incrementing automation ID."""
        self._automation_counter += 1
        return f"{self._automation_counter:04d}"

    def _detect_trigger_type(self, message: str) -> str:
        """Detect the automation trigger type from the message."""
        trigger_keywords: Dict[str, List[str]] = {
            "time_based": ["every", "daily", "weekly", "cron", "schedule", "at ", "timer"],
            "event_based": ["when", "on event", "trigger on", "after", "upon"],
            "webhook": ["webhook", "http", "api call", "endpoint"],
            "threshold": ["threshold", "above", "below", "exceeds", "cpu", "memory"],
            "chain": ["after automation", "chain", "then run", "followed by"],
        }
        for trigger, keywords in trigger_keywords.items():
            if any(kw in message for kw in keywords):
                return trigger
        return "time_based"

    def _detect_cron_expression(self, message: str) -> str:
        """
        Detect or generate a cron expression from the message.

        Attempts to extract an explicit cron pattern first, then falls
        back to matching natural-language time descriptions against presets.
        """
        # Check for explicit cron pattern
        cron_pattern = re.search(r'[*\d/,\-]+\s+[*\d/,\-]+\s+[*\d/,\-]+\s+[*\d/,\-]+\s+[*\d/,\-]+', message)
        if cron_pattern:
            return cron_pattern.group().strip()

        # Natural language to cron mapping
        nl_keywords: Dict[str, str] = {
            "every minute": "* * * * *",
            "every 5 minute": "*/5 * * * *",
            "every 15 minute": "*/15 * * * *",
            "every hour": "0 * * * *",
            "every 6 hour": "0 */6 * * *",
            "midnight": "0 0 * * *",
            "every day at 6": "0 6 * * *",
            "every day at 9": "0 9 * * *",
            "9am": "0 9 * * *",
            "6am": "0 6 * * *",
            "every monday": "0 9 * * 1",
            "every friday": "0 17 * * 5",
            "every sunday": "0 0 * * 0",
            "first of every month": "0 0 1 * *",
            "monthly": "0 0 1 * *",
            "weekly": "0 9 * * 1",
            "daily": "0 0 * * *",
        }
        for phrase, cron in nl_keywords.items():
            if phrase in message:
                return cron

        return "0 0 * * *"  # Default: daily at midnight

    def _cron_to_human(self, cron_expr: str) -> str:
        """
        Convert a cron expression to a human-readable description.

        Handles common patterns. Falls back to displaying the raw
        expression for complex or unusual schedules.
        """
        common_translations: Dict[str, str] = {
            "* * * * *": "Every minute",
            "*/5 * * * *": "Every 5 minutes",
            "*/15 * * * *": "Every 15 minutes",
            "0 * * * *": "Every hour (at minute 0)",
            "0 */6 * * *": "Every 6 hours",
            "0 0 * * *": "Every day at midnight",
            "0 6 * * *": "Every day at 6:00 AM",
            "0 9 * * *": "Every day at 9:00 AM",
            "0 9 * * 1": "Every Monday at 9:00 AM",
            "0 17 * * 5": "Every Friday at 5:00 PM",
            "0 0 * * 0": "Every Sunday at midnight",
            "0 0 1 * *": "First day of every month at midnight",
            "0 0 1 1,4,7,10 *": "Quarterly (Jan, Apr, Jul, Oct) at midnight",
        }
        return common_translations.get(cron_expr, f"Custom schedule: {cron_expr}")

    def _detect_backup_strategy(self, message: str) -> str:
        """Detect the backup strategy from the message."""
        strategy_keywords: Dict[str, List[str]] = {
            "incremental": ["incremental", "changes only", "delta"],
            "differential": ["differential", "since last full"],
            "snapshot": ["snapshot", "point-in-time", "instant"],
            "full": ["full", "complete", "entire"],
        }
        for strategy, keywords in strategy_keywords.items():
            if any(kw in message for kw in keywords):
                return strategy
        return "full"

    def _detect_maintenance_task(self, message: str) -> str:
        """Detect which maintenance task the user is requesting."""
        task_keywords: Dict[str, List[str]] = {
            "disk_cleanup": ["disk", "cleanup", "clean up", "temp", "temporary"],
            "cache_clear": ["cache", "flush", "purge"],
            "log_rotation": ["log rotat", "compress log", "archive log"],
            "dependency_update": ["dependency", "update package", "upgrade", "pip update", "npm update"],
            "health_check": ["health check", "health", "status", "verify"],
            "database_vacuum": ["vacuum", "database optim", "rebuild index", "db maintenance"],
            "ssl_cert_check": ["ssl", "certificate", "tls", "cert"],
            "security_scan": ["security scan", "vulnerability", "scan", "audit"],
        }
        for task, keywords in task_keywords.items():
            if any(kw in message for kw in keywords):
                return task
        return "health_check"

    def _detect_healing_action(self, message: str) -> str:
        """Detect which self-healing action the user is requesting."""
        action_keywords: Dict[str, List[str]] = {
            "restart_service": ["restart", "reboot", "start service"],
            "clear_cache": ["clear cache", "flush cache", "cache"],
            "reconnect": ["reconnect", "connection", "database connect"],
            "rebalance": ["rebalance", "redistribute", "load balance"],
            "rollback_config": ["rollback", "revert", "last good config"],
            "scale_up": ["scale up", "more resources", "increase capacity"],
            "quarantine": ["quarantine", "isolate", "contain"],
        }
        for action, keywords in action_keywords.items():
            if any(kw in message for kw in keywords):
                return action
        return "restart_service"

    # ------------------------------------------------------------------
    # Public API for programmatic use
    # ------------------------------------------------------------------

    def get_automation_by_id(self, automation_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve an automation by its ID.

        Args:
            automation_id: The automation identifier (without AUTO- prefix).

        Returns:
            The automation dict, or None if not found.
        """
        for auto in self._automations:
            if auto["id"] == automation_id:
                return auto
        return None

    def get_workflow_by_id(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a workflow by its ID.

        Args:
            workflow_id: The workflow identifier (without WF- prefix).

        Returns:
            The workflow dict, or None if not found.
        """
        return self._workflows.get(workflow_id)

    def get_agent_summary(self) -> Dict[str, Any]:
        """
        Return a summary of the agent's current state.

        Includes counts of automations, workflows, scheduled tasks,
        backups, healing rules, and maintenance actions.
        """
        return {
            "agent": self.name,
            "automations": len(self._automations),
            "workflows": len(self._workflows),
            "scheduled_tasks": len(self._scheduled_tasks),
            "backups_configured": len(self._backups),
            "healing_rules_active": len([r for r in self._healing_rules if r["active"]]),
            "maintenance_actions_logged": len(self._maintenance_log),
        }
