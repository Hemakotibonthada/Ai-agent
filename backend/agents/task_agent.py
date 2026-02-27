"""
Task Agent - Manages tasks, projects, and productivity tracking.
Handles task creation, scheduling, prioritization, and project management.
"""

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from enum import Enum

from .base_agent import BaseAgent, AgentCapability, AgentContext, AgentResponse


class TaskPriority(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    BACKLOG = "backlog"


class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DEFERRED = "deferred"


class ProjectStatus(Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class TaskAgent(BaseAgent):
    """Agent for comprehensive task and project management."""

    def __init__(self):
        super().__init__(
            name="Task Agent",
            description="Manages tasks, projects, sprints, and productivity tracking",
        )
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.projects: Dict[str, Dict[str, Any]] = {}
        self.sprints: Dict[str, Dict[str, Any]] = {}
        self.time_entries: List[Dict[str, Any]] = []
        self.task_templates: Dict[str, Dict[str, Any]] = {}
        self.tags: Dict[str, List[str]] = {}
        self.productivity_data: List[Dict[str, Any]] = []

        self._intent_handlers = {
            "create_task": self._handle_create_task,
            "list_tasks": self._handle_list_tasks,
            "update_task": self._handle_update_task,
            "complete_task": self._handle_complete_task,
            "create_project": self._handle_create_project,
            "project_status": self._handle_project_status,
            "sprint_planning": self._handle_sprint_planning,
            "time_tracking": self._handle_time_tracking,
            "productivity": self._handle_productivity,
            "task_prioritize": self._handle_prioritize,
            "recurring_tasks": self._handle_recurring_tasks,
            "task_search": self._handle_task_search,
            "kanban": self._handle_kanban,
            "deadline_check": self._handle_deadline_check,
            "task_general": self._handle_general,
        }

        self._initialize_sample_data()

    def get_system_prompt(self) -> str:
        return (
            "You are the Task Agent of NEXUS AI OS. You manage tasks, projects, sprints, "
            "and productivity tracking for a 28-year-old DevOps engineer. You help them "
            "stay organized with Kanban boards, Eisenhower matrices, time tracking, and "
            "recurring task management. You understand their work patterns and proactively "
            "suggest prioritization and deadline management strategies."
        )

    def get_capabilities(self) -> List[AgentCapability]:
        return [
            AgentCapability.CHAT,
            AgentCapability.ANALYZE,
            AgentCapability.GENERATE,
            AgentCapability.MONITOR,
            AgentCapability.AUTOMATE,
            AgentCapability.NOTIFY,
            AgentCapability.REPORT,
        ]

    def _initialize_sample_data(self):
        """Seed with sample tasks and projects for demo."""
        demo_project_id = str(uuid.uuid4())
        self.projects[demo_project_id] = {
            "id": demo_project_id,
            "name": "Personal AI OS Development",
            "description": "Building and maintaining the Nexus AI operating system",
            "status": ProjectStatus.ACTIVE.value,
            "created_at": datetime.now().isoformat(),
            "deadline": (datetime.now() + timedelta(days=90)).isoformat(),
            "tasks": [],
            "tags": ["development", "ai", "personal"],
            "progress": 35.0,
            "milestones": [
                {"name": "Core Engine", "completed": True, "date": datetime.now().isoformat()},
                {"name": "Agent Framework", "completed": True, "date": datetime.now().isoformat()},
                {"name": "UI Implementation", "completed": False, "date": (datetime.now() + timedelta(days=30)).isoformat()},
                {"name": "ESP32 Integration", "completed": False, "date": (datetime.now() + timedelta(days=60)).isoformat()},
                {"name": "Mobile App", "completed": False, "date": (datetime.now() + timedelta(days=90)).isoformat()},
            ]
        }

        sample_tasks = [
            {
                "title": "Review Kubernetes cluster health",
                "description": "Check all pods, services, and deployments in production",
                "priority": TaskPriority.HIGH.value,
                "status": TaskStatus.PENDING.value,
                "project_id": demo_project_id,
                "tags": ["devops", "kubernetes", "daily"],
                "due_date": datetime.now().isoformat(),
                "estimated_hours": 1.0,
                "recurring": True,
                "recurrence_pattern": "daily",
            },
            {
                "title": "Update CI/CD pipeline configurations",
                "description": "Migrate GitHub Actions to use new runner images",
                "priority": TaskPriority.MEDIUM.value,
                "status": TaskStatus.IN_PROGRESS.value,
                "project_id": demo_project_id,
                "tags": ["devops", "ci-cd", "github"],
                "due_date": (datetime.now() + timedelta(days=3)).isoformat(),
                "estimated_hours": 4.0,
                "recurring": False,
            },
            {
                "title": "Backup database and verify integrity",
                "description": "Run automated backup and verify checksums",
                "priority": TaskPriority.HIGH.value,
                "status": TaskStatus.PENDING.value,
                "project_id": demo_project_id,
                "tags": ["devops", "database", "maintenance"],
                "due_date": datetime.now().isoformat(),
                "estimated_hours": 0.5,
                "recurring": True,
                "recurrence_pattern": "daily",
            },
            {
                "title": "Research new monitoring tools",
                "description": "Evaluate Grafana Alloy vs existing Prometheus stack",
                "priority": TaskPriority.LOW.value,
                "status": TaskStatus.PENDING.value,
                "project_id": demo_project_id,
                "tags": ["research", "monitoring"],
                "due_date": (datetime.now() + timedelta(days=14)).isoformat(),
                "estimated_hours": 6.0,
                "recurring": False,
            },
            {
                "title": "Weekly team standup notes",
                "description": "Prepare and share weekly standup summary",
                "priority": TaskPriority.MEDIUM.value,
                "status": TaskStatus.PENDING.value,
                "project_id": demo_project_id,
                "tags": ["meetings", "communication", "weekly"],
                "due_date": (datetime.now() + timedelta(days=2)).isoformat(),
                "estimated_hours": 0.5,
                "recurring": True,
                "recurrence_pattern": "weekly",
            },
        ]

        for task_data in sample_tasks:
            task_id = str(uuid.uuid4())
            self.tasks[task_id] = {
                "id": task_id,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "completed_at": None,
                "actual_hours": 0.0,
                "subtasks": [],
                "dependencies": [],
                "notes": [],
                "attachments": [],
                **task_data,
            }
            self.projects[demo_project_id]["tasks"].append(task_id)

        self.task_templates = {
            "code_review": {
                "title": "Code Review: {subject}",
                "description": "Review pull request and provide feedback",
                "priority": TaskPriority.HIGH.value,
                "estimated_hours": 1.5,
                "tags": ["code-review", "development"],
                "subtasks": [
                    "Check code style and conventions",
                    "Review business logic",
                    "Verify test coverage",
                    "Check for security issues",
                    "Approve or request changes",
                ],
            },
            "deployment": {
                "title": "Deploy {service} to {environment}",
                "description": "Production deployment checklist",
                "priority": TaskPriority.CRITICAL.value,
                "estimated_hours": 2.0,
                "tags": ["deployment", "devops"],
                "subtasks": [
                    "Pre-deployment checks",
                    "Database migrations",
                    "Deploy application",
                    "Smoke tests",
                    "Monitor for errors",
                    "Rollback plan ready",
                ],
            },
            "incident_response": {
                "title": "Incident: {description}",
                "description": "Incident response and resolution",
                "priority": TaskPriority.CRITICAL.value,
                "estimated_hours": 4.0,
                "tags": ["incident", "urgent"],
                "subtasks": [
                    "Acknowledge and assess severity",
                    "Identify root cause",
                    "Implement fix",
                    "Verify resolution",
                    "Post-mortem documentation",
                ],
            },
            "sprint_task": {
                "title": "{story_title}",
                "description": "Sprint task with acceptance criteria",
                "priority": TaskPriority.MEDIUM.value,
                "estimated_hours": 3.0,
                "tags": ["sprint", "development"],
                "subtasks": [
                    "Implementation",
                    "Unit tests",
                    "Integration tests",
                    "Documentation",
                    "Code review",
                ],
            },
        }

        sprint_id = str(uuid.uuid4())
        self.sprints[sprint_id] = {
            "id": sprint_id,
            "name": "Sprint 2026-W09",
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now() + timedelta(days=14)).isoformat(),
            "status": "active",
            "goals": [
                "Complete UI implementation for dashboard",
                "Integrate ESP32 sensor readings",
                "Implement voice command pipeline",
            ],
            "tasks": list(self.tasks.keys())[:3],
            "velocity": 21,
            "capacity": 30,
            "burndown": [
                {"day": 1, "remaining": 30, "ideal": 28},
                {"day": 2, "remaining": 27, "ideal": 26},
                {"day": 3, "remaining": 25, "ideal": 24},
            ],
        }

    async def _detect_intent(self, message: str) -> str:
        """Detect user intent from message."""
        message_lower = message.lower()

        intent_keywords = {
            "create_task": ["create task", "new task", "add task", "make task", "todo", "add todo"],
            "list_tasks": ["list tasks", "show tasks", "my tasks", "pending tasks", "all tasks", "task list"],
            "update_task": ["update task", "modify task", "change task", "edit task"],
            "complete_task": ["complete task", "finish task", "done with", "mark done", "mark complete"],
            "create_project": ["create project", "new project", "start project"],
            "project_status": ["project status", "project progress", "project update", "how's the project"],
            "sprint_planning": ["sprint", "sprint planning", "sprint status", "velocity", "burndown"],
            "time_tracking": ["track time", "time spent", "log hours", "time entry", "timesheet"],
            "productivity": ["productivity", "efficiency", "performance", "focus time", "deep work"],
            "task_prioritize": ["prioritize", "priority", "urgent", "important", "reorder"],
            "recurring_tasks": ["recurring", "repeat", "daily tasks", "weekly tasks", "routine"],
            "task_search": ["find task", "search task", "look for task", "filter tasks"],
            "kanban": ["kanban", "board", "columns", "workflow", "card"],
            "deadline_check": ["deadline", "due date", "overdue", "upcoming", "due soon"],
        }

        for intent, keywords in intent_keywords.items():
            if any(kw in message_lower for kw in keywords):
                return intent

        return "task_general"

    async def process(self, context: AgentContext) -> AgentResponse:
        """Process task-related messages."""
        message = context.message.strip()
        intent = await self._detect_intent(message)
        handler = self._intent_handlers.get(intent, self._handle_general)
        result = await handler(message, context.metadata or {})
        return AgentResponse(
            content=result.get("response", ""),
            agent_name=self.name,
            confidence=0.9,
            metadata=result.get("data", {}),
        )

    async def _handle_create_task(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new task."""
        title = self._extract_task_title(message)
        priority = self._extract_priority(message)
        due_date = self._extract_due_date(message)
        tags = self._extract_tags(message)

        task_id = str(uuid.uuid4())
        task = {
            "id": task_id,
            "title": title,
            "description": "",
            "priority": priority,
            "status": TaskStatus.PENDING.value,
            "project_id": None,
            "tags": tags,
            "due_date": due_date,
            "estimated_hours": 1.0,
            "actual_hours": 0.0,
            "recurring": False,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "completed_at": None,
            "subtasks": [],
            "dependencies": [],
            "notes": [],
            "attachments": [],
        }

        self.tasks[task_id] = task

        priority_emoji = {
            "critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢", "backlog": "⚪"
        }

        response = f"""## ✅ Task Created Successfully

| Field | Value |
|-------|-------|
| **ID** | `{task_id[:8]}...` |
| **Title** | {title} |
| **Priority** | {priority_emoji.get(priority, '⚪')} {priority.title()} |
| **Status** | 📋 Pending |
| **Due Date** | {due_date or 'Not set'} |
| **Tags** | {', '.join(f'`{t}`' for t in tags) if tags else 'None'} |

### Quick Actions
- Say **"add subtask to {task_id[:8]}"** to break it down
- Say **"set priority critical"** to escalate
- Say **"assign to project"** to link it
- Say **"track time on {task_id[:8]}"** to start timer

> 💡 *I'll remind you about this task based on its priority and due date.*
"""
        return {
            "response": response,
            "data": {"task": task},
            "intent": "create_task"
        }

    async def _handle_list_tasks(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """List all tasks with filtering."""
        message_lower = message.lower()

        # Filter by status
        status_filter = None
        if "pending" in message_lower:
            status_filter = TaskStatus.PENDING.value
        elif "in progress" in message_lower or "active" in message_lower:
            status_filter = TaskStatus.IN_PROGRESS.value
        elif "completed" in message_lower or "done" in message_lower:
            status_filter = TaskStatus.COMPLETED.value
        elif "blocked" in message_lower:
            status_filter = TaskStatus.BLOCKED.value

        # Filter by priority
        priority_filter = None
        if "critical" in message_lower:
            priority_filter = TaskPriority.CRITICAL.value
        elif "high priority" in message_lower:
            priority_filter = TaskPriority.HIGH.value

        filtered_tasks = []
        for task in self.tasks.values():
            if status_filter and task["status"] != status_filter:
                continue
            if priority_filter and task["priority"] != priority_filter:
                continue
            filtered_tasks.append(task)

        # Sort by priority then due date
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "backlog": 4}
        filtered_tasks.sort(key=lambda t: (
            priority_order.get(t["priority"], 5),
            t.get("due_date") or "9999"
        ))

        status_emoji = {
            "pending": "📋", "in_progress": "🔄", "blocked": "🚫",
            "in_review": "👀", "completed": "✅", "cancelled": "❌", "deferred": "⏸️"
        }
        priority_emoji = {
            "critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢", "backlog": "⚪"
        }

        task_rows = []
        for task in filtered_tasks:
            se = status_emoji.get(task["status"], "📋")
            pe = priority_emoji.get(task["priority"], "⚪")
            due = task.get("due_date", "")
            if due:
                try:
                    due_dt = datetime.fromisoformat(due)
                    if due_dt.date() < datetime.now().date():
                        due = f"⚠️ {due_dt.strftime('%b %d')}"
                    elif due_dt.date() == datetime.now().date():
                        due = f"📌 Today"
                    else:
                        due = due_dt.strftime("%b %d")
                except (ValueError, TypeError):
                    pass
            task_rows.append(
                f"| {se} | {pe} | {task['title'][:40]} | {due or '-'} | `{task['id'][:8]}` |"
            )

        filter_desc = []
        if status_filter:
            filter_desc.append(f"Status: {status_filter}")
        if priority_filter:
            filter_desc.append(f"Priority: {priority_filter}")
        filter_text = f" ({', '.join(filter_desc)})" if filter_desc else ""

        # Stats
        total = len(self.tasks)
        pending = sum(1 for t in self.tasks.values() if t["status"] == "pending")
        in_progress = sum(1 for t in self.tasks.values() if t["status"] == "in_progress")
        completed = sum(1 for t in self.tasks.values() if t["status"] == "completed")
        overdue = sum(1 for t in self.tasks.values()
                      if t.get("due_date") and t["status"] not in ("completed", "cancelled")
                      and datetime.fromisoformat(t["due_date"]).date() < datetime.now().date())

        response = f"""## 📋 Task List{filter_text}

### Overview
| Metric | Count |
|--------|-------|
| Total Tasks | {total} |
| 📋 Pending | {pending} |
| 🔄 In Progress | {in_progress} |
| ✅ Completed | {completed} |
| ⚠️ Overdue | {overdue} |

### Tasks ({len(filtered_tasks)} shown)
| Status | Priority | Title | Due | ID |
|--------|----------|-------|-----|----|
{chr(10).join(task_rows) if task_rows else "| - | - | No tasks found | - | - |"}

### Quick Actions
- **"create task [title]"** — Add a new task
- **"complete task [id]"** — Mark as done
- **"show kanban"** — View board layout
- **"deadline check"** — See upcoming deadlines
"""
        return {
            "response": response,
            "data": {"tasks": filtered_tasks, "total": total},
            "intent": "list_tasks"
        }

    async def _handle_update_task(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing task."""
        task_id = self._find_task_by_reference(message)
        if not task_id or task_id not in self.tasks:
            return {
                "response": "❌ **Task not found.** Please specify a valid task ID or title.\n\nUse **\"list tasks\"** to see all available tasks.",
                "intent": "update_task"
            }

        task = self.tasks[task_id]
        changes = []

        message_lower = message.lower()
        if "high" in message_lower and "priority" in message_lower:
            task["priority"] = TaskPriority.HIGH.value
            changes.append("Priority → High")
        elif "critical" in message_lower:
            task["priority"] = TaskPriority.CRITICAL.value
            changes.append("Priority → Critical")
        elif "low" in message_lower and "priority" in message_lower:
            task["priority"] = TaskPriority.LOW.value
            changes.append("Priority → Low")

        if "in progress" in message_lower or "start" in message_lower:
            task["status"] = TaskStatus.IN_PROGRESS.value
            changes.append("Status → In Progress")
        elif "block" in message_lower:
            task["status"] = TaskStatus.BLOCKED.value
            changes.append("Status → Blocked")
        elif "review" in message_lower:
            task["status"] = TaskStatus.IN_REVIEW.value
            changes.append("Status → In Review")

        task["updated_at"] = datetime.now().isoformat()

        response = f"""## ✏️ Task Updated

**{task['title']}** (`{task_id[:8]}`)

### Changes Applied
{chr(10).join(f'- ✅ {c}' for c in changes) if changes else '- ⚠️ No changes detected'}

### Current State
| Field | Value |
|-------|-------|
| Priority | {task['priority'].title()} |
| Status | {task['status'].replace('_', ' ').title()} |
| Due Date | {task.get('due_date', 'Not set')} |
| Updated | {task['updated_at']} |
"""
        return {
            "response": response,
            "data": {"task": task, "changes": changes},
            "intent": "update_task"
        }

    async def _handle_complete_task(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Mark a task as completed."""
        task_id = self._find_task_by_reference(message)
        if not task_id or task_id not in self.tasks:
            return {
                "response": "❌ **Task not found.** Specify a task ID or title to complete.",
                "intent": "complete_task"
            }

        task = self.tasks[task_id]
        task["status"] = TaskStatus.COMPLETED.value
        task["completed_at"] = datetime.now().isoformat()
        task["updated_at"] = datetime.now().isoformat()

        completed_total = sum(1 for t in self.tasks.values() if t["status"] == "completed")
        total = len(self.tasks)
        streak = self._calculate_streak()

        response = f"""## 🎉 Task Completed!

**{task['title']}**

| Metric | Value |
|--------|-------|
| Completed At | {task['completed_at']} |
| Time Spent | {task.get('actual_hours', 0):.1f} hours |
| Est. Time | {task.get('estimated_hours', 0):.1f} hours |

### Progress
- Tasks Completed: **{completed_total}/{total}** ({completed_total/total*100:.0f}%)
- Current Streak: **{streak} days** 🔥
- Remaining: **{total - completed_total}** tasks

> Great job! Keep the momentum going! 💪
"""
        return {
            "response": response,
            "data": {"task": task, "streak": streak},
            "intent": "complete_task"
        }

    async def _handle_create_project(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new project."""
        name = self._extract_project_name(message)
        project_id = str(uuid.uuid4())

        project = {
            "id": project_id,
            "name": name,
            "description": "",
            "status": ProjectStatus.PLANNING.value,
            "created_at": datetime.now().isoformat(),
            "deadline": (datetime.now() + timedelta(days=30)).isoformat(),
            "tasks": [],
            "tags": [],
            "progress": 0.0,
            "milestones": [],
        }

        self.projects[project_id] = project

        response = f"""## 📁 Project Created

| Field | Value |
|-------|-------|
| **Name** | {name} |
| **ID** | `{project_id[:8]}...` |
| **Status** | 📝 Planning |
| **Created** | {project['created_at']} |
| **Target** | {project['deadline']} |

### Next Steps
1. Add milestones: **"add milestone [name] to project"**
2. Create tasks: **"create task for project {name}"**
3. Start sprint: **"create sprint for {name}"**
4. Set team: **"assign team to project"**

> 💡 *I'll track progress and send daily updates on this project.*
"""
        return {
            "response": response,
            "data": {"project": project},
            "intent": "create_project"
        }

    async def _handle_project_status(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Show project status and progress."""
        project_rows = []
        for project in self.projects.values():
            task_count = len(project.get("tasks", []))
            completed = sum(
                1 for tid in project.get("tasks", [])
                if tid in self.tasks and self.tasks[tid]["status"] == "completed"
            )
            progress = (completed / task_count * 100) if task_count > 0 else 0

            milestone_info = ""
            milestones = project.get("milestones", [])
            if milestones:
                done_ms = sum(1 for m in milestones if m.get("completed"))
                milestone_info = f"{done_ms}/{len(milestones)}"

            status_emoji = {
                "planning": "📝", "active": "🚀", "on_hold": "⏸️",
                "completed": "✅", "archived": "📦"
            }
            se = status_emoji.get(project["status"], "📁")

            project_rows.append(f"| {se} {project['name'][:30]} | {task_count} | {completed} | {progress:.0f}% | {milestone_info or '-'} |")

        response = f"""## 📊 Project Dashboard

| Project | Tasks | Done | Progress | Milestones |
|---------|-------|------|----------|------------|
{chr(10).join(project_rows) if project_rows else "| No projects found | - | - | - | - |"}

### Active Sprints
"""
        for sprint in self.sprints.values():
            if sprint.get("status") == "active":
                sprint_tasks = len(sprint.get("tasks", []))
                response += f"""
#### 🏃 {sprint['name']}
- **Period**: {sprint['start_date'][:10]} → {sprint['end_date'][:10]}
- **Tasks**: {sprint_tasks} assigned
- **Velocity**: {sprint.get('velocity', 0)} points
- **Capacity**: {sprint.get('capacity', 0)} points
- **Goals**:
"""
                for goal in sprint.get("goals", []):
                    response += f"  - {goal}\n"

        response += """
### Quick Actions
- **"create project [name]"** — New project
- **"sprint planning"** — Plan next sprint
- **"show kanban"** — Visual board
"""
        return {
            "response": response,
            "data": {"projects": list(self.projects.values())},
            "intent": "project_status"
        }

    async def _handle_sprint_planning(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Handle sprint planning and status."""
        active_sprint = None
        for sprint in self.sprints.values():
            if sprint.get("status") == "active":
                active_sprint = sprint
                break

        if not active_sprint:
            sprint_id = str(uuid.uuid4())
            active_sprint = {
                "id": sprint_id,
                "name": f"Sprint {datetime.now().strftime('%Y-W%W')}",
                "start_date": datetime.now().isoformat(),
                "end_date": (datetime.now() + timedelta(days=14)).isoformat(),
                "status": "active",
                "goals": [],
                "tasks": [],
                "velocity": 0,
                "capacity": 30,
                "burndown": [],
            }
            self.sprints[sprint_id] = active_sprint

        sprint_tasks = [
            self.tasks[tid] for tid in active_sprint.get("tasks", [])
            if tid in self.tasks
        ]
        completed = sum(1 for t in sprint_tasks if t["status"] == "completed")
        in_progress = sum(1 for t in sprint_tasks if t["status"] == "in_progress")
        pending = sum(1 for t in sprint_tasks if t["status"] == "pending")

        burndown_chart = self._generate_burndown(active_sprint)

        response = f"""## 🏃 Sprint: {active_sprint['name']}

### Sprint Info
| Field | Value |
|-------|-------|
| **Period** | {active_sprint['start_date'][:10]} → {active_sprint['end_date'][:10]} |
| **Status** | Active |
| **Velocity** | {active_sprint.get('velocity', 0)} pts |
| **Capacity** | {active_sprint.get('capacity', 0)} pts |

### Task Breakdown
| Status | Count |
|--------|-------|
| ✅ Completed | {completed} |
| 🔄 In Progress | {in_progress} |
| 📋 Pending | {pending} |
| **Total** | **{len(sprint_tasks)}** |

### Sprint Goals
{chr(10).join(f'- {"✅" if i < completed else "⬜"} {g}' for i, g in enumerate(active_sprint.get("goals", ["No goals set"])))}

### Burndown Chart
```
{burndown_chart}
```

### Recommendations
- {"🎯 On track! Keep up the great work." if completed >= len(sprint_tasks) * 0.3 else "⚠️ Behind schedule. Consider reducing scope or re-prioritizing."}
- Focus on high-priority items first
- Block 2-hour deep work sessions for complex tasks
"""
        return {
            "response": response,
            "data": {"sprint": active_sprint, "stats": {"completed": completed, "in_progress": in_progress, "pending": pending}},
            "intent": "sprint_planning"
        }

    async def _handle_time_tracking(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Handle time tracking for tasks."""
        today_entries = [
            e for e in self.time_entries
            if e.get("date", "").startswith(datetime.now().strftime("%Y-%m-%d"))
        ]
        total_today = sum(e.get("hours", 0) for e in today_entries)
        week_entries = [
            e for e in self.time_entries
            if datetime.fromisoformat(e["date"]).isocalendar()[1] == datetime.now().isocalendar()[1]
        ] if self.time_entries else []
        total_week = sum(e.get("hours", 0) for e in week_entries)

        category_hours = {}
        for entry in self.time_entries:
            cat = entry.get("category", "Other")
            category_hours[cat] = category_hours.get(cat, 0) + entry.get("hours", 0)

        cat_rows = [f"| {cat} | {hours:.1f}h |" for cat, hours in sorted(category_hours.items(), key=lambda x: -x[1])]

        response = f"""## ⏱️ Time Tracking

### Today's Summary
| Metric | Value |
|--------|-------|
| Total Hours | {total_today:.1f}h |
| Tasks Worked | {len(today_entries)} |
| Focus Time | {total_today * 0.7:.1f}h |
| Break Time | {total_today * 0.3:.1f}h |

### This Week
| Metric | Value |
|--------|-------|
| Total Hours | {total_week:.1f}h |
| Daily Average | {total_week / max(datetime.now().weekday() + 1, 1):.1f}h |
| Target | 40.0h |
| Remaining | {max(40 - total_week, 0):.1f}h |

### Time by Category
| Category | Hours |
|----------|-------|
{chr(10).join(cat_rows) if cat_rows else "| No data yet | 0.0h |"}

### Quick Actions
- **"track 2 hours on [task]"** — Log time
- **"start timer for [task]"** — Start tracking
- **"stop timer"** — Stop current timer
- **"timesheet"** — Weekly report
"""
        return {
            "response": response,
            "data": {"today_hours": total_today, "week_hours": total_week},
            "intent": "time_tracking"
        }

    async def _handle_productivity(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze productivity metrics."""
        total_tasks = len(self.tasks)
        completed = sum(1 for t in self.tasks.values() if t["status"] == "completed")
        avg_completion_rate = (completed / total_tasks * 100) if total_tasks > 0 else 0

        overdue = sum(
            1 for t in self.tasks.values()
            if t.get("due_date") and t["status"] not in ("completed", "cancelled")
            and datetime.fromisoformat(t["due_date"]).date() < datetime.now().date()
        )

        est_hours = sum(t.get("estimated_hours", 0) for t in self.tasks.values())
        actual_hours = sum(t.get("actual_hours", 0) for t in self.tasks.values())
        estimation_accuracy = (actual_hours / est_hours * 100) if est_hours > 0 else 0

        priority_dist = {}
        for task in self.tasks.values():
            p = task["priority"]
            priority_dist[p] = priority_dist.get(p, 0) + 1

        streak = self._calculate_streak()

        score = min(100, max(0, int(
            avg_completion_rate * 0.3 +
            (100 - overdue / max(total_tasks, 1) * 100) * 0.2 +
            min(estimation_accuracy, 100) * 0.2 +
            streak * 5 * 0.15 +
            50 * 0.15
        )))

        bar = "█" * (score // 5) + "░" * (20 - score // 5)

        response = f"""## 📈 Productivity Analysis

### Productivity Score: {score}/100
```
[{bar}] {score}%
```

### Key Metrics
| Metric | Value | Status |
|--------|-------|--------|
| Completion Rate | {avg_completion_rate:.0f}% | {"✅" if avg_completion_rate > 70 else "⚠️"} |
| Overdue Tasks | {overdue} | {"✅" if overdue == 0 else "🔴"} |
| Estimation Accuracy | {estimation_accuracy:.0f}% | {"✅" if 80 < estimation_accuracy < 120 else "⚠️"} |
| Current Streak | {streak} days | {"🔥" if streak > 5 else "📊"} |
| Tasks Completed | {completed}/{total_tasks} | {"✅" if completed > total_tasks * 0.5 else "📋"} |

### Priority Distribution
| Priority | Count | Percentage |
|----------|-------|------------|
| 🔴 Critical | {priority_dist.get('critical', 0)} | {priority_dist.get('critical', 0)/max(total_tasks,1)*100:.0f}% |
| 🟠 High | {priority_dist.get('high', 0)} | {priority_dist.get('high', 0)/max(total_tasks,1)*100:.0f}% |
| 🟡 Medium | {priority_dist.get('medium', 0)} | {priority_dist.get('medium', 0)/max(total_tasks,1)*100:.0f}% |
| 🟢 Low | {priority_dist.get('low', 0)} | {priority_dist.get('low', 0)/max(total_tasks,1)*100:.0f}% |

### Recommendations
1. {"✅ Great streak! Keep completing tasks daily." if streak >= 5 else "💡 Try to complete at least one task per day to build a streak."}
2. {"⚠️ Focus on clearing overdue tasks first." if overdue > 0 else "✅ No overdue tasks - excellent time management!"}
3. {"💡 Improve time estimation - you're off by " + f"{abs(100-estimation_accuracy):.0f}%" if abs(100-estimation_accuracy) > 20 else "✅ Good estimation accuracy."}
4. Block **deep work sessions** (2-4 hours) for complex tasks
5. Use the **Pomodoro technique** for repetitive work

### Productivity Tips for DevOps Engineers
- Automate repetitive deployment checks
- Create runbooks for common incidents
- Use infrastructure-as-code templates
- Set up monitoring alerts to reduce manual checking
"""
        return {
            "response": response,
            "data": {"score": score, "completion_rate": avg_completion_rate, "streak": streak},
            "intent": "productivity"
        }

    async def _handle_prioritize(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Help prioritize tasks using Eisenhower matrix."""
        urgent_important = []
        not_urgent_important = []
        urgent_not_important = []
        not_urgent_not_important = []

        for task in self.tasks.values():
            if task["status"] in ("completed", "cancelled"):
                continue

            is_urgent = False
            if task.get("due_date"):
                try:
                    due = datetime.fromisoformat(task["due_date"])
                    is_urgent = (due - datetime.now()).days <= 2
                except (ValueError, TypeError):
                    pass
            if task["priority"] in ("critical", "high"):
                is_urgent = True

            is_important = task["priority"] in ("critical", "high", "medium")

            if is_urgent and is_important:
                urgent_important.append(task)
            elif not is_urgent and is_important:
                not_urgent_important.append(task)
            elif is_urgent and not is_important:
                urgent_not_important.append(task)
            else:
                not_urgent_not_important.append(task)

        def task_line(t):
            return f"  - {'🔴' if t['priority'] == 'critical' else '🟠' if t['priority'] == 'high' else '🟡'} {t['title'][:35]}"

        response = f"""## 🎯 Task Prioritization (Eisenhower Matrix)

### 🔴 DO FIRST (Urgent + Important)
{chr(10).join(task_line(t) for t in urgent_important) or "  - No tasks in this category"}

### 🟠 SCHEDULE (Important, Not Urgent)
{chr(10).join(task_line(t) for t in not_urgent_important) or "  - No tasks in this category"}

### 🟡 DELEGATE (Urgent, Not Important)
{chr(10).join(task_line(t) for t in urgent_not_important) or "  - No tasks in this category"}

### ⚪ ELIMINATE (Not Urgent, Not Important)
{chr(10).join(task_line(t) for t in not_urgent_not_important) or "  - No tasks in this category"}

### Summary
| Quadrant | Count |
|----------|-------|
| Do First | {len(urgent_important)} |
| Schedule | {len(not_urgent_important)} |
| Delegate | {len(urgent_not_important)} |
| Eliminate | {len(not_urgent_not_important)} |

### Suggested Focus Order
"""
        all_actionable = urgent_important + not_urgent_important + urgent_not_important
        for i, task in enumerate(all_actionable[:5], 1):
            response += f"{i}. **{task['title']}** — {task['priority'].title()} priority\n"

        return {
            "response": response,
            "data": {"matrix": {
                "do_first": len(urgent_important),
                "schedule": len(not_urgent_important),
                "delegate": len(urgent_not_important),
                "eliminate": len(not_urgent_not_important),
            }},
            "intent": "task_prioritize"
        }

    async def _handle_recurring_tasks(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Manage recurring tasks."""
        recurring = [t for t in self.tasks.values() if t.get("recurring")]

        pattern_groups = {}
        for task in recurring:
            pattern = task.get("recurrence_pattern", "custom")
            pattern_groups.setdefault(pattern, []).append(task)

        response = "## 🔄 Recurring Tasks\n\n"
        for pattern, tasks in sorted(pattern_groups.items()):
            emoji = {"daily": "📅", "weekly": "📆", "monthly": "🗓️", "yearly": "📅"}.get(pattern, "🔄")
            response += f"### {emoji} {pattern.title()}\n"
            for task in tasks:
                status_e = "✅" if task["status"] == "completed" else "📋"
                response += f"- {status_e} **{task['title']}** — {task['priority'].title()} priority\n"
            response += "\n"

        if not recurring:
            response += "*No recurring tasks configured.*\n\n"

        response += """### Suggested Recurring Tasks for DevOps
| Task | Frequency | Priority |
|------|-----------|----------|
| Check cluster health | Daily | High |
| Review security alerts | Daily | Critical |
| Database backups verification | Daily | High |
| Update dependencies | Weekly | Medium |
| Infrastructure cost review | Weekly | Medium |
| Performance benchmarks | Monthly | Medium |
| Disaster recovery drill | Monthly | High |
| Certificate renewal check | Monthly | Critical |

### Quick Actions
- **"add daily task [name]"** — Create daily recurring task
- **"add weekly task [name]"** — Create weekly recurring task
"""
        return {
            "response": response,
            "data": {"recurring_tasks": recurring},
            "intent": "recurring_tasks"
        }

    async def _handle_task_search(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Search tasks by keyword, tag, or filter."""
        search_terms = message.lower().replace("find task", "").replace("search task", "").replace("look for", "").strip()

        results = []
        for task in self.tasks.values():
            score = 0
            if search_terms in task["title"].lower():
                score += 10
            if search_terms in task.get("description", "").lower():
                score += 5
            if any(search_terms in tag for tag in task.get("tags", [])):
                score += 8
            if score > 0:
                results.append((score, task))

        results.sort(key=lambda x: -x[0])

        response = f"## 🔍 Search Results for \"{search_terms}\"\n\n"
        if results:
            response += "| Score | Title | Status | Priority | Tags |\n|-------|-------|--------|----------|------|\n"
            for score, task in results[:10]:
                tags = ", ".join(f"`{t}`" for t in task.get("tags", [])[:3])
                response += f"| {score} | {task['title'][:35]} | {task['status']} | {task['priority']} | {tags} |\n"
        else:
            response += f"*No tasks matching \"{search_terms}\".*\n"

        response += f"\n**{len(results)}** results found.\n"
        return {
            "response": response,
            "data": {"results": [t for _, t in results[:10]]},
            "intent": "task_search"
        }

    async def _handle_kanban(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Display Kanban board view."""
        columns = {
            "📋 Backlog": [],
            "📌 To Do": [],
            "🔄 In Progress": [],
            "👀 In Review": [],
            "✅ Done": [],
        }

        status_to_column = {
            "pending": "📌 To Do",
            "backlog": "📋 Backlog",
            "in_progress": "🔄 In Progress",
            "in_review": "👀 In Review",
            "completed": "✅ Done",
            "blocked": "🔄 In Progress",
        }

        for task in self.tasks.values():
            col = status_to_column.get(task["status"], "📋 Backlog")
            if col in columns:
                columns[col].append(task)

        max_items = max(len(v) for v in columns.values()) if columns else 0

        response = "## 📊 Kanban Board\n\n"
        response += "```\n"
        col_width = 25
        header = " | ".join(col.center(col_width) for col in columns.keys())
        response += header + "\n"
        response += "-" * len(header) + "\n"

        for i in range(max_items):
            row_parts = []
            for col_name, tasks in columns.items():
                if i < len(tasks):
                    task = tasks[i]
                    priority_marker = {"critical": "!", "high": "*", "medium": "-", "low": ".", "backlog": " "}.get(task["priority"], " ")
                    cell = f"[{priority_marker}] {task['title'][:col_width-5]}"
                else:
                    cell = ""
                row_parts.append(cell.ljust(col_width))
            response += " | ".join(row_parts) + "\n"

        response += "```\n\n"

        response += "### Column Summary\n"
        response += "| Column | Cards | % |\n|--------|-------|---|\n"
        total = sum(len(v) for v in columns.values())
        for col, tasks in columns.items():
            pct = (len(tasks) / total * 100) if total > 0 else 0
            bar = "█" * int(pct / 5)
            response += f"| {col} | {len(tasks)} | {bar} {pct:.0f}% |\n"

        wip_limit = 3
        in_progress_count = len(columns.get("🔄 In Progress", []))
        if in_progress_count > wip_limit:
            response += f"\n⚠️ **WIP Limit Exceeded!** You have {in_progress_count} tasks in progress (limit: {wip_limit}). Consider completing some before starting new ones.\n"

        return {
            "response": response,
            "data": {"columns": {k: len(v) for k, v in columns.items()}},
            "intent": "kanban"
        }

    async def _handle_deadline_check(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Check upcoming deadlines and overdue tasks."""
        now = datetime.now()
        overdue = []
        today = []
        this_week = []
        next_week = []
        later = []

        for task in self.tasks.values():
            if task["status"] in ("completed", "cancelled"):
                continue
            if not task.get("due_date"):
                continue
            try:
                due = datetime.fromisoformat(task["due_date"])
            except (ValueError, TypeError):
                continue

            delta = (due.date() - now.date()).days
            if delta < 0:
                overdue.append((delta, task))
            elif delta == 0:
                today.append(task)
            elif delta <= 7:
                this_week.append((delta, task))
            elif delta <= 14:
                next_week.append((delta, task))
            else:
                later.append((delta, task))

        overdue.sort(key=lambda x: x[0])

        response = "## ⏰ Deadline Overview\n\n"

        if overdue:
            response += "### 🔴 OVERDUE\n"
            for days, task in overdue:
                response += f"- **{task['title']}** — {abs(days)} day(s) overdue! ({task['priority']} priority)\n"
            response += "\n"

        if today:
            response += "### 📌 DUE TODAY\n"
            for task in today:
                response += f"- **{task['title']}** — {task['priority'].title()} priority\n"
            response += "\n"

        if this_week:
            response += "### 📅 THIS WEEK\n"
            for days, task in this_week:
                response += f"- **{task['title']}** — in {days} day(s) ({task['priority']} priority)\n"
            response += "\n"

        if next_week:
            response += "### 📆 NEXT WEEK\n"
            for days, task in next_week:
                response += f"- **{task['title']}** — in {days} day(s)\n"
            response += "\n"

        if not any([overdue, today, this_week, next_week]):
            response += "✅ **No upcoming deadlines!** You're all clear.\n\n"

        response += f"""### Summary
| Category | Count |
|----------|-------|
| 🔴 Overdue | {len(overdue)} |
| 📌 Due Today | {len(today)} |
| 📅 This Week | {len(this_week)} |
| 📆 Next Week | {len(next_week)} |
| 📋 Later | {len(later)} |
"""
        return {
            "response": response,
            "data": {
                "overdue": len(overdue),
                "today": len(today),
                "this_week": len(this_week),
            },
            "intent": "deadline_check"
        }

    async def _handle_general(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """General task management assistance."""
        total = len(self.tasks)
        pending = sum(1 for t in self.tasks.values() if t["status"] == "pending")
        in_progress = sum(1 for t in self.tasks.values() if t["status"] == "in_progress")
        completed = sum(1 for t in self.tasks.values() if t["status"] == "completed")

        response = f"""## 📋 Task Manager

### Current Status
| Metric | Value |
|--------|-------|
| Total Tasks | {total} |
| Pending | {pending} |
| In Progress | {in_progress} |
| Completed | {completed} |
| Projects | {len(self.projects)} |
| Sprints | {len(self.sprints)} |

### Available Commands

#### Task Management
| Command | Description |
|---------|-------------|
| `create task [title]` | Create a new task |
| `list tasks` | Show all tasks |
| `complete task [id/title]` | Mark as done |
| `update task [id]` | Modify a task |
| `prioritize tasks` | Eisenhower matrix |
| `search tasks [query]` | Find tasks |

#### Project Management
| Command | Description |
|---------|-------------|
| `create project [name]` | New project |
| `project status` | Dashboard |
| `sprint planning` | Sprint management |

#### Productivity
| Command | Description |
|---------|-------------|
| `show kanban` | Kanban board |
| `deadline check` | Upcoming deadlines |
| `time tracking` | Time management |
| `productivity` | Performance analysis |
| `recurring tasks` | Routine management |

> 💡 *I integrate with your calendar, email, and other agents to provide a unified task view.*
"""
        return {
            "response": response,
            "data": {"stats": {"total": total, "pending": pending, "completed": completed}},
            "intent": "task_general"
        }

    # ─── Helper Methods ──────────────────────────────────────────

    def _extract_task_title(self, message: str) -> str:
        """Extract task title from message."""
        remove_phrases = [
            "create task", "new task", "add task", "make task",
            "add todo", "create todo", "please", "can you",
        ]
        title = message
        for phrase in remove_phrases:
            title = title.lower().replace(phrase, "")
        title = title.strip().strip('"').strip("'")
        return title.title() if title else "Untitled Task"

    def _extract_priority(self, message: str) -> str:
        """Extract priority from message."""
        message_lower = message.lower()
        if "critical" in message_lower or "asap" in message_lower:
            return TaskPriority.CRITICAL.value
        elif "high" in message_lower or "important" in message_lower or "urgent" in message_lower:
            return TaskPriority.HIGH.value
        elif "low" in message_lower or "minor" in message_lower:
            return TaskPriority.LOW.value
        return TaskPriority.MEDIUM.value

    def _extract_due_date(self, message: str) -> Optional[str]:
        """Extract due date from message."""
        message_lower = message.lower()
        now = datetime.now()
        if "today" in message_lower:
            return now.isoformat()
        elif "tomorrow" in message_lower:
            return (now + timedelta(days=1)).isoformat()
        elif "next week" in message_lower:
            return (now + timedelta(days=7)).isoformat()
        elif "next month" in message_lower:
            return (now + timedelta(days=30)).isoformat()
        return None

    def _extract_tags(self, message: str) -> List[str]:
        """Extract tags from message."""
        import re
        tags = re.findall(r'#(\w+)', message)
        keyword_tags = {
            "devops": ["deploy", "kubernetes", "docker", "ci/cd", "pipeline"],
            "urgent": ["urgent", "asap", "emergency"],
            "meeting": ["meeting", "standup", "sync", "call"],
            "review": ["review", "pr", "pull request", "code review"],
        }
        message_lower = message.lower()
        for tag, keywords in keyword_tags.items():
            if any(kw in message_lower for kw in keywords):
                if tag not in tags:
                    tags.append(tag)
        return tags

    def _extract_project_name(self, message: str) -> str:
        """Extract project name from message."""
        remove = ["create project", "new project", "start project", "please", "can you"]
        name = message
        for phrase in remove:
            name = name.lower().replace(phrase, "")
        return name.strip().strip('"').strip("'").title() or "Untitled Project"

    def _find_task_by_reference(self, message: str) -> Optional[str]:
        """Find task ID by partial ID or title match."""
        message_lower = message.lower()
        for task_id, task in self.tasks.items():
            if task_id[:8] in message_lower:
                return task_id
            if task["title"].lower() in message_lower:
                return task_id
        # Fuzzy match
        for task_id, task in self.tasks.items():
            title_words = task["title"].lower().split()
            if any(word in message_lower for word in title_words if len(word) > 3):
                return task_id
        return None

    def _calculate_streak(self) -> int:
        """Calculate consecutive days with completed tasks."""
        completed_dates = set()
        for task in self.tasks.values():
            if task.get("completed_at"):
                try:
                    dt = datetime.fromisoformat(task["completed_at"])
                    completed_dates.add(dt.date())
                except (ValueError, TypeError):
                    pass

        streak = 0
        current = datetime.now().date()
        while current in completed_dates:
            streak += 1
            current -= timedelta(days=1)
        return streak

    def _generate_burndown(self, sprint: Dict[str, Any]) -> str:
        """Generate ASCII burndown chart."""
        burndown = sprint.get("burndown", [])
        if not burndown:
            return "No burndown data available yet."

        max_points = max(d.get("remaining", 0) for d in burndown) if burndown else 30
        if max_points == 0:
            max_points = 30
        height = 10
        width = min(len(burndown), 14)

        chart_lines = []
        for row in range(height, -1, -1):
            threshold = (row / height) * max_points
            line = f"{threshold:5.0f} |"
            for col in range(width):
                remaining = burndown[col].get("remaining", 0) if col < len(burndown) else 0
                ideal = burndown[col].get("ideal", 0) if col < len(burndown) else 0
                if remaining >= threshold and (remaining - max_points/height) < threshold:
                    line += " ■"
                elif ideal >= threshold and (ideal - max_points/height) < threshold:
                    line += " ·"
                else:
                    line += "  "
            chart_lines.append(line)

        chart_lines.append("      +" + "--" * width)
        chart_lines.append("       " + " ".join(str(i+1) for i in range(width)))
        chart_lines.append("       ■ = Actual  · = Ideal")

        return "\n".join(chart_lines)

    async def get_status(self) -> Dict[str, Any]:
        """Get agent status."""
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "status": "active",
            "tasks_count": len(self.tasks),
            "projects_count": len(self.projects),
            "sprints_count": len(self.sprints),
            "pending_tasks": sum(1 for t in self.tasks.values() if t["status"] == "pending"),
            "overdue_tasks": sum(
                1 for t in self.tasks.values()
                if t.get("due_date") and t["status"] not in ("completed", "cancelled")
                and datetime.fromisoformat(t["due_date"]).date() < datetime.now().date()
            ),
        }
