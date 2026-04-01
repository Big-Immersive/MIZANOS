"""Audit service."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.audit import Audit
from apps.api.services.base_service import BaseService


class AuditService(BaseService[Audit]):
    """Audit business logic."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Audit, session)

    async def get_by_product(
        self,
        product_id: UUID,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        stmt = select(Audit).where(Audit.product_id == product_id)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.repo.session.execute(count_stmt)).scalar_one()
        stmt = stmt.order_by(Audit.run_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size)
        result = await self.repo.session.execute(stmt)
        return {
            "data": list(result.scalars().all()),
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def run_audit(self, product_id: UUID, user_id: str) -> Audit:
        """Run audit using scan data, GitHub analysis, and task metrics."""
        from apps.api.models.audit import RepositoryAnalysis
        from apps.api.models.product import Product
        from apps.api.models.task import Task

        issues: dict[str, list] = {"critical": [], "warnings": []}

        # Fetch latest scan result
        scan_stmt = (
            select(RepositoryAnalysis)
            .where(RepositoryAnalysis.product_id == product_id)
            .order_by(RepositoryAnalysis.created_at.desc())
            .limit(1)
        )
        scan = (await self.repo.session.execute(scan_stmt)).scalar_one_or_none()

        # Fetch tasks for the product
        task_stmt = select(Task).where(Task.product_id == product_id)
        tasks = list((await self.repo.session.execute(task_stmt)).scalars().all())
        total_tasks = len(tasks)

        # Fetch product for repo info
        product = await self.repo.session.get(Product, product_id)

        # --- Style score: code organization & structure ---
        style = 0.0
        if scan:
            evidence = scan.functional_inventory or []
            if isinstance(evidence, list) and evidence:
                # Avg confidence of task-code matching (higher = better organized code)
                confidences = [e.get("confidence", 0) for e in evidence if isinstance(e, dict)]
                style = round((sum(confidences) / len(confidences)) * 100, 1) if confidences else 0
            tech = scan.tech_stack if isinstance(scan.tech_stack, dict) else {}
            if tech.get("description"):
                style = min(100, style + 10)

        # --- Architecture score: task coverage & component structure ---
        architecture = 0.0
        if scan and scan.gap_analysis and isinstance(scan.gap_analysis, dict):
            ga = scan.gap_analysis
            total = ga.get("total_tasks", 0)
            verified = ga.get("verified", 0)
            partial = ga.get("partial", 0)
            no_evidence = ga.get("no_evidence", 0)
            if total > 0:
                architecture = round(((verified + partial * 0.5) / total) * 100, 1)
            if no_evidence > 3:
                issues["warnings"].append({
                    "title": f"{no_evidence} tasks have no matching code",
                    "category": "architecture",
                })

        # --- Security score: based on task completion & overdue ---
        security = 0.0
        if total_tasks > 0:
            done = sum(1 for t in tasks if t.status in ("done", "live"))
            now = datetime.now(timezone.utc)
            overdue = sum(
                1 for t in tasks
                if t.due_date and t.due_date < now and t.status not in ("done", "live")
            )
            completion_ratio = done / total_tasks
            security = round(completion_ratio * 100, 1)
            if overdue > 0:
                penalty = min(30, overdue * 10)
                security = max(0, security - penalty)
                issues["critical"].append({
                    "title": f"{overdue} overdue task(s) still open",
                    "category": "security",
                })

        # --- Performance score: scan freshness & repo health ---
        performance = 0.0
        checks_passed = 0
        total_checks = 5
        if scan:
            checks_passed += 1  # Has scan data
            if scan.file_count and scan.file_count > 10:
                checks_passed += 1
            fi = scan.functional_inventory
            if isinstance(fi, list) and len(fi) > 0:
                with_artifacts = sum(
                    1 for e in fi
                    if isinstance(e, dict) and e.get("artifacts_found")
                )
                if with_artifacts > len(fi) * 0.5:
                    checks_passed += 1
        if product and product.repository_url:
            checks_passed += 1
        if total_tasks > 0 and sum(1 for t in tasks if t.status in ("done", "live")) > 0:
            checks_passed += 1
        performance = round((checks_passed / total_checks) * 100, 1)

        categories = {
            "style": style,
            "architecture": architecture,
            "security": security,
            "performance": performance,
        }

        overall_score = round(sum(categories.values()) / len(categories), 1)

        audit = Audit(
            product_id=product_id,
            created_by=user_id,
            overall_score=overall_score,
            categories=categories,
            issues=issues,
        )
        return await self.repo.create(audit)

    async def delete_audit(self, audit_id: UUID) -> None:
        """Delete a single audit record."""
        from packages.common.utils.error_handlers import not_found

        audit = await self.repo.session.get(Audit, audit_id)
        if not audit:
            raise not_found("Audit")
        await self.repo.session.delete(audit)
        await self.repo.session.flush()

    async def compare(self, product_id: UUID) -> dict:
        """Compare the latest two audits for a product."""
        stmt = (
            select(Audit)
            .where(Audit.product_id == product_id)
            .order_by(Audit.run_at.desc())
            .limit(2)
        )
        result = await self.repo.session.execute(stmt)
        audits = list(result.scalars().all())

        if len(audits) == 0:
            return {
                "product_id": product_id,
                "current": None,
                "previous": None,
                "score_diff": 0,
                "categories_diff": {},
                "has_comparison": False,
            }

        current = audits[0]
        previous = audits[1] if len(audits) > 1 else None
        score_diff = 0.0
        categories_diff: dict = {}

        if previous:
            score_diff = current.overall_score - previous.overall_score
            all_keys = set(current.categories.keys()) | set(
                previous.categories.keys()
            )
            for key in all_keys:
                cur_val = current.categories.get(key)
                prev_val = previous.categories.get(key)
                if isinstance(cur_val, (int, float)) and isinstance(
                    prev_val, (int, float)
                ):
                    categories_diff[key] = cur_val - prev_val

        return {
            "product_id": product_id,
            "current": current,
            "previous": previous,
            "score_diff": score_diff,
            "categories_diff": categories_diff,
            "has_comparison": previous is not None,
        }
