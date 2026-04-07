"""Task attachment endpoints — upload, list, delete."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response

from apps.api.dependencies import CurrentUser, DbSession
from apps.api.schemas.task_attachment import TaskAttachmentResponse
from apps.api.services.task_attachment_service import TaskAttachmentService

router = APIRouter()


def _get_service(db: DbSession) -> TaskAttachmentService:
    return TaskAttachmentService(db)


@router.post("/upload/{task_id}", response_model=TaskAttachmentResponse)
async def upload_attachment(
    task_id: UUID,
    file: UploadFile = File(...),
    user: CurrentUser = None,
    service: TaskAttachmentService = Depends(_get_service),
):
    """Upload a file attachment to a task/bug."""
    profile_id = user.profile_id if user else None
    return await service.upload(task_id, file, profile_id)


@router.get("/{task_id}", response_model=list[TaskAttachmentResponse])
async def list_attachments(
    task_id: UUID,
    user: CurrentUser = None,
    service: TaskAttachmentService = Depends(_get_service),
):
    """List all attachments for a task/bug."""
    return await service.list_by_task(task_id)


@router.get("/download/{attachment_id}")
async def download_attachment(
    attachment_id: UUID,
    user: CurrentUser = None,
    service: TaskAttachmentService = Depends(_get_service),
):
    """Download/proxy a file attachment (handles private S3 buckets)."""
    content, filename, content_type = await service.download(attachment_id)
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.delete("/{attachment_id}")
async def delete_attachment(
    attachment_id: UUID,
    user: CurrentUser = None,
    service: TaskAttachmentService = Depends(_get_service),
):
    """Delete an attachment."""
    await service.delete(attachment_id)
    return {"ok": True}
