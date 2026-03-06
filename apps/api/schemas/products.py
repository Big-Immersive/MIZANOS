"""Product schemas."""

from datetime import datetime
from uuid import UUID

from apps.api.schemas.base import BaseSchema, PaginatedResponse


class ProductBase(BaseSchema):
    """Shared product fields."""

    name: str
    description: str | None = None
    status: str | None = "intake"
    stage: str | None = "Intake"
    pillar: str | None = None
    progress: float | None = 0
    health_score: float | None = None
    repository_url: str | None = None
    github_pat_id: UUID | None = None
    github_repo_status: str | None = None
    github_repo_error: str | None = None
    tracked_branch: str | None = None
    source_type: str | None = None


class ProductCreate(ProductBase):
    """Product creation schema."""

    pass


class ProductUpdate(BaseSchema):
    """Product update schema (all optional)."""

    name: str | None = None
    description: str | None = None
    status: str | None = None
    stage: str | None = None
    pillar: str | None = None
    progress: float | None = None
    health_score: float | None = None
    repository_url: str | None = None
    github_pat_id: UUID | None = None
    github_repo_status: str | None = None
    github_repo_error: str | None = None
    tracked_branch: str | None = None
    source_type: str | None = None


class ProductResponse(ProductBase):
    """Product response."""

    id: UUID
    github_pat_id: UUID | None = None
    lovable_url: str | None = None
    logo_url: str | None = None
    created_by: UUID | None = None
    created_by_name: str | None = None
    archived_at: datetime | None = None
    tasks_locked: bool = False
    task_count: int = 0
    bug_count: int = 0
    bugs_fixed_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProductListResponse(PaginatedResponse):
    """Paginated product list."""

    data: list[ProductResponse]


class ManagementNoteCreate(BaseSchema):
    """Management note creation."""

    content: str
    author_id: UUID
    is_pinned: bool = False


class ManagementNoteResponse(BaseSchema):
    """Management note response."""

    id: UUID
    product_id: UUID
    author_id: UUID
    content: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime


class PartnerNoteCreate(BaseSchema):
    """Partner note creation."""

    partner_name: str
    content: str
    author_id: UUID


class PartnerNoteResponse(BaseSchema):
    """Partner note response."""

    id: UUID
    product_id: UUID
    author_id: UUID
    partner_name: str
    content: str
    created_at: datetime
    updated_at: datetime


class ProductMemberAddRequest(BaseSchema):
    """Add a member to a product."""

    profile_id: UUID
    role: str


class ProfileSummary(BaseSchema):
    """Embedded profile info for product member responses."""

    id: UUID
    full_name: str | None = None
    email: str | None = None
    avatar_url: str | None = None


class ProductMemberResponse(BaseSchema):
    """Product member response."""

    id: UUID
    product_id: UUID
    profile_id: UUID
    role: str | None = None
    created_at: datetime
    profile: ProfileSummary | None = None


class TeamReadinessResponse(BaseSchema):
    """Team composition readiness check."""

    complete: bool
    members: list[ProductMemberResponse]
    missing: list[str]


class ProductEnvironmentResponse(BaseSchema):
    """Product environment response."""

    id: UUID
    product_id: UUID
    environment_type: str
    url: str | None = None
    branch: str | None = None
    status: str = "active"
    target_domain: str | None = None
    railway_project_url: str | None = None
    railway_toml_present: bool | None = None
    notes: str | None = None
    last_deployment_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ProductEnvironmentUpsert(BaseSchema):
    """Upsert a product environment."""
    environment_type: str
    url: str | None = None
    branch: str | None = None
    status: str = "active"
    target_domain: str | None = None
    notes: str | None = None


class DeploymentChecklistResponse(BaseSchema):
    """Deployment checklist item response."""

    id: UUID
    product_id: UUID
    item_key: str
    title: str
    category: str
    description: str | None = None
    is_checked: bool | None = None
    order_index: int | None = None
    notes: str | None = None
    checked_at: datetime | None = None
    checked_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


class DeploymentChecklistUpdate(BaseSchema):
    """Deployment checklist item update."""

    is_checked: bool | None = None
    notes: str | None = None


class StakeholderCreate(BaseSchema):
    """Stakeholder creation."""

    name: str
    role: str
    email: str | None = None
    profile_id: UUID | None = None
    is_external: bool | None = None
    responsibilities: list[str] | None = None


class StakeholderResponse(BaseSchema):
    """Stakeholder response."""

    id: UUID
    product_id: UUID
    name: str
    role: str
    email: str | None = None
    profile_id: UUID | None = None
    is_external: bool | None = None
    responsibilities: list[str] | None = None
    created_at: datetime | None = None


class StakeholderUpdate(BaseSchema):
    """Stakeholder update."""

    name: str | None = None
    role: str | None = None
    email: str | None = None
    profile_id: UUID | None = None
    is_external: bool | None = None
    responsibilities: list[str] | None = None


class ProjectIntegrationCreate(BaseSchema):
    """Project integration creation."""

    name: str
    type: str = "api"
    category: str = "general"
    status: str = "active"
    description: str | None = None
    endpoint_url: str | None = None
    docs_url: str | None = None
    notes: str | None = None
    global_integration_id: UUID | None = None
    api_key_configured: bool | None = None


class ProjectIntegrationResponse(BaseSchema):
    """Project integration response."""

    id: UUID
    product_id: UUID
    name: str
    type: str
    category: str
    status: str
    description: str | None = None
    endpoint_url: str | None = None
    docs_url: str | None = None
    notes: str | None = None
    global_integration_id: UUID | None = None
    api_key_configured: bool | None = None
    created_at: datetime
    updated_at: datetime


class ProjectIntegrationUpdate(BaseSchema):
    """Project integration update."""

    name: str | None = None
    type: str | None = None
    category: str | None = None
    status: str | None = None
    description: str | None = None
    endpoint_url: str | None = None
    docs_url: str | None = None
    notes: str | None = None
    api_key_configured: bool | None = None


class SpecificationSourceCreate(BaseSchema):
    """Specification source creation."""

    source_type: str
    raw_content: str | None = None
    url: str | None = None
    file_name: str | None = None
    file_url: str | None = None
    transcription: str | None = None
    screenshot_base64: str | None = None
    logo_url: str | None = None
    ai_summary: dict | None = None
    branding: dict | None = None
    screenshots: dict | None = None


class SpecificationSourceResponse(BaseSchema):
    """Specification source response."""

    id: UUID
    product_id: UUID
    source_type: str
    raw_content: str | None = None
    url: str | None = None
    file_name: str | None = None
    file_url: str | None = None
    transcription: str | None = None
    screenshot_base64: str | None = None
    logo_url: str | None = None
    ai_summary: dict | None = None
    branding: dict | None = None
    screenshots: dict | None = None
    created_at: datetime
