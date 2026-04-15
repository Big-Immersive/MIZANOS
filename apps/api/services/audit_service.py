"""Audit service.

Audits are now produced as a side-effect of the Code Progress Scan — see
`apps/api/jobs/scan_job.py` and `apps/api/services/audit_tools/`. This
service only handles reads (list/compare) and the legacy "Run Audit"
button, which now just triggers a scan.
"""

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

    async def run_audit(self, product_id: UUID, user_id: str) -> Audit | None:
        """Trigger a Code Progress Scan which will write an Audit row as a
        side-effect. Returns the most recent audit (may be the previous
        one until the scan finishes; frontend polls).
        """
        from apps.api.services.scan_service import ScanService

        scan_svc = ScanService(self.repo.session)
        await scan_svc.trigger_high_level_scan(product_id, user_id)
        return await self._latest_for_product(product_id)

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
            all_keys = set(current.categories.keys()) | set(previous.categories.keys())
            for key in all_keys:
                cur_val = current.categories.get(key)
                prev_val = previous.categories.get(key)
                if isinstance(cur_val, (int, float)) and isinstance(prev_val, (int, float)):
                    categories_diff[key] = cur_val - prev_val

        return {
            "product_id": product_id,
            "current": current,
            "previous": previous,
            "score_diff": score_diff,
            "categories_diff": categories_diff,
            "has_comparison": previous is not None,
        }

    async def _latest_for_product(self, product_id: UUID) -> Audit | None:
        stmt = (
            select(Audit)
            .where(Audit.product_id == product_id)
            .order_by(Audit.run_at.desc())
            .limit(1)
        )
        result = await self.repo.session.execute(stmt)
        return result.scalar_one_or_none()
