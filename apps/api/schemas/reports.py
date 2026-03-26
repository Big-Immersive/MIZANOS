"""Pydantic schemas for project reports."""

from datetime import datetime
from uuid import UUID

from apps.api.schemas.base import BaseSchema


class TaskMetrics(BaseSchema):
    """Task breakdown for a single project."""

    total: int = 0
    by_status: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    completion_pct: float = 0.0
    overdue_count: int = 0


class FeatureMetrics(BaseSchema):
    """Specification feature breakdown for a single project."""

    total: int = 0
    by_status: dict[str, int] = {}
    completion_pct: float = 0.0


class GitHubMetrics(BaseSchema):
    """GitHub / repo scan metrics for a single project."""

    total_scans: int = 0
    total_files_changed: int = 0
    total_lines_added: int = 0
    total_lines_removed: int = 0
    latest_commit_sha: str | None = None
    last_scan_at: datetime | None = None
    contributors_count: int | None = None


class AIAnalysisResponse(BaseSchema):
    """AI-generated project analysis."""

    health_assessment: str
    risk_factors: list[str]
    recommendations: list[str]
    dev_contribution_summary: str
    generated_at: datetime


class ProjectReportBrief(BaseSchema):
    """Summary row for the portfolio directory table."""

    product_id: UUID
    product_name: str
    stage: str | None = None
    status: str | None = None
    created_at: datetime
    pm_name: str | None = None
    dev_name: str | None = None
    total_tasks: int = 0
    completed_tasks: int = 0
    in_progress_tasks: int = 0
    task_completion_pct: float = 0.0
    has_repository: bool = False
    total_commits: int = 0
    recent_commits: int = 0
    last_scan_at: datetime | None = None
    live_url: str | None = None
    dashboard_url: str | None = None


class ReportsSummaryResponse(BaseSchema):
    """Aggregated report across all projects."""

    total_projects: int = 0
    overall_task_completion_pct: float = 0.0
    total_tasks: int = 0
    tasks_completed: int = 0
    tasks_in_progress: int = 0
    total_commits: int = 0
    projects: list[ProjectReportBrief] = []


class ProjectReportDetailResponse(ProjectReportBrief):
    """Full detail for a single project report."""

    task_metrics: TaskMetrics = TaskMetrics()
    feature_metrics: FeatureMetrics = FeatureMetrics()
    github_metrics: GitHubMetrics | None = None
    ai_analysis: AIAnalysisResponse | None = None
