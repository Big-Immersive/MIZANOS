"""Tasks router."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.models.enums import AppRole
from apps.api.schemas.tasks import (
    TaskBulkApproveRequest,
    TaskBulkApproveResponse,
    TaskBulkAssignRequest,
    TaskBulkAssignResponse,
    TaskBulkRejectResponse,
    TaskBulkUpdateRequest,
    TaskBulkUpdateResponse,
    TaskCreate,
    TaskListResponse,
    TaskRejectResponse,
    TaskResponse,
    TaskUpdate,
)
from apps.api.services.task_service import TaskService
from apps.api.services.task_notification_service import TaskNotificationService

router = APIRouter()


def get_service(db: DbSession) -> TaskService:
    return TaskService(db)


def get_notif_service(db: DbSession) -> TaskNotificationService:
    return TaskNotificationService(db)


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    product_id: UUID | None = None,
    assignee_id: UUID | None = None,
    pm_id: UUID | None = None,
    member_id: UUID | None = None,
    status: str | None = None,
    priority: str | None = None,
    pillar: str | None = None,
    search: str | None = None,
    task_type: str = Query("task"),
    include_drafts: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """List tasks with filtering. Excludes drafts by default."""
    return await service.list_tasks(
        product_id=product_id, assignee_id=assignee_id, pm_id=pm_id,
        member_id=member_id,
        status=status, priority=priority, pillar=pillar, search=search,
        task_type=task_type,
        include_drafts=include_drafts, page=page, page_size=page_size,
    )


@router.get("/drafts", response_model=list[TaskResponse])
async def list_drafts(
    product_id: UUID,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """List draft tasks for a product."""
    return await service.list_drafts(product_id)


@router.delete("/drafts")
async def delete_all_drafts(
    product_id: UUID,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """Delete all draft tasks for a product. PM/superadmin only."""
    count = await service.delete_all_drafts(product_id)
    return {"deleted_count": count}


@router.post("/bulk-approve", response_model=TaskBulkApproveResponse)
async def bulk_approve_tasks(
    body: TaskBulkApproveRequest,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """Approve multiple draft tasks."""
    return await service.bulk_approve_tasks(body.task_ids, user.profile_id)


@router.post("/bulk-update", response_model=TaskBulkUpdateResponse)
async def bulk_update_tasks(
    body: TaskBulkUpdateRequest,
    db: DbSession = None,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """Bulk update tasks (assign, due date, priority)."""
    updates = body.model_dump(exclude_unset=True, exclude={"task_ids"})
    if not updates:
        from packages.common.utils.error_handlers import bad_request
        raise bad_request("At least one update field is required")
    result = await service.bulk_update_tasks(body.task_ids, updates, user)

    if "assignee_id" in updates and updates["assignee_id"]:
        notif_svc = get_notif_service(db)
        assigned_tasks = [await service.get_or_404(tid) for tid in body.task_ids]
        await notif_svc.notify_bulk_tasks_assigned(
            assigned_tasks, updates["assignee_id"]
        )

    return result


@router.post("/bulk-assign", response_model=TaskBulkAssignResponse)
async def bulk_assign_tasks(
    body: TaskBulkAssignRequest,
    db: DbSession = None,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """Bulk assign/unassign tasks to a team member."""
    result = await service.bulk_assign_tasks(body.task_ids, body.assignee_id, user)

    if body.assignee_id:
        notif_svc = get_notif_service(db)
        assigned_tasks = [await service.get_or_404(tid) for tid in body.task_ids]
        await notif_svc.notify_bulk_tasks_assigned(assigned_tasks, body.assignee_id)

    return result


@router.post("/bulk-reject", response_model=TaskBulkRejectResponse)
async def bulk_reject_tasks(
    body: TaskBulkApproveRequest,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """Reject/cancel multiple tasks. PM/superadmin only."""
    results = await service.bulk_reject_tasks(body.task_ids, user)
    return {"results": results}


@router.get("/{task_id}/subtasks", response_model=list[TaskResponse])
async def list_subtasks(
    task_id: UUID,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """List subtasks for a parent task."""
    await service.get_or_404(task_id)
    return await service.list_subtasks(task_id)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    return await service.get_or_404(task_id)


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    body: TaskCreate,
    user: CurrentUser,
    service: TaskService = Depends(get_service),
):
    return await service.create_task(body, user)


@router.post("/{task_id}/approve", response_model=TaskResponse)
async def approve_task(
    task_id: UUID,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """Approve a single draft task."""
    return await service.approve_task(task_id, user.profile_id)


@router.delete("/{task_id}/reject", response_model=TaskRejectResponse)
async def reject_task(
    task_id: UUID,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """Hard-delete a draft task. PM/superadmin only."""
    return await service.reject_task(task_id, user)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    body: TaskUpdate,
    db: DbSession = None,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    update_data = body.model_dump(exclude_unset=True)
    old_task = await service.get_or_404(task_id) if "assignee_id" in update_data else None
    old_assignee = str(old_task.assignee_id) if old_task and old_task.assignee_id else None

    result = await service.update(
        task_id,
        update_data,
        user=user,
        user_id=user.profile_id,
        is_superadmin=user.has_role(AppRole.SUPERADMIN),
    )

    new_assignee = str(update_data["assignee_id"]) if "assignee_id" in update_data and update_data["assignee_id"] else None
    if new_assignee and new_assignee != old_assignee:
        notif_svc = get_notif_service(db)
        await notif_svc.notify_task_assigned(result, UUID(new_assignee))

    return result


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: UUID,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """Hard-delete a task with authorization checks."""
    await service.delete_task(task_id, user)


@router.patch("/{task_id}/reorder")
async def reorder_task(
    task_id: UUID,
    sort_order: int,
    user: CurrentUser = None,
    service: TaskService = Depends(get_service),
):
    """Update task sort order for kanban drag-drop."""
    return await service.update(
        task_id,
        {"sort_order": sort_order},
        user_id=user.profile_id,
        is_superadmin=user.has_role(AppRole.SUPERADMIN),
    )
