"""Document schemas."""

from datetime import datetime
from uuid import UUID

from apps.api.schemas.base import BaseSchema, PaginatedResponse


class DocumentBase(BaseSchema):
    """Product document fields."""

    file_name: str
    file_type: str | None = None
    file_size: int | None = None
    file_url: str | None = None
    ai_summary: str | None = None


class DocumentCreate(DocumentBase):
    """Document creation schema."""

    product_id: UUID
    uploaded_by: UUID | None = None
    folder_id: UUID | None = None


class DocumentResponse(DocumentBase):
    """Document response."""

    id: UUID
    product_id: UUID
    uploaded_by: UUID
    folder_id: UUID | None = None
    created_at: datetime


class FolderUpdate(BaseSchema):
    """Folder update schema (rename/move)."""

    name: str | None = None
    parent_id: UUID | None = None


class FolderCreate(BaseSchema):
    """Folder creation schema."""

    name: str
    product_id: UUID
    parent_id: UUID | None = None


class FolderResponse(BaseSchema):
    """Folder response."""

    id: UUID
    name: str
    product_id: UUID
    parent_id: UUID | None = None
    created_at: datetime


class VersionCreate(BaseSchema):
    """Document version creation."""

    file_path: str
    file_type: str
    file_size: int
    change_notes: str | None = None
    uploaded_by: UUID


class VersionResponse(BaseSchema):
    """Document version response."""

    id: UUID
    document_id: UUID
    uploaded_by: UUID
    file_path: str
    file_type: str
    file_size: int
    version_number: int
    is_current: bool
    change_notes: str | None = None
    created_at: datetime


class DocumentListResponse(PaginatedResponse):
    """Paginated document list."""

    data: list[DocumentResponse]


class SharedProductInfo(BaseSchema):
    """Product info in shared response."""

    id: UUID
    name: str


class SharedDocumentsResponse(BaseSchema):
    """Response for shared documents endpoint."""

    product: SharedProductInfo
    link_name: str
    documents: list[DocumentResponse]


class AccessLinkCreate(BaseSchema):
    """Document access link creation."""

    product_id: UUID
    created_by: UUID
    expires_at: datetime | None = None


class AccessLinkResponse(BaseSchema):
    """Access link response."""

    id: UUID
    token: str
    product_id: UUID
    created_by: UUID
    expires_at: datetime | None = None
    created_at: datetime
