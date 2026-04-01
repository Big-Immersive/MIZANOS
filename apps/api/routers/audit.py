"""Audit router."""

from uuid import UUID

from fastapi import APIRouter, Depends

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.audit import AuditListResponse, AuditResponse, CompareResponse, RunAuditRequest
from apps.api.services.audit_service import AuditService

router = APIRouter()


def get_service(db: DbSession) -> AuditService:
    return AuditService(db)


@router.get("", response_model=AuditListResponse)
async def list_audits(
    product_id: UUID,
    page: int = 1,
    page_size: int = 50,
    user: CurrentUser = None,
    service: AuditService = Depends(get_service),
):
    return await service.get_by_product(product_id, page=page, page_size=page_size)


@router.post("/run", response_model=AuditResponse)
async def run_audit(body: RunAuditRequest, user: CurrentUser = None, service: AuditService = Depends(get_service)):
    return await service.run_audit(body.product_id, user.profile_id)


@router.delete("/{audit_id}", status_code=204)
async def delete_audit(audit_id: UUID, user: CurrentUser = None, service: AuditService = Depends(get_service)):
    await service.delete_audit(audit_id)


@router.get("/compare", response_model=CompareResponse)
async def compare_audits(product_id: UUID, user: CurrentUser = None, service: AuditService = Depends(get_service)):
    return await service.compare(product_id)
