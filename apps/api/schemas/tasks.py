"""Task schemas."""

from datetime import datetime
from uuid import UUID

from apps.api.schemas.base import BaseSchema, PaginatedResponse


class TaskBase(BaseSchema):
    """Shared task fields."""

    title: str
    description: str | None = None
    status: str = "backlog"
    priority: str = "medium"
    pillar: str | None = None
    due_date: datetime | None = None
    estimated_hours: float | None = None
    sort_order: int | None = 0
    generation_source: str | None = None
    claude_code_prompt: str | None = None
    verification_criteria: str | None = None
    domain_group: str | None = None
    phase: str | None = None
    task_type: str = "task"
    parent_id: UUID | None = None
    is_draft: bool = False


class TaskCreate(TaskBase):
    """Task creation schema."""

    product_id: UUID
    assignee_id: UUID | None = None
    milestone_id: UUID | None = None


class TaskUpdate(BaseSchema):
    """Task update schema."""

    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    pillar: str | None = None
    assignee_id: UUID | None = None
    due_date: datetime | None = None
    estimated_hours: float | None = None
    sort_order: int | None = None
    generation_source: str | None = None
    claude_code_prompt: str | None = None
    verification_criteria: str | None = None
    domain_group: str | None = None
    phase: str | None = None
    task_type: str | None = None
    is_draft: bool | None = None
    approved_by: UUID | None = None
    approved_at: datetime | None = None


class TaskResponse(TaskBase):
    """Task response."""

    id: UUID
    product_id: UUID
    assignee_id: UUID | None = None
    created_by: UUID | None = None
    milestone_id: UUID | None = None
    task_type: str = "task"
    parent_id: UUID | None = None
    subtask_count: int = 0
    is_draft: bool
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    comment_count: int = 0
    reply_count: int = 0
    created_at: datetime
    updated_at: datetime


class TaskListResponse(PaginatedResponse):
    """Paginated task list."""

    data: list[TaskResponse]


class TaskBulkApproveRequest(BaseSchema):
    """Request to bulk approve/reject tasks."""

    task_ids: list[UUID]


class TaskBulkApproveResponse(BaseSchema):
    """Response from bulk approve."""

    approved_count: int
    task_ids: list[UUID]


class TaskBulkAssignRequest(BaseSchema):
    """Request to bulk assign/unassign tasks."""

    task_ids: list[UUID]
    assignee_id: UUID | None = None


class TaskBulkAssignResponse(BaseSchema):
    """Response from bulk assign."""

    assigned_count: int
    task_ids: list[UUID]


class TaskBulkUpdateRequest(BaseSchema):
    """Request to bulk update tasks."""

    task_ids: list[UUID]
    assignee_id: UUID | None = None
    due_date: datetime | None = None
    priority: str | None = None
    status: str | None = None
    pillar: str | None = None


class TaskBulkUpdateResponse(BaseSchema):
    """Response from bulk update."""

    updated_count: int
    task_ids: list[UUID]


class TaskRejectResponse(BaseSchema):
    """Response from reject/cancel action."""

    action: str
    task_id: UUID


class TaskBulkRejectResponse(BaseSchema):
    """Response from bulk reject/cancel."""

    results: list[TaskRejectResponse]
