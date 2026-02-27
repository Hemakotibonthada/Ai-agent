# NEXUS AI - Task Management API Routes
"""
Endpoints for task CRUD, kanban board view, and productivity analytics.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.repositories import TaskRepository
from database.models import TaskStatus, TaskPriority
from api.dependencies import get_current_user_id


# ============================================================
# Request / Response Models
# ============================================================

class TaskCreateRequest(BaseModel):
    """Request to create a new task."""
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: Optional[str] = Field(None, max_length=2000, description="Task description")
    priority: str = Field("medium", description="Priority: low, medium, high, critical")
    category: Optional[str] = Field(None, max_length=50, description="Task category")
    due_date: Optional[str] = Field(None, description="Due date ISO string")
    estimated_minutes: Optional[int] = Field(None, ge=1, description="Estimated time in minutes")
    tags: Optional[List[str]] = Field(default_factory=list)
    assigned_agent: Optional[str] = Field(None, description="Agent to assign the task to")
    parent_task_id: Optional[str] = Field(None, description="Parent task ID for subtasks")


class TaskUpdateRequest(BaseModel):
    """Request to update an existing task."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[str] = Field(None, description="Status: pending, in_progress, completed, failed, cancelled")
    priority: Optional[str] = Field(None, description="Priority: low, medium, high, critical")
    category: Optional[str] = Field(None, max_length=50)
    due_date: Optional[str] = Field(None, description="Due date ISO string")
    estimated_minutes: Optional[int] = Field(None, ge=1)
    actual_minutes: Optional[int] = Field(None, ge=0)
    tags: Optional[List[str]] = None
    result: Optional[Dict[str, Any]] = None


class TaskOut(BaseModel):
    """Task output model."""
    id: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    category: Optional[str] = None
    assigned_agent: Optional[str] = None
    due_date: Optional[str] = None
    completed_at: Optional[str] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    tags: List[str] = []
    parent_task_id: Optional[str] = None
    created_at: str
    updated_at: str


class TaskDeleteResponse(BaseModel):
    """Response after deleting a task."""
    success: bool
    task_id: str
    message: str


class KanbanColumn(BaseModel):
    """A single kanban column."""
    status: str
    label: str
    tasks: List[TaskOut] = []
    count: int = 0


class KanbanBoardResponse(BaseModel):
    """Kanban board view of tasks."""
    columns: List[KanbanColumn]
    total_tasks: int
    timestamp: str


class ProductivityResponse(BaseModel):
    """Productivity analytics."""
    total_tasks: int = 0
    completed_tasks: int = 0
    pending_tasks: int = 0
    in_progress_tasks: int = 0
    overdue_tasks: int = 0
    completion_rate: float = 0.0
    avg_completion_minutes: float = 0.0
    tasks_by_priority: Dict[str, int] = {}
    tasks_by_category: Dict[str, int] = {}
    recent_completed: List[TaskOut] = []
    timestamp: str


# ============================================================
# Helpers
# ============================================================

def _task_to_out(task) -> TaskOut:
    """Convert a Task ORM object to TaskOut."""
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        category=task.category,
        assigned_agent=task.assigned_agent,
        due_date=task.due_date.isoformat() if task.due_date else None,
        completed_at=task.completed_at.isoformat() if task.completed_at else None,
        estimated_minutes=task.estimated_minutes,
        actual_minutes=task.actual_minutes,
        tags=task.tags if isinstance(task.tags, list) else [],
        parent_task_id=task.parent_task_id,
        created_at=task.created_at.isoformat() if task.created_at else "",
        updated_at=task.updated_at.isoformat() if task.updated_at else "",
    )


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


