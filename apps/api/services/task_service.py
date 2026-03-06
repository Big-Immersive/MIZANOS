"""Task service."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.dependencies import AuthenticatedUser
from apps.api.models.enums import AppRole
from apps.api.models.notification import Notification
from apps.api.models.product import Product, ProductMember
from apps.api.models.settings import OrgSetting
from apps.api.models.specification import SpecificationFeature
from apps.api.models.task import Task
from apps.api.models.task_comment import TaskComment
from apps.api.models.user import Profile
from apps.api.schemas.tasks import TaskCreate
from apps.api.services.base_service import BaseService
from packages.common.utils.error_handlers import bad_request, forbidden


class TaskService(BaseService[Task]):
    """Task-specific business logic."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Task, session)

    async def list_tasks(
        self,
        *,
        product_id: UUID | None = None,
        assignee_id: UUID | None = None,
        pm_id: UUID | None = None,
        member_id: UUID | None = None,
        status: str | None = None,
        priority: str | None = None,
        pillar: str | None = None,
        search: str | None = None,
        include_drafts: bool = False,
        task_type: str = "task",
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        """List tasks with optional filtering. Excludes drafts by default."""
        base = select(Task).where(Task.task_type == task_type)
        if task_type == "marketing_task":
            base = base.where(Task.parent_id.is_(None))
        if not include_drafts:
            base = base.where(Task.is_draft == False)  # noqa: E712
        if product_id:
            base = base.where(Task.product_id == product_id)
        if assignee_id:
            base = base.where(Task.assignee_id == assignee_id)
        if pm_id:
            base = base.join(
                ProductMember,
                (Task.product_id == ProductMember.product_id)
                & (ProductMember.profile_id == pm_id)
                & (ProductMember.role == "project_manager"),
            )
        if member_id:
            member_products = (
                select(ProductMember.product_id)
                .where(ProductMember.profile_id == member_id)
            )
            base = base.where(
                or_(
                    Task.assignee_id == member_id,
                    Task.product_id.in_(member_products),
                )
            )
        if status:
            base = base.where(Task.status == status)
        if priority:
            base = base.where(Task.priority == priority)
        if pillar:
            base = base.where(Task.pillar == pillar)
        if search:
            base = base.where(Task.title.ilike(f"%{search}%"))

        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.repo.session.execute(count_stmt)).scalar_one()
        comment_count_subq = (
            select(func.count(TaskComment.id))
            .where(TaskComment.task_id == Task.id, TaskComment.parent_id.is_(None))
            .correlate(Task)
            .scalar_subquery()
            .label("comment_count")
        )
        reply_count_subq = (
            select(func.count(TaskComment.id))
            .where(TaskComment.task_id == Task.id, TaskComment.parent_id.is_not(None))
            .correlate(Task)
            .scalar_subquery()
            .label("reply_count")
        )
        stmt = base.add_columns(comment_count_subq, reply_count_subq)
        stmt = stmt.order_by(Task.sort_order)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.repo.session.execute(stmt)
        rows = result.all()
        data = []
        for row in rows:
            task = row[0]
            task.comment_count = row[1] or 0
            task.reply_count = row[2] or 0
            data.append(task)

        return {"data": data, "total": total, "page": page, "page_size": page_size}

    async def list_subtasks(self, parent_id: UUID) -> list[Task]:
        """List subtasks for a parent task."""
        stmt = (
            select(Task)
            .where(Task.parent_id == parent_id)
            .order_by(Task.sort_order, Task.created_at)
        )
        result = await self.repo.session.execute(stmt)
        return list(result.scalars().all())

    async def list_drafts(self, product_id: UUID, task_type: str = "task") -> list[Task]:
        """List draft tasks for a product."""
        stmt = (
            select(Task)
            .where(
                Task.product_id == product_id,
                Task.is_draft == True,  # noqa: E712
                Task.task_type == task_type,
            )
            .order_by(Task.created_at.desc())
        )
        result = await self.repo.session.execute(stmt)
        return list(result.scalars().all())

    async def delete_all_drafts(self, product_id: UUID) -> int:
        """Delete all draft tasks for a product. Auto-unlocks. Returns count deleted."""
        drafts = await self.list_drafts(product_id)
        for task in drafts:
            await self._clear_task_references(task.id)
            await self.repo.delete(task)
        product = await self.repo.session.get(Product, product_id)
        if product and product.tasks_locked:
            product.tasks_locked = False
            await self.repo.session.flush()
        return len(drafts)

    async def _auto_unlock_if_empty(self, product_id: UUID) -> None:
        """Unlock tasks if no drafts remain after rejection."""
        remaining = await self.list_drafts(product_id)
        if len(remaining) == 0:
            product = await self.repo.session.get(Product, product_id)
            if product and product.tasks_locked:
                product.tasks_locked = False
                await self.repo.session.flush()

    async def approve_task(self, task_id: UUID, approver_id: UUID) -> Task:
        """Approve a draft task, making it a real assignable task."""
        task = await self.get_or_404(task_id)
        result = await self.repo.update(task, {
            "is_draft": False,
            "approved_by": approver_id,
            "approved_at": datetime.now(timezone.utc),
        })
        await self._auto_unlock_if_empty(task.product_id)
        return result

    async def bulk_approve_tasks(
        self, task_ids: list[UUID], approver_id: UUID
    ) -> dict:
        """Approve multiple draft tasks."""
        if not task_ids:
            return {"approved_count": 0, "task_ids": []}
        first = await self.get_or_404(task_ids[0])
        now = datetime.now(timezone.utc)
        product_id = first.product_id
        for tid in task_ids:
            task = await self.get_or_404(tid)
            await self.repo.update(task, {
                "is_draft": False, "approved_by": approver_id, "approved_at": now,
            })
        await self._auto_unlock_if_empty(product_id)
        return {"approved_count": len(task_ids), "task_ids": task_ids}

    async def reject_task(self, task_id: UUID, user: AuthenticatedUser) -> dict:
        """PM/superadmin hard-deletes a draft task."""
        task = await self.get_or_404(task_id)
        product_id = task.product_id
        if not self._can_manage_tasks(user):
            raise forbidden("Only superadmins and project managers can reject tasks")
        if not task.is_draft:
            raise bad_request("Only draft tasks can be rejected")
        await self._clear_task_references(task_id)
        await self.repo.delete(task)
        await self._auto_unlock_if_empty(product_id)
        return {"action": "deleted", "task_id": task_id}

    async def _clear_task_references(self, task_id: UUID) -> None:
        """Null out FK references to a task before deletion."""
        await self.repo.session.execute(
            update(SpecificationFeature)
            .where(SpecificationFeature.task_id == task_id)
            .values(task_id=None)
        )
        await self.repo.session.execute(
            update(Notification)
            .where(Notification.task_id == task_id)
            .values(task_id=None)
        )

    async def bulk_reject_tasks(
        self, task_ids: list[UUID], user: AuthenticatedUser
    ) -> list[dict]:
        """Hard-delete multiple draft tasks. PM/superadmin only."""
        return [await self.reject_task(tid, user) for tid in task_ids]

    async def bulk_assign_tasks(
        self, task_ids: list[UUID], assignee_id: UUID | None,
        user: AuthenticatedUser,
    ) -> dict:
        """Assign (or unassign) multiple tasks to a team member."""
        if not self._can_manage_tasks(user):
            raise forbidden("Only superadmins and project managers can assign tasks")
        if assignee_id:
            await self._validate_assignee(assignee_id)

        assigned = []
        for tid in task_ids:
            task = await self.get_or_404(tid)
            await self.repo.update(task, {"assignee_id": assignee_id})
            assigned.append(tid)
        return {"assigned_count": len(assigned), "task_ids": assigned}

    async def bulk_update_tasks(
        self, task_ids: list[UUID], updates: dict,
        user: AuthenticatedUser,
    ) -> dict:
        """Bulk update tasks with provided fields."""
        if not self._can_manage_tasks(user):
            raise forbidden("Only superadmins and project managers can bulk update tasks")
        if "assignee_id" in updates and updates["assignee_id"]:
            await self._validate_assignee(updates["assignee_id"])
        if "priority" in updates and updates["priority"] not in ("low", "medium", "high"):
            raise bad_request("Invalid priority value")
        updated = []
        for tid in task_ids:
            task = await self.get_or_404(tid)
            await self.repo.update(task, updates)
            updated.append(tid)
        return {"updated_count": len(updated), "task_ids": updated}

    async def create_task(self, data: TaskCreate, user: AuthenticatedUser) -> Task:
        """Create a new task or bug. Engineers are auto-assigned for tasks.
        Anyone can create bugs (no authorization gating).
        """
        task_data = data.model_dump()
        task_data["created_by"] = user.profile_id
        task_type = task_data.get("task_type", "task")
        is_bug = task_type == "bug"
        is_marketing = task_type == "marketing_task"
        if is_bug:
            task_data.setdefault("status", "reported")
        elif is_marketing:
            task_data.setdefault("status", "planned")
            if task_data.get("parent_id"):
                parent = await self.get_or_404(task_data["parent_id"])
                if parent.task_type != "marketing_task" or parent.parent_id is not None:
                    raise bad_request("Subtasks can only be added to top-level marketing tasks")
        elif not self._can_manage_tasks(user):
            task_data["assignee_id"] = user.profile_id
        if task_data.get("assignee_id"):
            await self._validate_assignee(task_data["assignee_id"])
        task = Task(**task_data)
        return await self.repo.create(task)

    async def update(
        self,
        entity_id: UUID,
        data: dict,
        *,
        user: AuthenticatedUser | None = None,
        user_id: UUID | None = None,
        is_superadmin: bool = False,
    ) -> Task:
        """Update a task with assignee validation and status/assignee auth."""
        if "assignee_id" in data and data["assignee_id"]:
            await self._validate_assignee(UUID(str(data["assignee_id"])))
        task = None
        if user is not None and not self._can_manage_tasks(user):
            task = await self.get_or_404(entity_id)
            is_creator = task.created_by is not None and task.created_by == user.profile_id
            allowed = {"status", "title", "description", "priority", "pillar", "due_date"} if is_creator else {"status"}
            restricted = set(data.keys()) - allowed
            if restricted:
                raise forbidden(
                    "Engineers can only update task status" if not is_creator
                    else "Engineers can only update details of their own tasks"
                )
        if "assignee_id" in data and user is not None and not self._can_manage_tasks(user):
            task = await self.get_or_404(entity_id)
            current_assignee = str(task.assignee_id) if task.assignee_id else None
            new_assignee = str(data["assignee_id"]) if data["assignee_id"] else None
            if current_assignee != new_assignee:
                if not await self._is_product_pm(task.product_id, user.profile_id):
                    raise forbidden("Only superadmins and project managers can reassign tasks")
        if "status" in data and data["status"] not in ("backlog", "cancelled"):
            if task is None:
                task = await self.get_or_404(entity_id)
            effective_assignee = (
                data["assignee_id"] if "assignee_id" in data else task.assignee_id
            )
            if not effective_assignee:
                raise bad_request(
                    "Cannot change status from Backlog — please assign this task first"
                )
        if "status" in data and user_id is not None and not is_superadmin:
            if task is None:
                task = await self.get_or_404(entity_id)
            if task.assignee_id is not None:
                await self._authorize_status_change(task, user_id)
        return await super().update(entity_id, data)

    # Statuses safe to delete without extra confirmation
    SAFE_DELETE_STATUSES = {"draft", "backlog", "cancelled"}

    async def delete_task(
        self, task_id: UUID, user: AuthenticatedUser,
    ) -> None:
        """Hard-delete a task. Clears FK references first.

        Any editor (PM/superadmin/creator) may delete draft/backlog/cancelled.
        Only PM/superadmin may delete tasks in other statuses.
        """
        task = await self.get_or_404(task_id)
        is_manager = self._can_manage_tasks(user)
        is_creator = (
            task.created_by is not None and task.created_by == user.profile_id
        )

        if not is_manager and not is_creator:
            raise forbidden("You do not have permission to delete this task")

        status = task.status or "backlog"
        if status not in self.SAFE_DELETE_STATUSES and not is_manager:
            raise forbidden(
                "Only superadmins and project managers can delete active tasks"
            )

        subtasks = await self.list_subtasks(task_id)
        for sub in subtasks:
            await self._clear_task_references(sub.id)
        await self._clear_task_references(task_id)
        await self.repo.delete(task)

    async def _authorize_status_change(
        self, task: Task, user_id: UUID
    ) -> None:
        """Only the assignee or product PM may change task status."""
        if task.assignee_id == user_id:
            return
        stmt = select(ProductMember).where(
            ProductMember.product_id == task.product_id,
            ProductMember.profile_id == user_id,
            ProductMember.role == "project_manager",
        )
        result = await self.repo.session.execute(stmt)
        if result.scalar_one_or_none() is not None:
            return
        raise forbidden(
            "Only the assignee or product PM can change task status"
        )

    def _can_manage_tasks(self, user: AuthenticatedUser) -> bool:
        """Superadmins and project managers can freely assign/reassign tasks."""
        return user.has_any_role(AppRole.SUPERADMIN, AppRole.PROJECT_MANAGER)

    async def _is_product_pm(self, product_id: UUID, profile_id: UUID) -> bool:
        """Check if user is a project manager on this specific product."""
        stmt = select(ProductMember.id).where(
            ProductMember.product_id == product_id,
            ProductMember.profile_id == profile_id,
            ProductMember.role == "project_manager",
        ).limit(1)
        result = await self.repo.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def _validate_assignee(self, assignee_id: UUID) -> None:
        """Reject assigning to pending profiles when org setting is off."""
        stmt = select(OrgSetting.value).where(
            OrgSetting.key == "show_pending_profiles_in_assignments"
        )
        result = await self.repo.session.execute(stmt)
        setting_value = result.scalar_one_or_none()

        if setting_value and setting_value.get("enabled"):
            return

        profile = await self.repo.session.get(Profile, assignee_id)
        if profile and profile.status == "pending":
            raise bad_request(
                "Cannot assign tasks to users with pending activation"
            )
