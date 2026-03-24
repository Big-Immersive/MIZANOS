"""Reports router — project status aggregation and AI analysis."""

from uuid import UUID

from fastapi import APIRouter, Depends

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.reports import (
    AIAnalysisResponse,
    ProjectReportDetailResponse,
    ReportsSummaryResponse,
)
from apps.api.services.report_ai_service import ReportAIService
from apps.api.services.report_service import ReportService

router = APIRouter()


def _report_service(db: DbSession) -> ReportService:
    return ReportService(db)


def _ai_service(db: DbSession) -> ReportAIService:
    return ReportAIService(db)


@router.get("/summary", response_model=ReportsSummaryResponse)
async def get_reports_summary(
    user: CurrentUser,
    service: ReportService = Depends(_report_service),
):
    """Aggregated report across all projects."""
    return await service.get_summary()


@router.get("/projects/{product_id}", response_model=ProjectReportDetailResponse)
async def get_project_report(
    product_id: UUID,
    user: CurrentUser,
    service: ReportService = Depends(_report_service),
):
    """Detailed report for a single project."""
    report = await service.get_project_report(product_id)
    ai_svc = ReportAIService(service.session)
    cached = await ai_svc.get_cached_analysis(product_id)
    if cached:
        report["ai_analysis"] = cached
    return report


@router.post("/projects/{product_id}/analyze", response_model=AIAnalysisResponse)
async def trigger_ai_analysis(
    product_id: UUID,
    user: CurrentUser,
    service: ReportAIService = Depends(_ai_service),
):
    """Generate AI analysis for a project report."""
    return await service.generate_analysis(product_id)
