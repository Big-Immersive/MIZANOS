"""Audit schemas."""

from datetime import datetime
from uuid import UUID

from apps.api.schemas.base import BaseSchema, PaginatedResponse


class AuditResponse(BaseSchema):
    """Audit result response."""

    id: UUID
    product_id: UUID
    overall_score: float
    categories: dict
    issues: dict
    created_by: UUID | None = None
    run_at: datetime
    created_at: datetime


class AuditListResponse(PaginatedResponse):
    """Paginated audit list."""

    data: list[AuditResponse]


class RunAuditRequest(BaseSchema):
    """Request to run a new audit."""

    product_id: UUID


class CompareResponse(BaseSchema):
    """Audit comparison response."""

    product_id: UUID
    current: AuditResponse | None = None
    previous: AuditResponse | None = None
    score_diff: float = 0
    categories_diff: dict = {}
    has_comparison: bool = False
