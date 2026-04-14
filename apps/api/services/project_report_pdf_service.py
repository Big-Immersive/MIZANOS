"""Per-project PDF report generator.

Builds either a single-project deep-dive PDF or a global multi-project PDF
(same layout per project, with task/bug detail condensed to status counts).
"""

import io
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.audit import Audit, RepositoryAnalysis
from apps.api.models.milestone import Milestone
from apps.api.models.product import Product, ProductLink, ProductMember
from apps.api.models.task import Task
from apps.api.services.project_report_pdf_health import (
    add_ai_insights,
    compute_dev_health,
)
from apps.api.services.project_report_pdf_layout import (
    add_metrics_columns,
    add_overview_and_members,
)
from apps.api.services.project_report_pdf_sections import (
    add_global_cover,
    add_milestones,
    add_milestones_with_status_breakdown,
    add_project_links,
    add_status_summary,
    add_title,
)
from apps.api.services.project_report_pdf_tasks import (
    add_item_list,
    add_tasks_by_milestone,
)
from apps.api.services.report_ai_service import ReportAIService
from apps.api.services.report_pdf_service import _ReportPDF
from apps.api.services.report_service import ReportService
from apps.api.services.scan_service import ScanService
from packages.common.utils.error_handlers import not_found


class ProjectReportPDFService:
    """Generate per-project or global multi-project PDF reports."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    async def generate(self, product_id: UUID) -> tuple[io.BytesIO, str]:
        """Single-project deep-dive PDF."""
        product = await self._fetch_product(product_id)
        pdf = self._new_pdf()
        pdf.add_page()
        await self._render_project(pdf, product, mode="solo")
        buf = self._finalize(pdf)
        safe = "".join(c if c.isalnum() or c in "-_ " else "_" for c in product.name).strip().replace(" ", "_")
        return buf, f"{safe or 'project'}_report.pdf"

    async def generate_global(self) -> tuple[io.BytesIO, str]:
        """Global multi-project PDF — every non-archived project, condensed."""
        products = await self._fetch_all_active_products()
        pdf = self._new_pdf()
        pdf.add_page()
        add_global_cover(pdf, products)
        for product in products:
            pdf.add_page()
            await self._render_project(pdf, product, mode="global")
        buf = self._finalize(pdf)
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return buf, f"Mizan_Global_Report_{date_str}.pdf"

    # ------------------------------------------------------------------
    # Rendering
    # ------------------------------------------------------------------

    async def _render_project(self, pdf: _ReportPDF, product: Product, mode: str) -> None:
        product_id = product.id
        members = await self._fetch_members(product_id)
        milestones = await self._fetch_milestones(product_id)
        links = await self._fetch_links(product_id)
        tasks = await self._fetch_tasks(product_id, "task")
        bugs = await self._fetch_tasks(product_id, "bug")
        audit = await self._fetch_latest_audit(product_id)

        report_data = await ReportService(self.session).get_project_report(product_id)
        ai_analysis = await ReportAIService(self.session).get_cached_analysis(product_id)
        scan_result = await ScanService(self.session).get_latest_scan_result(product_id)
        repo_analysis = await self._fetch_repository_analysis(product_id)
        dev_health = compute_dev_health(scan_result, audit, repo_analysis)

        feature_metrics = report_data.get("feature_metrics", {})
        github_metrics = report_data.get("github_metrics")
        raw_bug_counts = self._counts_by_status(bugs)
        # Global report shows the full canonical bug workflow breakdown (zeros
        # included) so every project's bugs block has the same shape; solo
        # report keeps only the statuses that actually have bugs.
        bug_counts = self._pad_bug_counts(raw_bug_counts) if mode == "global" else raw_bug_counts
        milestone_summary = self._build_milestone_summary(milestones, tasks)

        add_title(pdf, product.name)
        add_overview_and_members(pdf, product, members)
        if mode == "global":
            add_milestones_with_status_breakdown(pdf, milestone_summary)
            # Global report: bugs counts immediately after milestones, no detail list.
            add_status_summary(pdf, "Bugs", bug_counts, len(bugs))
        else:
            add_milestones(pdf, milestone_summary)
        add_project_links(pdf, links)
        add_ai_insights(pdf, ai_analysis)
        add_metrics_columns(
            pdf,
            float(feature_metrics.get("completion_pct") or 0),
            github_metrics,
            audit,
            dev_health,
        )
        if mode == "solo":
            task_counts = self._counts_by_status(tasks)
            add_status_summary(pdf, "Tasks", task_counts, len(tasks))
            tasks_grouped = self._group_tasks_by_milestone(milestones, tasks)
            add_tasks_by_milestone(pdf, tasks_grouped)
            # Solo report: full bug section at the end (counts + detail list), as before.
            add_status_summary(pdf, "Bugs", bug_counts, len(bugs))
            add_item_list(pdf, "Bugs", [self._item(b) for b in bugs])

    # ------------------------------------------------------------------
    # PDF helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _new_pdf() -> _ReportPDF:
        pdf = _ReportPDF()
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=20)
        return pdf

    @staticmethod
    def _finalize(pdf: _ReportPDF) -> io.BytesIO:
        buf = io.BytesIO()
        pdf.output(buf)
        buf.seek(0)
        return buf

    # ------------------------------------------------------------------
    # Data fetching
    # ------------------------------------------------------------------

    async def _fetch_product(self, product_id: UUID) -> Product:
        result = await self.session.execute(select(Product).where(Product.id == product_id))
        product = result.scalar_one_or_none()
        if not product:
            raise not_found("Product")
        return product

    async def _fetch_all_active_products(self) -> list[Product]:
        stmt = (
            select(Product)
            .where(Product.archived_at.is_(None))
            .order_by(Product.stage, Product.name)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _fetch_members(self, product_id: UUID) -> list[dict]:
        stmt = select(ProductMember).where(ProductMember.product_id == product_id)
        result = await self.session.execute(stmt)
        rows = list(result.scalars().all())
        grouped: dict[str, dict] = {}
        for m in rows:
            name = (m.profile.full_name if m.profile else None) or (m.profile.email if m.profile else None) or "Unknown"
            entry = grouped.setdefault(str(m.profile_id), {"name": name, "roles": []})
            role = m.role or "member"
            if role not in entry["roles"]:
                entry["roles"].append(role)
        return sorted(grouped.values(), key=lambda x: x["name"].lower())

    async def _fetch_links(self, product_id: UUID) -> list[dict]:
        stmt = (
            select(ProductLink)
            .where(ProductLink.product_id == product_id)
            .order_by(ProductLink.created_at)
        )
        result = await self.session.execute(stmt)
        return [{"name": r.name, "url": r.url} for r in result.scalars().all()]

    async def _fetch_milestones(self, product_id: UUID) -> list[Milestone]:
        stmt = (
            select(Milestone)
            .where(Milestone.product_id == product_id)
            .order_by(Milestone.sort_order, Milestone.created_at)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _fetch_tasks(self, product_id: UUID, task_type: str) -> list[Task]:
        stmt = (
            select(Task)
            .where(Task.product_id == product_id, Task.task_type == task_type)
            .order_by(Task.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _fetch_latest_audit(self, product_id: UUID) -> Audit | None:
        stmt = (
            select(Audit)
            .where(Audit.product_id == product_id)
            .order_by(Audit.run_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _fetch_repository_analysis(self, product_id: UUID) -> RepositoryAnalysis | None:
        stmt = (
            select(RepositoryAnalysis)
            .where(RepositoryAnalysis.product_id == product_id)
            .order_by(RepositoryAnalysis.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Aggregations
    # ------------------------------------------------------------------

    @staticmethod
    def _build_milestone_summary(milestones: list[Milestone], tasks: list[Task]) -> list[dict]:
        done_statuses = {"done", "live", "completed"}
        out: list[dict] = []
        for m in milestones:
            m_tasks = [t for t in tasks if t.milestone_id == m.id]
            total = len(m_tasks)
            done = sum(1 for t in m_tasks if (t.status or "").lower() in done_statuses)
            pct = round((done / total) * 100) if total > 0 else 0
            breakdown: dict[str, int] = {}
            for t in m_tasks:
                key = (t.status or "unknown").lower()
                breakdown[key] = breakdown.get(key, 0) + 1
            out.append({
                "title": m.title,
                "due_date": m.due_date.strftime("%d %b %Y") if m.due_date else None,
                "total": total,
                "done": done,
                "pct": pct,
                "status_breakdown": breakdown,
            })
        return out

    def _group_tasks_by_milestone(self, milestones: list[Milestone], tasks: list[Task]) -> list[dict]:
        by_id: dict = {m.id: {"title": m.title, "tasks": []} for m in milestones}
        ungrouped: list[dict] = []
        for t in tasks:
            item = self._item(t)
            if t.milestone_id and t.milestone_id in by_id:
                by_id[t.milestone_id]["tasks"].append(item)
            else:
                ungrouped.append(item)
        groups = [g for g in by_id.values() if g["tasks"]]
        if ungrouped:
            groups.append({"title": "Ungrouped", "tasks": ungrouped})
        return groups

    @staticmethod
    def _counts_by_status(items: list[Task]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for it in items:
            key = it.status or "unknown"
            counts[key] = counts.get(key, 0) + 1
        return counts

    _BUG_STATUSES = ("reported", "triaging", "in_progress", "fixed", "verified", "reopened", "live")

    @classmethod
    def _pad_bug_counts(cls, counts: dict[str, int]) -> dict[str, int]:
        """Zero-fill all canonical bug statuses so the report always shows
        the full breakdown (Reported / In Progress / Fixed / ...) instead of
        only the statuses that happen to have non-zero counts."""
        padded = {s: 0 for s in cls._BUG_STATUSES}
        for k, v in counts.items():
            padded[k] = v
        return padded

    @staticmethod
    def _item(task: Task) -> dict:
        return {
            "title": task.title,
            "description": task.description,
            "status": task.status,
        }
