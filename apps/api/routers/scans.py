"""Scans router — trigger and query high-level repo scans."""

from uuid import UUID

from fastapi import APIRouter, Depends

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.scans import (
    ProgressSummaryResponse,
    ScanHistoryResponse,
    ScanResultResponse,
    ScanTriggerResponse,
)
from apps.api.services.scan_service import ScanService

router = APIRouter()


def _get_service(db: DbSession) -> ScanService:
    return ScanService(db)


@router.post(
    "/{product_id}/high-level",
    response_model=ScanTriggerResponse,
)
async def trigger_high_level_scan(
    product_id: UUID,
    user: CurrentUser = None,
    service: ScanService = Depends(_get_service),
) -> ScanTriggerResponse:
    """Trigger a high-level progress scan for a product."""
    job = await service.trigger_high_level_scan(product_id, str(user.id))
    return ScanTriggerResponse(
        id=job.id,
        job_type=job.job_type,
        status=job.status,
        progress=job.progress,
        product_id=job.product_id,
        created_at=job.created_at,
    )


@router.post("/{product_id}/cancel")
async def cancel_scan(
    product_id: UUID,
    user: CurrentUser = None,
    service: ScanService = Depends(_get_service),
) -> dict:
    """Cancel any running scan for a product."""
    count = await service.cancel_scan(product_id)
    return {"cancelled": count}


@router.get(
    "/{product_id}/latest",
    response_model=ScanResultResponse | None,
)
async def get_latest_scan(
    product_id: UUID,
    user: CurrentUser = None,
    service: ScanService = Depends(_get_service),
) -> ScanResultResponse | None:
    """Get the most recent scan result for a product."""
    result = await service.get_latest_scan_result(product_id)
    if not result:
        return None
    return ScanResultResponse.model_validate(result)


@router.get(
    "/{product_id}/history",
    response_model=ScanHistoryResponse,
)
async def get_scan_history(
    product_id: UUID,
    page: int = 1,
    page_size: int = 20,
    user: CurrentUser = None,
    service: ScanService = Depends(_get_service),
) -> ScanHistoryResponse:
    """Paginated scan history for a product."""
    return await service.get_scan_history(product_id, page, page_size)


@router.get(
    "/{product_id}/progress-summary",
    response_model=ProgressSummaryResponse,
)
async def get_progress_summary(
    product_id: UUID,
    user: CurrentUser = None,
    service: ScanService = Depends(_get_service),
) -> ProgressSummaryResponse:
    """Quick progress summary (progress %, last scan time)."""
    return await service.get_progress_summary(product_id)
