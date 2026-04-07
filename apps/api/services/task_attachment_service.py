"""Task attachment service — upload, list, delete."""

from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.models.task_attachment import TaskAttachment
from packages.common.utils.error_handlers import not_found


class TaskAttachmentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upload(
        self, task_id: UUID, file: UploadFile, uploaded_by: UUID | None = None
    ) -> TaskAttachment:
        from apps.api.services.gcs_storage_service import GCSStorageService

        content = await file.read()
        raw_name = file.filename or "untitled"
        filename = raw_name.replace(" ", "_")
        content_type = file.content_type or "application/octet-stream"

        storage = GCSStorageService()
        destination = f"bug-attachments/{task_id}/{filename}"
        file_path = await storage.upload_file(content, destination, content_type)

        attachment = TaskAttachment(
            task_id=task_id,
            file_name=filename,
            file_path=file_path,
            file_type=content_type,
            file_size=len(content),
            uploaded_by=uploaded_by,
        )
        self.session.add(attachment)
        await self.session.flush()
        await self.session.refresh(attachment)
        return attachment

    async def list_by_task(self, task_id: UUID) -> list[TaskAttachment]:
        stmt = (
            select(TaskAttachment)
            .where(TaskAttachment.task_id == task_id)
            .order_by(TaskAttachment.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def delete(self, attachment_id: UUID) -> None:
        attachment = await self.session.get(TaskAttachment, attachment_id)
        if not attachment:
            not_found("Attachment")
        await self.session.delete(attachment)
        await self.session.flush()
