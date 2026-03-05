"""Scan schemas — request/response types for progress scanning."""

from datetime import datetime
from uuid import UUID

from apps.api.schemas.base import BaseSchema, PaginatedResponse


class ScanTriggerResponse(BaseSchema):
    """Response when a scan is triggered (returns the job)."""

    id: UUID
    job_type: str
    status: str
    progress: int
    product_id: UUID | None = None
    created_at: datetime


class TaskEvidenceItem(BaseSchema):
    """Evidence for a single task from the scan."""

    task_id: str
    task_title: str
    status_in_pm: str
    verified: bool
    confidence: float
    artifacts_found: list[str]
    summary: str


class ScanSummary(BaseSchema):
    """Aggregated scan summary."""

    total_tasks: int
    verified: int
    partial: int
    no_evidence: int
    progress_pct: float


class ScanResultResponse(BaseSchema):
    """Full scan result with analysis data."""

    id: UUID
    product_id: UUID
    repository_url: str
    branch: str | None = None
    file_count: int | None = None
    functional_inventory: list | dict | None = None
    gap_analysis: dict | None = None
    created_at: datetime


class ScanHistoryItem(BaseSchema):
    """A single scan history entry."""

    id: UUID
    product_id: UUID
    repository_url: str
    branch: str
    latest_commit_sha: str
    scan_status: str
    files_changed: int
    components_discovered: dict | None = None
    created_at: datetime


class ScanHistoryResponse(PaginatedResponse):
    """Paginated scan history."""

    data: list[ScanHistoryItem]


class ProgressSummaryResponse(BaseSchema):
    """Lightweight progress summary for dashboard."""

    product_id: str
    progress_pct: float
    last_scan_at: str | None = None
    commit_sha: str | None = None
    scan_summary: dict | None = None
