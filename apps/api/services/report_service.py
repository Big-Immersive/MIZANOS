"""Service for aggregating project report data."""

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.audit import RepoScanHistory, RepositoryAnalysis
from apps.api.models.product import Product, ProductEnvironment, ProductMember
from apps.api.models.task import Task
from packages.common.utils.error_handlers import not_found

logger = logging.getLogger(__name__)

COMPLETED_STATUSES = {"done", "completed", "verified", "live", "fixed"}
IN_PROGRESS_STATUSES = {"in_progress", "in_review", "review"}


class ReportService:
    """Aggregate report data from products, tasks, members, and GitHub."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_summary(self) -> dict:
        """Return aggregated report across all non-archived projects."""
        products = await self._fetch_products()
        product_ids = [p.id for p in products]
        if not product_ids:
            return self._empty_summary()

        members_map = await self._fetch_members_map(product_ids)
        task_counts = await self._fetch_task_counts(product_ids)
        commit_counts = await self._fetch_commit_counts(product_ids)
        recent_commit_counts = await self._fetch_recent_commit_counts(product_ids)
        env_urls = await self._fetch_environment_urls(product_ids)

        briefs = self._build_briefs(
            products, members_map, task_counts, commit_counts,
            recent_commit_counts, env_urls,
        )

        total_tasks = sum(b["total_tasks"] for b in briefs)
        tasks_completed = sum(b["completed_tasks"] for b in briefs)
        tasks_in_progress = sum(b["in_progress_tasks"] for b in briefs)
        total_commits = sum(b["total_commits"] for b in briefs)

        return {
            "total_projects": len(briefs),
            "overall_task_completion_pct": _pct(tasks_completed, total_tasks),
            "total_tasks": total_tasks,
            "tasks_completed": tasks_completed,
            "tasks_in_progress": tasks_in_progress,
            "total_commits": total_commits,
            "projects": briefs,
        }

    async def get_project_report(self, product_id: UUID) -> dict:
        """Return detailed report for a single project."""
        product = await self._fetch_product(product_id)
        members_map = await self._fetch_members_map([product_id])
        task_counts = await self._fetch_task_counts([product_id])
        commit_counts = await self._fetch_commit_counts([product_id])

        recent_commit_counts = await self._fetch_recent_commit_counts([product_id])
        env_urls = await self._fetch_environment_urls([product_id])
        briefs = self._build_briefs(
            [product], members_map, task_counts, commit_counts,
            recent_commit_counts, env_urls,
        )
        base = briefs[0] if briefs else {}

        task_metrics = await self._build_task_metrics(product_id, task_counts)
        scan_metrics = await self._build_scan_metrics(product_id)
        github_metrics = await self._build_github_metrics(product_id)

        return {**base, "task_metrics": task_metrics, "feature_metrics": scan_metrics,
                "github_metrics": github_metrics, "ai_analysis": None}

    # ------------------------------------------------------------------
    # Private: data fetching
    # ------------------------------------------------------------------

    async def _fetch_products(self) -> list:
        stmt = select(Product).where(Product.archived_at.is_(None)).order_by(Product.name)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _fetch_product(self, product_id: UUID) -> Product:
        stmt = select(Product).where(Product.id == product_id)
        result = await self.session.execute(stmt)
        product = result.scalar_one_or_none()
        if not product:
            raise not_found("Product")
        return product

    async def _fetch_members_map(self, product_ids: list[UUID]) -> dict:
        """Return {product_id: {pm_name, dev_name}}."""
        stmt = (
            select(ProductMember)
            .where(
                ProductMember.product_id.in_(product_ids),
                ProductMember.role.in_(["project_manager", "ai_engineer"]),
            )
        )
        result = await self.session.execute(stmt)
        rows = result.scalars().all()

        members: dict[UUID, dict[str, str | None]] = {}
        for member in rows:
            entry = members.setdefault(member.product_id, {"pm_name": None, "dev_name": None})
            name = member.profile.full_name if member.profile else None
            if member.role == "project_manager":
                entry["pm_name"] = name
            elif member.role == "ai_engineer":
                entry["dev_name"] = name
        return members

    async def _fetch_task_counts(self, product_ids: list[UUID]) -> dict:
        """Return {product_id: {status: count}}."""
        stmt = (
            select(Task.product_id, Task.status, func.count(Task.id))
            .where(Task.product_id.in_(product_ids), Task.task_type == "task")
            .group_by(Task.product_id, Task.status)
        )
        result = await self.session.execute(stmt)
        counts: dict[UUID, dict[str, int]] = {}
        for pid, status, count in result.all():
            counts.setdefault(pid, {})[status or "unknown"] = count
        return counts

    async def _fetch_commit_counts(self, product_ids: list[UUID]) -> dict:
        """Return {product_id: {total, last_scan_at}}."""
        stmt = (
            select(
                RepoScanHistory.product_id,
                func.count(RepoScanHistory.id),
                func.max(RepoScanHistory.created_at),
            )
            .where(RepoScanHistory.product_id.in_(product_ids))
            .group_by(RepoScanHistory.product_id)
        )
        result = await self.session.execute(stmt)
        return {
            pid: {"total": total, "last_scan_at": last}
            for pid, total, last in result.all()
        }

    async def _fetch_recent_commit_counts(self, product_ids: list[UUID]) -> dict:
        """Return {product_id: count} for commits in the last 7 days."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        stmt = (
            select(
                RepoScanHistory.product_id,
                func.count(RepoScanHistory.id),
            )
            .where(
                RepoScanHistory.product_id.in_(product_ids),
                RepoScanHistory.created_at >= cutoff,
            )
            .group_by(RepoScanHistory.product_id)
        )
        result = await self.session.execute(stmt)
        return {pid: count for pid, count in result.all()}

    async def _fetch_environment_urls(self, product_ids: list[UUID]) -> dict:
        """Return {product_id: {live_url, dashboard_url}}."""
        stmt = (
            select(ProductEnvironment)
            .where(
                ProductEnvironment.product_id.in_(product_ids),
                ProductEnvironment.url.isnot(None),
            )
        )
        result = await self.session.execute(stmt)
        rows = result.scalars().all()

        urls: dict[UUID, dict[str, str | None]] = {}
        for env in rows:
            entry = urls.setdefault(env.product_id, {"live_url": None, "dashboard_url": None})
            env_type = (env.environment_type or "").lower()
            if env_type == "production":
                entry["live_url"] = env.url
            elif env_type in ("development", "staging"):
                if not entry["dashboard_url"]:
                    entry["dashboard_url"] = env.url
        return urls

    # ------------------------------------------------------------------
    # Private: builders
    # ------------------------------------------------------------------

    def _build_briefs(
        self, products, members_map, task_counts, commit_counts,
        recent_commit_counts, env_urls,
    ) -> list[dict]:
        briefs = []
        for p in products:
            tc = task_counts.get(p.id, {})
            total = sum(tc.values())
            completed = sum(tc.get(s, 0) for s in COMPLETED_STATUSES)
            in_progress = sum(tc.get(s, 0) for s in IN_PROGRESS_STATUSES)
            cc = commit_counts.get(p.id, {})
            m = members_map.get(p.id, {})
            urls = env_urls.get(p.id, {})

            briefs.append({
                "product_id": p.id, "product_name": p.name,
                "stage": p.stage, "status": p.status, "created_at": p.created_at,
                "pm_name": m.get("pm_name"), "dev_name": m.get("dev_name"),
                "total_tasks": total, "completed_tasks": completed,
                "in_progress_tasks": in_progress,
                "task_completion_pct": _pct(completed, total),
                "has_repository": bool(p.repository_url),
                "total_commits": cc.get("total", 0),
                "recent_commits": recent_commit_counts.get(p.id, 0),
                "last_scan_at": cc.get("last_scan_at"),
                "live_url": urls.get("live_url"),
                "dashboard_url": urls.get("dashboard_url"),
            })
        return briefs

    async def _build_task_metrics(self, product_id: UUID, task_counts: dict) -> dict:
        tc = task_counts.get(product_id, {})
        total = sum(tc.values())
        completed = sum(tc.get(s, 0) for s in COMPLETED_STATUSES)

        priority_stmt = (
            select(Task.priority, func.count(Task.id))
            .where(Task.product_id == product_id, Task.task_type == "task")
            .group_by(Task.priority)
        )
        priority_result = await self.session.execute(priority_stmt)
        by_priority = {p or "none": c for p, c in priority_result.all()}

        overdue_stmt = (
            select(func.count(Task.id))
            .where(
                Task.product_id == product_id, Task.task_type == "task",
                Task.due_date < datetime.now(timezone.utc),
                Task.status.notin_(COMPLETED_STATUSES),
            )
        )
        overdue = (await self.session.execute(overdue_stmt)).scalar_one()

        return {
            "total": total, "by_status": tc, "by_priority": by_priority,
            "completion_pct": _pct(completed, total), "overdue_count": overdue,
        }

    async def _build_scan_metrics(self, product_id: UUID) -> dict:
        """Pull code progress scan data from the latest RepositoryAnalysis."""
        stmt = (
            select(RepositoryAnalysis.gap_analysis)
            .where(
                RepositoryAnalysis.product_id == product_id,
                RepositoryAnalysis.gap_analysis.isnot(None),
            )
            .order_by(RepositoryAnalysis.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        gap = result.scalar_one_or_none()

        if not gap or not isinstance(gap, dict):
            return {"total": 0, "by_status": {}, "completion_pct": 0.0}

        # gap_analysis stores scan_summary directly (not nested)
        verified = gap.get("verified", 0)
        partial = gap.get("partial", 0)
        no_evidence = gap.get("no_evidence", 0)
        total = gap.get("total_tasks", 0)
        pct = gap.get("progress_pct", 0.0)

        return {
            "total": total,
            "by_status": {"verified": verified, "partial": partial, "no_evidence": no_evidence},
            "completion_pct": pct,
        }

    async def _build_github_metrics(self, product_id: UUID) -> dict | None:
        stmt = (
            select(
                func.count(RepoScanHistory.id),
                func.sum(RepoScanHistory.files_changed),
                func.sum(RepoScanHistory.lines_added),
                func.sum(RepoScanHistory.lines_removed),
                func.max(RepoScanHistory.created_at),
            )
            .where(RepoScanHistory.product_id == product_id)
        )
        row = (await self.session.execute(stmt)).one()
        if not row[0]:
            return None

        latest_stmt = (
            select(RepoScanHistory.latest_commit_sha)
            .where(RepoScanHistory.product_id == product_id)
            .order_by(RepoScanHistory.created_at.desc())
            .limit(1)
        )
        sha = (await self.session.execute(latest_stmt)).scalar_one_or_none()

        return {
            "total_scans": row[0], "total_files_changed": row[1] or 0,
            "total_lines_added": row[2] or 0, "total_lines_removed": row[3] or 0,
            "latest_commit_sha": sha, "last_scan_at": row[4],
            "contributors_count": None,
        }

    @staticmethod
    def _empty_summary() -> dict:
        return {
            "total_projects": 0, "overall_task_completion_pct": 0.0,
            "total_tasks": 0, "tasks_completed": 0, "tasks_in_progress": 0,
            "total_commits": 0, "projects": [],
        }


def _pct(part: int, total: int) -> float:
    return round((part / total) * 100, 1) if total else 0.0
