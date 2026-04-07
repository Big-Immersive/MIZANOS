"""Reports router — project status aggregation and AI analysis."""

from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.reports import (
    AIAnalysisResponse,
    ProjectReportDetailResponse,
    ReportsSummaryResponse,
)
from apps.api.services.report_ai_service import ReportAIService
from apps.api.services.report_document_service import ReportDocumentService
from apps.api.services.report_pdf_service import ReportPDFService
from apps.api.services.report_service import ReportService, _commit_cache


class GenerateDocumentRequest(BaseModel):
    product_ids: list[UUID]
    report_type: str = "general"  # "general" or "bugs"

router = APIRouter()


def _report_service(db: DbSession) -> ReportService:
    return ReportService(db)


def _ai_service(db: DbSession) -> ReportAIService:
    return ReportAIService(db)


@router.get("/summary", response_model=ReportsSummaryResponse)
async def get_reports_summary(
    user: CurrentUser,
    service: ReportService = Depends(_report_service),
    refresh: bool = False,
):
    """Aggregated report across all projects."""
    if refresh:
        _commit_cache.clear()
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


@router.get("/projects/{product_id}/recent-commits")
async def get_recent_commits(
    product_id: UUID,
    user: CurrentUser,
    service: ReportService = Depends(_report_service),
):
    """Fetch recent commit details from GitHub."""
    return await service.get_recent_commits(product_id)


@router.post("/projects/{product_id}/analyze", response_model=AIAnalysisResponse)
async def trigger_ai_analysis(
    product_id: UUID,
    user: CurrentUser,
    service: ReportAIService = Depends(_ai_service),
):
    """Generate AI analysis for a project report."""
    return await service.generate_analysis(product_id)


@router.post("/generate-document")
async def generate_document(
    body: GenerateDocumentRequest,
    user: CurrentUser,
    db: DbSession,
):
    """Generate a downloadable .docx report for selected projects."""
    svc = ReportDocumentService(db)
    buf = await svc.generate(body.product_ids, report_type=body.report_type)
    filename = "Bug_Report" if body.report_type == "bugs" else "Project_Status_Update"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}.docx"},
    )


@router.post("/generate-pdf")
async def generate_pdf(
    body: GenerateDocumentRequest,
    user: CurrentUser,
    db: DbSession,
):
    """Generate a downloadable PDF report for selected projects."""
    svc = ReportPDFService(db)
    buf = await svc.generate(body.product_ids, report_type=body.report_type)
    filename = "Bug_Report" if body.report_type == "bugs" else "Project_Status_Update"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}.pdf"},
    )