@router.post(
    "",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task",
)
async def create_task(
    request: TaskCreateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Create a new task with optional assignment and scheduling."""
    try:
        repo = TaskRepository(db)

        due = datetime.fromisoformat(request.due_date) if request.due_date else None

        task = await repo.create_task(
            user_id=user_id,
            title=request.title,
            description=request.description,
            priority=request.priority,
            category=request.category,
            due_date=due,
            estimated_minutes=request.estimated_minutes,
            tags=request.tags,
            assigned_agent=request.assigned_agent,
            parent_task_id=request.parent_task_id,
        )

        return _task_to_out(task)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating task: {str(e)}",
        )


@router.get(
    "",
    response_model=List[TaskOut],
    summary="List tasks",
)
async def list_tasks(
    task_status: Optional[str] = Query(None, alias="status", description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    limit: int = Query(100, ge=1, le=500, description="Maximum tasks"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """List tasks with optional filtering by status and priority."""
    try:
        repo = TaskRepository(db)
        tasks = await repo.get_user_tasks(
            user_id=user_id,
            status=task_status,
            priority=priority,
            limit=limit,
        )
        return [_task_to_out(t) for t in tasks]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing tasks: {str(e)}",
        )


@router.put(
    "/{task_id}",
    response_model=TaskOut,
    summary="Update a task",
)
async def update_task(
    task_id: str,
    request: TaskUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Update task fields. Only provided fields will be changed."""
    try:
        repo = TaskRepository(db)
        task = await repo.get_task(task_id)

        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task '{task_id}' not found",
            )

        # Apply updates
        if request.title is not None:
            task.title = request.title
        if request.description is not None:
            task.description = request.description
        if request.priority is not None:
            task.priority = request.priority
        if request.category is not None:
            task.category = request.category
        if request.estimated_minutes is not None:
            task.estimated_minutes = request.estimated_minutes
        if request.actual_minutes is not None:
            task.actual_minutes = request.actual_minutes
        if request.tags is not None:
            task.tags = request.tags
        if request.result is not None:
            task.result = request.result
        if request.due_date is not None:
            task.due_date = datetime.fromisoformat(request.due_date)

        # Handle status change
        if request.status is not None:
            await repo.update_task_status(task_id, request.status, request.result)
            task = await repo.get_task(task_id)
        else:
            task.updated_at = datetime.utcnow()
            await db.flush()

        return _task_to_out(task)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating task: {str(e)}",
        )


@router.delete(
    "/{task_id}",
    response_model=TaskDeleteResponse,
    summary="Delete a task",
)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Delete a task by ID."""
    try:
        repo = TaskRepository(db)
        task = await repo.get_task(task_id)

        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task '{task_id}' not found",
            )

        from database.models import Task
        deleted = await repo._delete(Task, task_id)

        return TaskDeleteResponse(
            success=deleted,
            task_id=task_id,
            message="Task deleted successfully" if deleted else "Failed to delete task",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting task: {str(e)}",
        )


@router.get(
    "/kanban",
    response_model=KanbanBoardResponse,
    summary="Get kanban board view",
)
async def get_kanban_board(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get all tasks organized in a kanban board layout."""
    try:
        repo = TaskRepository(db)
        all_tasks = await repo.get_user_tasks(user_id=user_id, limit=500)

        # Define columns
        column_defs = [
            (TaskStatus.PENDING.value, "To Do"),
            (TaskStatus.IN_PROGRESS.value, "In Progress"),
            (TaskStatus.COMPLETED.value, "Done"),
            (TaskStatus.FAILED.value, "Failed"),
            (TaskStatus.CANCELLED.value, "Cancelled"),
        ]

        columns: List[KanbanColumn] = []
        for status_val, label in column_defs:
            column_tasks = [t for t in all_tasks if t.status == status_val]
            columns.append(KanbanColumn(
                status=status_val,
                label=label,
                tasks=[_task_to_out(t) for t in column_tasks],
                count=len(column_tasks),
            ))

        return KanbanBoardResponse(
            columns=columns,
            total_tasks=len(all_tasks),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error building kanban board: {str(e)}",
        )


@router.get(
    "/productivity",
    response_model=ProductivityResponse,
    summary="Get productivity analytics",
)
async def get_productivity(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get task completion and productivity analytics."""
    try:
        repo = TaskRepository(db)
        all_tasks = await repo.get_user_tasks(user_id=user_id, limit=1000)
        overdue = await repo.get_overdue_tasks(user_id=user_id)

        completed = [t for t in all_tasks if t.status == TaskStatus.COMPLETED.value]
        pending = [t for t in all_tasks if t.status == TaskStatus.PENDING.value]
        in_progress = [t for t in all_tasks if t.status == TaskStatus.IN_PROGRESS.value]

        # Completion rate
        rate = (len(completed) / len(all_tasks) * 100) if all_tasks else 0.0

        # Average completion time
        completion_times = [t.actual_minutes for t in completed if t.actual_minutes]
        avg_time = (sum(completion_times) / len(completion_times)) if completion_times else 0.0

        # By priority
        by_priority: Dict[str, int] = {}
        for t in all_tasks:
            by_priority[t.priority] = by_priority.get(t.priority, 0) + 1

        # By category
        by_category: Dict[str, int] = {}
        for t in all_tasks:
            cat = t.category or "uncategorized"
            by_category[cat] = by_category.get(cat, 0) + 1

        return ProductivityResponse(
            total_tasks=len(all_tasks),
            completed_tasks=len(completed),
            pending_tasks=len(pending),
            in_progress_tasks=len(in_progress),
            overdue_tasks=len(overdue),
            completion_rate=round(rate, 1),
            avg_completion_minutes=round(avg_time, 1),
            tasks_by_priority=by_priority,
            tasks_by_category=by_category,
            recent_completed=[_task_to_out(t) for t in completed[:10]],
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error computing productivity: {str(e)}",
        )
