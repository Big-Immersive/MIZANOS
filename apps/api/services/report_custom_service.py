"""Custom report service — generate reports filtered by task statuses."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.task import Task
from apps.api.services.report_service import ReportService, COMPLETED_STATUSES

logger = logging.getLogger(__name__)

# Map user-facing status values to possible DB values
STATUS_MAP: dict[str, set[str]] = {
    "backlog": {"backlog"},
    "in_progress": {"in_progress"},
    "review": {"in_review", "review"},
    "done": {"done", "completed", "verified", "fixed"},
    "live": {"live"},
    "cancelled": {"cancelled"},
}

BUG_STATUS_ORDER = [
    "reported", "triaging", "in_progress", "reopened",
    "fixed", "verified", "wont_fix", "live",
]


class ReportCustomService:
    """Build report data filtered by user-selected task statuses."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_custom_report_data(
        self,
        product_ids: list[UUID],
        task_statuses: list[str],
        include_bugs: bool = False,
    ) -> dict[UUID, dict]:
        svc = ReportService(self.session)
        task_counts = await svc._fetch_task_counts(product_ids)
        links_map = await svc._fetch_project_links(product_ids)
        code_progress = await svc._fetch_code_progress_batch(product_ids)
        members_map = await svc._fetch_members_map(product_ids)

        # Expand user statuses to DB values
        db_statuses: set[str] = set()
        for s in task_statuses:
            db_statuses.update(STATUS_MAP.get(s, {s}))

        result: dict[UUID, dict] = {}

        for pid in product_ids:
            tasks_data = await self._fetch_tasks_by_statuses(pid, db_statuses, members_map.get(pid, {}))
            milestones = tasks_data["milestones"]

            # Append bugs if requested
            if include_bugs:
                bug_groups = await self._fetch_all_bugs(pid)
                for status_name, bugs in bug_groups.items():
                    milestones[f"Bugs — {status_name.replace('_', ' ').title()}"] = bugs

            # Build summary with total + breakdown
            tc = task_counts.get(pid, {})
            total = sum(tc.values())
            done = sum(tc.get(s, 0) for s in COMPLETED_STATUSES)
            in_prog = sum(tc.get(s, 0) for s in {"in_progress", "in_review", "review"})
            backlog = total - done - in_prog
            filtered_count = sum(len(t) for k, t in milestones.items() if not k.startswith("Bugs"))
            bug_count = sum(len(t) for k, t in milestones.items() if k.startswith("Bugs"))
            cp = code_progress.get(pid, 0.0)

            summary = f"Tasks: {total} total | {done} Done | {in_prog} In Progress | {backlog} Backlog"
            if include_bugs:
                summary += f" | Bugs: {bug_count}"
            summary += f" | Code Progress: {cp}%"

            result[pid] = {
                "summary_line": summary,
                "milestones": milestones,
                "has_multiple_assignees": tasks_data.get("has_multiple_assignees", False),
                "links": links_map.get(pid, []),
                "code_progress": cp,
            }

        return result

    async def _fetch_tasks_by_statuses(
        self, product_id: UUID, db_statuses: set[str], members_info: dict,
    ) -> dict:
        from apps.api.models.milestone import Milestone
        from apps.api.models.user import Profile

        stmt = (
            select(
                Task.title, Task.status, Task.priority,
                Task.due_date, Task.updated_at, Task.assignee_id,
                Task.milestone_id,
                Profile.full_name.label("assignee_name"),
                Milestone.title.label("milestone_name"),
                Milestone.sort_order.label("milestone_order"),
            )
            .outerjoin(Profile, Task.assignee_id == Profile.id)
            .outerjoin(Milestone, Task.milestone_id == Milestone.id)
            .where(
                Task.product_id == product_id,
                Task.task_type == "task",
                Task.is_draft == False,  # noqa: E712
                Task.status.in_(db_statuses),
            )
            .order_by(Milestone.sort_order.nulls_last(), Task.status, Task.priority.desc())
        )
        rows = (await self.session.execute(stmt)).all()

        milestones: dict[str, list[dict]] = {}
        milestone_order: dict[str, int] = {}
        assignee_ids: set[str] = set()

        for row in rows:
            if row.assignee_id:
                assignee_ids.add(str(row.assignee_id))
            milestone_name = row.milestone_name or "General"
            tag = (row.status or "unknown").upper().replace("_", " ")

            task_data = {
                "title": row.title,
                "status": row.status or "unknown",
                "priority": row.priority or "none",
                "assignee_name": row.assignee_name or "Unassigned",
                "due_date": row.due_date.isoformat() if row.due_date else None,
                "is_overdue": False,
                "tag": tag,
            }
            if milestone_name not in milestones:
                milestones[milestone_name] = []
                milestone_order[milestone_name] = row.milestone_order if row.milestone_order is not None else 9999
            milestones[milestone_name].append(task_data)

        has_multiple_devs = len(members_info.get("dev_names", [])) > 1
        has_multiple_assignees = len(assignee_ids) > 1
        show_assignee = has_multiple_devs or has_multiple_assignees
        for tasks in milestones.values():
            for t in tasks:
                t["show_assignee"] = show_assignee

        sorted_keys = sorted(milestones.keys(), key=lambda m: (m == "General", milestone_order.get(m, 9999)))
        return {
            "milestones": {m: milestones[m] for m in sorted_keys},
            "has_multiple_assignees": has_multiple_assignees,
        }

    async def _fetch_all_bugs(self, product_id: UUID) -> dict[str, list[dict]]:
        from apps.api.models.user import Profile

        stmt = (
            select(Task.title, Task.status, Task.priority, Task.due_date, Task.assignee_id,
                   Profile.full_name.label("assignee_name"))
            .outerjoin(Profile, Task.assignee_id == Profile.id)
            .where(Task.product_id == product_id, Task.task_type == "bug", Task.is_draft == False)  # noqa: E712
            .order_by(Task.status, Task.priority.desc())
        )
        rows = (await self.session.execute(stmt)).all()

        groups: dict[str, list[dict]] = {}
        for row in rows:
            status = (row.status or "reported").lower()
            bug = {
                "title": row.title, "status": status,
                "priority": row.priority or "none",
                "assignee_name": row.assignee_name or "Unassigned",
                "due_date": row.due_date.isoformat() if row.due_date else None,
                "tag": status.upper().replace("_", " "),
                "show_assignee": True,
            }
            groups.setdefault(status, []).append(bug)

        # Sort by defined order
        ordered: dict[str, list[dict]] = {}
        for s in BUG_STATUS_ORDER:
            if s in groups:
                ordered[s] = groups.pop(s)
        ordered.update(groups)
        return ordered
