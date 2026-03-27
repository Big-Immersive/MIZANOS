"""Service for aggregating project report data."""

import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.audit import RepoScanHistory, RepositoryAnalysis
from apps.api.models.product import Product, ProductEnvironment, ProductLink, ProductMember
from apps.api.models.task import Task
from packages.common.utils.error_handlers import not_found

logger = logging.getLogger(__name__)

COMPLETED_STATUSES = {"done", "completed", "verified", "live", "fixed"}
IN_PROGRESS_STATUSES = {"in_progress", "in_review", "review"}

# In-memory cache for GitHub commit data (refreshes every 5 minutes)
_commit_cache: dict[str, tuple[dict, dict, float]] = {}
CACHE_TTL_SECONDS = 300


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
        commit_counts, recent_commit_counts = await self._fetch_all_commit_data(product_ids)
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
        commit_counts, recent_commit_counts = await self._fetch_all_commit_data([product_id])
        env_urls = await self._fetch_environment_urls([product_id])
        briefs = self._build_briefs(
            [product], members_map, task_counts, commit_counts,
            recent_commit_counts, env_urls,
        )
        base = briefs[0] if briefs else {}

        task_metrics = await self._build_task_metrics(product_id, task_counts)
        scan_metrics = await self._build_scan_metrics(product_id)
        github_metrics = await self._build_github_metrics(product_id)
        task_details = await self._fetch_task_details_for_ai(product_id)

        return {**base, "task_metrics": task_metrics, "feature_metrics": scan_metrics,
                "github_metrics": github_metrics, "task_details": task_details,
                "ai_analysis": None}

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

    async def _fetch_all_commit_data(self, product_ids: list[UUID]) -> tuple[dict, dict]:
        """Fetch total + today's commit counts in one parallel batch (cached 5min)."""
        import time
        cache_key = "all"
        if cache_key in _commit_cache:
            cached_commits, cached_recent, cached_at = _commit_cache[cache_key]
            if time.time() - cached_at < CACHE_TTL_SECONDS:
                return cached_commits, cached_recent
        scan_stmt = (
            select(
                RepoScanHistory.product_id,
                func.count(RepoScanHistory.id),
                func.max(RepoScanHistory.created_at),
            )
            .where(RepoScanHistory.product_id.in_(product_ids))
            .group_by(RepoScanHistory.product_id)
        )
        scan_result = await self.session.execute(scan_stmt)
        scan_map = {pid: {"db_total": total, "last_scan_at": last} for pid, total, last in scan_result.all()}

        prod_stmt = (
            select(Product.id, Product.repository_url, Product.tracked_branch, Product.github_pat_id)
            .where(Product.id.in_(product_ids), Product.repository_url.isnot(None))
        )
        prod_result = await self.session.execute(prod_stmt)
        products_with_repos = prod_result.all()

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

        # Build all tasks: total + recent for each product in one batch
        async with httpx.AsyncClient() as client:
            total_tasks = [
                self._fetch_github_commit_count(repo_url, branch, pat_id, client=client)
                for _, repo_url, branch, pat_id in products_with_repos
            ]
            recent_tasks = [
                self._fetch_github_commit_count(repo_url, branch, pat_id, since=today_start, client=client)
                for _, repo_url, branch, pat_id in products_with_repos
            ]
            all_results = await asyncio.gather(*total_tasks, *recent_tasks)

        n = len(products_with_repos)
        total_results = all_results[:n]
        recent_results = all_results[n:]

        commit_counts: dict[UUID, dict] = {}
        for (pid, _, _, _), github_total in zip(products_with_repos, total_results):
            db_info = scan_map.get(pid, {"db_total": 0, "last_scan_at": None})
            total = github_total if github_total > 0 else db_info["db_total"]
            commit_counts[pid] = {"total": total, "last_scan_at": db_info["last_scan_at"]}

        for pid in product_ids:
            if pid not in commit_counts and pid in scan_map:
                commit_counts[pid] = {"total": scan_map[pid]["db_total"], "last_scan_at": scan_map[pid]["last_scan_at"]}

        recent_counts = {pid: count for (pid, _, _, _), count in zip(products_with_repos, recent_results)}

        import time
        _commit_cache["all"] = (commit_counts, recent_counts, time.time())
        return commit_counts, recent_counts

    async def _fetch_github_commit_count(
        self, repo_url: str, branch: str | None, pat_id: UUID | None,
        since: datetime | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> int:
        """Fetch commit count from GitHub API for a repo/branch."""
        from apps.api.config import settings

        owner_repo = self._parse_owner_repo(repo_url)
        if not owner_repo:
            return 0

        owner, repo = owner_repo
        token = settings.github_api_token or None
        if not token:
            token = await self._resolve_pat_token(pat_id) if pat_id else None
        if not token:
            return 0
        headers: dict[str, str] = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
        }

        params: dict[str, str] = {"per_page": "1", "sha": branch or "main"}
        if since:
            params["since"] = since.isoformat()

        try:
            should_close = client is None
            c = client or httpx.AsyncClient()
            try:
                resp = await c.get(
                    f"https://api.github.com/repos/{owner}/{repo}/commits",
                    headers=headers, params=params, timeout=15,
                )
                if resp.status_code != 200:
                    return 0
                link = resp.headers.get("link", "")
                if 'rel="last"' in link:
                    match = re.search(r"page=(\d+)>; rel=\"last\"", link)
                    return int(match.group(1)) if match else 1
                return len(resp.json())
            finally:
                if should_close:
                    await c.aclose()
        except Exception:
            logger.warning("Failed to fetch commits for %s/%s", owner, repo, exc_info=True)
            return 0

    async def _resolve_pat_token(self, pat_id: UUID) -> str | None:
        """Decrypt a stored PAT token."""
        try:
            from apps.api.services.github_pat_service import GitHubPatService
            return await GitHubPatService(self.session).decrypt_token(pat_id)
        except Exception:
            return None

    @staticmethod
    def _parse_owner_repo(url: str) -> tuple[str, str] | None:
        m = re.match(r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", url)
        return (m.group(1), m.group(2)) if m else None

    async def get_recent_commits(self, product_id: UUID) -> list[dict]:
        """Fetch recent commit details from GitHub for a product."""
        from apps.api.config import settings

        stmt = select(Product.repository_url, Product.tracked_branch, Product.github_pat_id).where(Product.id == product_id)
        result = await self.session.execute(stmt)
        row = result.one_or_none()
        if not row or not row.repository_url:
            return []

        owner_repo = self._parse_owner_repo(row.repository_url)
        if not owner_repo:
            return []
        owner, repo = owner_repo

        token = settings.github_api_token or None
        if not token:
            token = await self._resolve_pat_token(row.github_pat_id) if row.github_pat_id else None
        if not token:
            return []

        headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}"}
        params = {"per_page": "10", "sha": row.tracked_branch or "main"}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/commits",
                    headers=headers, params=params, timeout=15,
                )
                if resp.status_code != 200:
                    return []
                commits = []
                for c in resp.json()[:10]:
                    commit_data = c.get("commit", {})
                    author = commit_data.get("author", {})
                    commits.append({
                        "sha": (c.get("sha") or "")[:7],
                        "message": (commit_data.get("message") or "").split("\n")[0],
                        "author": author.get("name", ""),
                        "date": author.get("date", ""),
                        "url": c.get("html_url", ""),
                    })
                return commits
        except Exception:
            logger.warning("Failed to fetch recent commits for product %s", product_id)
            return []

    async def _fetch_task_details_for_ai(self, product_id: UUID) -> list[dict]:
        """Fetch individual task details for AI analysis prompt."""
        from apps.api.models.user import Profile

        stmt = (
            select(
                Task.title, Task.status, Task.priority,
                Task.due_date, Task.assignee_id, Task.pillar,
                Profile.full_name.label("assignee_name"),
            )
            .outerjoin(Profile, Task.assignee_id == Profile.id)
            .where(
                Task.product_id == product_id,
                Task.task_type == "task",
                Task.is_draft == False,  # noqa: E712
            )
            .order_by(Task.priority.desc(), Task.status)
        )
        result = await self.session.execute(stmt)
        now = datetime.now(timezone.utc)
        tasks = []
        for row in result.all():
            is_overdue = (
                row.due_date is not None
                and row.due_date < now
                and (row.status or "").lower() not in COMPLETED_STATUSES
            )
            tasks.append({
                "title": row.title,
                "status": row.status or "unknown",
                "priority": row.priority or "none",
                "assignee_name": row.assignee_name or "Unassigned",
                "due_date": row.due_date.isoformat() if row.due_date else None,
                "is_overdue": is_overdue,
                "pillar": row.pillar,
            })
        return tasks

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

    async def get_tasks_for_report(self, product_ids: list[UUID]) -> dict[UUID, dict]:
        """Return per-project task summary + non-done task list + links for reports."""
        task_counts = await self._fetch_task_counts(product_ids)
        links_map = await self._fetch_project_links(product_ids)
        result: dict[UUID, dict] = {}

        for pid in product_ids:
            tc = task_counts.get(pid, {})
            total = sum(tc.values())
            done = sum(tc.get(s, 0) for s in COMPLETED_STATUSES)
            in_progress = sum(tc.get(s, 0) for s in IN_PROGRESS_STATUSES)
            backlog = total - done - in_progress

            summary = f"Tasks: {total} total | {done} Done | {in_progress} In Progress | {backlog} Backlog"

            all_tasks = await self._fetch_task_details_for_ai(pid)
            non_done = [
                t for t in all_tasks
                if (t.get("status") or "").lower() not in COMPLETED_STATUSES
            ]

            result[pid] = {
                "summary_line": summary,
                "non_done_tasks": non_done,
                "links": links_map.get(pid, []),
            }

        return result

    async def _fetch_project_links(self, product_ids: list[UUID]) -> dict[UUID, list[dict]]:
        """Return {product_id: [{name, url}, ...]} from product_links table."""
        stmt = (
            select(ProductLink)
            .where(ProductLink.product_id.in_(product_ids))
            .order_by(ProductLink.created_at)
        )
        result = await self.session.execute(stmt)
        links_map: dict[UUID, list[dict]] = {}
        for link in result.scalars().all():
            links_map.setdefault(link.product_id, []).append({"name": link.name, "url": link.url})
        return links_map

    @staticmethod
    def _empty_summary() -> dict:
        return {
            "total_projects": 0, "overall_task_completion_pct": 0.0,
            "total_tasks": 0, "tasks_completed": 0, "tasks_in_progress": 0,
            "total_commits": 0, "projects": [],
        }


def _pct(part: int, total: int) -> float:
    return round((part / total) * 100, 1) if total else 0.0
