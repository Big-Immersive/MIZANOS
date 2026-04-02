"""Documents router."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.documents import (
    AccessLinkCreate,
    AccessLinkResponse,
    DocumentCreate,
    DocumentListResponse,
    DocumentResponse,
    FolderCreate,
    FolderResponse,
    SharedDocumentsResponse,
    VersionCreate,
    VersionResponse,
)
from apps.api.services.document_service import DocumentService

router = APIRouter()


def get_service(db: DbSession) -> DocumentService:
    return DocumentService(db)


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    product_id: UUID,
    page: int = 1,
    page_size: int = 50,
    user: CurrentUser = None,
    service: DocumentService = Depends(get_service),
):
    return await service.get_by_product(product_id, page=page, page_size=page_size)


@router.post("", response_model=DocumentResponse, status_code=201)
async def create_document(body: DocumentCreate, user: CurrentUser = None, service: DocumentService = Depends(get_service)):
    if not body.uploaded_by and user and user.profile_id:
        body.uploaded_by = user.profile_id
    return await service.create_document(body)


@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: UUID, user: CurrentUser = None, service: DocumentService = Depends(get_service)):
    await service.delete(doc_id)


@router.get("/folders", response_model=list[FolderResponse])
async def list_folders(product_id: UUID, user: CurrentUser = None, service: DocumentService = Depends(get_service)):
    return await service.get_folders(product_id)


@router.post("/folders", response_model=FolderResponse, status_code=201)
async def create_folder(body: FolderCreate, user: CurrentUser = None, service: DocumentService = Depends(get_service)):
    return await service.create_folder(body, user_id=user.profile_id if user else None)


@router.get("/access-links", response_model=list[AccessLinkResponse])
async def list_access_links(
    product_id: UUID,
    user: CurrentUser = None,
    service: DocumentService = Depends(get_service),
):
    return await service.get_access_links(product_id)


@router.post("/access-links", response_model=AccessLinkResponse, status_code=201)
async def create_access_link(body: AccessLinkCreate, user: CurrentUser = None, service: DocumentService = Depends(get_service)):
    return await service.create_access_link(body)


@router.delete("/access-links/{link_id}", status_code=204)
async def revoke_access_link(
    link_id: UUID,
    user: CurrentUser = None,
    service: DocumentService = Depends(get_service),
):
    await service.revoke_access_link(link_id)


@router.get("/{doc_id}/versions", response_model=list[VersionResponse])
async def list_versions(
    doc_id: UUID,
    user: CurrentUser = None,
    service: DocumentService = Depends(get_service),
):
    """List all versions of a document."""
    return await service.get_versions(doc_id)


@router.post(
    "/{doc_id}/versions",
    response_model=VersionResponse,
    status_code=201,
)
async def create_version(
    doc_id: UUID,
    body: VersionCreate,
    user: CurrentUser = None,
    service: DocumentService = Depends(get_service),
):
    """Create a new version for a document."""
    return await service.create_version(doc_id, body)


@router.post(
    "/versions/{version_id}/restore",
    response_model=VersionResponse,
)
async def restore_version(
    version_id: UUID,
    user: CurrentUser = None,
    service: DocumentService = Depends(get_service),
):
    """Restore a specific version as current."""
    return await service.restore_version(version_id)


@router.post("/{doc_id}/generate-summary", response_model=DocumentResponse)
async def generate_summary(doc_id: UUID, user: CurrentUser = None, service: DocumentService = Depends(get_service)):
    """Generate AI summary for a document (placeholder)."""
    return await service.generate_summary(doc_id)


@router.post("/upload/{product_id}", response_model=DocumentResponse, status_code=201)
async def upload_document(
    product_id: UUID,
    file: UploadFile = File(...),
    user: CurrentUser = None,
    service: DocumentService = Depends(get_service),
):
    """Upload a document file."""
    return await service.upload_document(product_id, file, user.profile_id if user else None)


@router.get("/shared/{token}", response_model=SharedDocumentsResponse)
async def get_shared_documents(token: str, service: DocumentService = Depends(get_service)):
    """Public endpoint: get documents by share token."""
    return await service.get_by_share_token(token)
