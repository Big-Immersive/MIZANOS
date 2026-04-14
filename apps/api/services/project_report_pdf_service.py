"""Per-project PDF report generator.

Builds a single-project deep-dive PDF covering members, tasks, bugs, audit,
code progress, timeline health, stage progress, and AI development health.
"""

import io
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.audit import Audit, RepositoryAnalysis
from apps.api.models.milestone import Milestone
from apps.api.models.product import Product, ProductLink, ProductMember
from apps.api.models.task import Task
from apps.api.services.report_ai_service import ReportAIService
from apps.api.services.report_pdf_service import _ReportPDF
from apps.api.services.report_service import ReportService
from apps.api.services.scan_service import ScanService
from apps.api.services.project_report_pdf_health import add_ai_insights
from apps.api.services.project_report_pdf_layout import (
    add_metrics_columns,
    add_overview_and_members,
)
from apps.api.services.project_report_pdf_sections import (
    add_milestones,
    add_project_links,
    add_status_summary,
    add_title,
)
from apps.api.services.project_report_pdf_tasks import (
    add_item_list,
    add_tasks_by_milestone,
)
from packages.common.utils.error_handlers import not_found


class ProjectReportPDFService:
    """Generate a per-project PDF report."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def generate(self, product_id: UUID) -> tuple[io.BytesIO, str]:
        """Build the PDF and return (buffer, suggested filename)."""
        product = await self._fetch_product(product_id)
        members = await self._fetch_members(product_id)
        milestones = await self._fetch_milestones(product_id)
        links = await self._fetch_links(product_id)
        tasks = await self._fetch_tasks(product_id, "task")
        bugs = await self._fetch_tasks(product_id, "bug")
        audit = await self._fetch_latest_audit(product_id)

        report_svc = ReportService(self.session)
        report_data = await report_svc.get_project_report(product_id)
        ai_svc = ReportAIService(self.session)
        ai_analysis = await ai_svc.get_cached_analysis(product_id)
        scan_svc = ScanService(self.session)
        scan_result = await scan_svc.get_latest_scan_result(product_id)
        repo_analysis = await self._fetch_repository_analysis(product_id)
        dev_health = self._compute_dev_health(scan_result, audit, repo_analysis)

        feature_metrics = report_data.get("feature_metrics", {})
        github_metrics = report_data.get("github_metrics")

        task_counts = self._counts_by_status(tasks)
        bug_counts = self._counts_by_status(bugs)
        milestone_summary = self._build_milestone_summary(milestones, tasks)
        tasks_grouped = self._group_tasks_by_milestone(milestones, tasks)

        pdf = _ReportPDF()
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=20)
        pdf.add_page()

        add_title(pdf, product.name)
        add_overview_and_members(pdf, product, members)
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
        add_status_summary(pdf, "Tasks", task_counts, len(tasks))
        add_tasks_by_milestone(pdf, tasks_grouped)
        add_status_summary(pdf, "Bugs", bug_counts, len(bugs))
        add_item_list(pdf, "Bugs", [self._item(b) for b in bugs])

        buf = io.BytesIO()
        pdf.output(buf)
        buf.seek(0)
        safe_name = "".join(c if c.isalnum() or c in "-_ " else "_" for c in product.name).strip().replace(" ", "_")
        return buf, f"{safe_name or 'project'}_report.pdf"

    async def _fetch_product(self, product_id: UUID) -> Product:
        result = await self.session.execute(select(Product).where(Product.id == product_id))
        product = result.scalar_one_or_none()
        if not product:
            raise not_found("Product")
        return product

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

    @staticmethod
    def _build_milestone_summary(milestones: list[Milestone], tasks: list[Task]) -> list[dict]:
        done_statuses = {"done", "live", "completed"}
        out: list[dict] = []
        for m in milestones:
            m_tasks = [t for t in tasks if t.milestone_id == m.id]
            total = len(m_tasks)
            done = sum(1 for t in m_tasks if (t.status or "").lower() in done_statuses)
            pct = round((done / total) * 100) if total > 0 else 0
            out.append({
                "title": m.title,
                "due_date": m.due_date.strftime("%d %b %Y") if m.due_date else None,
                "total": total,
                "done": done,
                "pct": pct,
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

    async def _fetch_tasks(self, product_id: UUID, task_type: str) -> list[Task]:
        stmt = (
            select(Task)
            .where(Task.product_id == product_id, Task.task_type == task_type)
            .order_by(Task.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _fetch_repository_analysis(self, product_id: UUID) -> RepositoryAnalysis | None:
        stmt = (
            select(RepositoryAnalysis)
            .where(RepositoryAnalysis.product_id == product_id)
            .order_by(RepositoryAnalysis.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    def _compute_dev_health(scan_result, audit, analysis) -> dict:
        """Mirror the frontend DevelopmentHealthSection score calculation."""
        ga = (scan_result.gap_analysis if scan_result and scan_result.gap_analysis else None) or {}
        inventory = (scan_result.functional_inventory if scan_result and scan_result.functional_inventory else None) or []
        has_scan = bool(ga)

        # Spec alignment
        spec = 0
        if isinstance(ga, dict):
            if isinstance(ga.get("progress_pct"), (int, float)):
                spec = round(ga["progress_pct"])
            elif ga.get("total_tasks") and isinstance(ga.get("verified"), (int, float)):
                spec = round((ga["verified"] / ga["total_tasks"]) * 100)
        if spec == 0 and analysis and getattr(analysis, "overall_score", None):
            spec = round(analysis.overall_score)

        # Code quality
        quality = 0
        if isinstance(inventory, list) and inventory:
            total = len(inventory)
            avg_conf = sum(float(e.get("confidence", 0) or 0) for e in inventory if isinstance(e, dict)) / total
            with_artifacts = sum(1 for e in inventory if isinstance(e, dict) and e.get("artifacts_found"))
            quality = round(avg_conf * 60 + (with_artifacts / total) * 40)
        if quality == 0 and audit and getattr(audit, "overall_score", None):
            quality = round(audit.overall_score)

        # Standards: 5 checks
        tech_stack = (analysis.tech_stack if analysis and isinstance(analysis.tech_stack, dict) else {}) or {}
        score = 0
        checks = 5
        if tech_stack.get("description"): score += 1
        try:
            if int(tech_stack.get("contributors", 0) or 0) > 1: score += 1
        except (TypeError, ValueError):
            pass
        file_count = (scan_result.file_count if scan_result and scan_result.file_count else 0) or 0
        if file_count > 10: score += 1
        if isinstance(ga, dict) and ga.get("total_tasks"):
            no_ev_ratio = float(ga.get("no_evidence", 0) or 0) / float(ga["total_tasks"])
            if no_ev_ratio < 0.3: score += 1
            if (ga.get("verified") or 0) > 0: score += 1
        standards = round((score / checks) * 100)

        overall = round(spec * 0.4 + quality * 0.35 + standards * 0.25)
        last_scan_at = None
        if scan_result and getattr(scan_result, "created_at", None):
            last_scan_at = scan_result.created_at.strftime("%d %b %Y")
        return {
            "spec_alignment": spec,
            "code_quality": quality,
            "standards": standards,
            "overall": overall,
            "spec_label": "tasks verified" if has_scan else "from analysis",
            "quality_label": "evidence quality" if has_scan else "audit score",
            "last_scan_at": last_scan_at,
        }

    async def _fetch_latest_audit(self, product_id: UUID) -> Audit | None:
        stmt = (
            select(Audit)
            .where(Audit.product_id == product_id)
            .order_by(Audit.run_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    def _counts_by_status(items: list[Task]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for it in items:
            key = it.status or "unknown"
            counts[key] = counts.get(key, 0) + 1
        return counts

    @staticmethod
    def _item(task: Task) -> dict:
        return {
            "title": task.title,
            "description": task.description,
            "status": task.status,
        }
