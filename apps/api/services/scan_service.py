"""Scan service — orchestrates high-level repo scans."""

import logging
from uuid import UUID

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.audit import RepositoryAnalysis, RepoScanHistory
from apps.api.models.job import Job
from apps.api.models.product import Product
from apps.api.services.job_service import JobService
from packages.common.utils.error_handlers import bad_request, not_found

logger = logging.getLogger(__name__)


class ScanService:
    """Manages scan lifecycle: trigger, fetch results, history."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def trigger_high_level_scan(
        self, product_id: UUID, user_id: str,
    ) -> Job:
        """Create and enqueue a high-level scan job."""
        product = await self.session.get(Product, product_id)
        if not product:
            raise not_found("Product")
        if not product.repository_url:
            raise bad_request("Product has no linked repository")

        await self._check_no_running_scan(product_id)

        job_svc = JobService(self.session)
        return await job_svc.create_and_enqueue(
            job_type="high_level_scan",
            arq_function="high_level_scan_job",
            user_id=user_id,
            product_id=product_id,
        )

    async def cancel_scan(self, product_id: UUID) -> int:
        """Cancel all pending/running scans for a product. Returns count cancelled."""
        stmt = (
            update(Job)
            .where(
                Job.product_id == product_id,
                Job.job_type == "high_level_scan",
                Job.status.in_(["pending", "running"]),
            )
            .values(status="failed", progress_message="Cancelled by user")
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def _check_no_running_scan(self, product_id: UUID) -> None:
        """Raise if a scan is already running for this product."""
        stmt = select(func.count()).where(
            Job.product_id == product_id,
            Job.job_type == "high_level_scan",
            Job.status.in_(["pending", "running"]),
        )
        count = (await self.session.execute(stmt)).scalar_one()
        if count > 0:
            raise bad_request("A scan is already in progress for this product")

    async def get_latest_scan_result(
        self, product_id: UUID,
    ) -> RepositoryAnalysis | None:
        """Get the most recent analysis for a product."""
        stmt = (
            select(RepositoryAnalysis)
            .where(RepositoryAnalysis.product_id == product_id)
            .order_by(RepositoryAnalysis.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_scan_history(
        self, product_id: UUID, page: int = 1, page_size: int = 20,
    ) -> dict:
        """Paginated scan history for a product."""
        base = select(RepoScanHistory).where(
            RepoScanHistory.product_id == product_id,
        )
        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()

        stmt = (
            base.order_by(RepoScanHistory.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.session.execute(stmt)
        return {
            "data": list(result.scalars().all()),
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_progress_summary(self, product_id: UUID) -> dict:
        """Quick summary: progress %, last scan time, commit SHA."""
        product = await self.session.get(Product, product_id)
        if not product:
            raise not_found("Product")

        latest = await self.get_latest_scan_result(product_id)
        summary = latest.gap_analysis if latest and latest.gap_analysis else None
        active_job_id = await self._get_active_scan_job_id(product_id)

        return {
            "product_id": str(product_id),
            "progress_pct": product.progress or 0.0,
            "last_scan_at": str(latest.created_at) if latest else None,
            "commit_sha": latest.branch if latest else None,
            "scan_summary": summary,
            "active_job_id": str(active_job_id) if active_job_id else None,
        }

    async def _get_active_scan_job_id(self, product_id: UUID) -> UUID | None:
        """Return the ID of any pending/running scan job, or None."""
        stmt = (
            select(Job.id)
            .where(
                Job.product_id == product_id,
                Job.job_type == "high_level_scan",
                Job.status.in_(["pending", "running"]),
            )
            .order_by(Job.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
