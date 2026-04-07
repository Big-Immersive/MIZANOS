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

    async def download(self, attachment_id: UUID) -> tuple[bytes, str, str]:
        """Fetch file bytes from storage. Returns (content, filename, content_type)."""
        from pathlib import Path
        from apps.api.services.gcs_storage_service import GCSStorageService
        from apps.api.config import settings

        attachment = await self.session.get(TaskAttachment, attachment_id)
        if not attachment:
            not_found("Attachment")

        file_path = attachment.file_path
        storage = GCSStorageService()

        # S3 stored file
        if file_path.startswith("http") and storage.is_s3_available:
            prefix = f"{settings.aws_endpoint_url}/{settings.aws_s3_bucket_name}/"
            if file_path.startswith(prefix):
                s3_key = file_path[len(prefix):]
            else:
                parts = file_path.split(f"/{settings.aws_s3_bucket_name}/", 1)
                s3_key = parts[1] if len(parts) > 1 else file_path
            obj = storage._s3.get_object(Bucket=settings.aws_s3_bucket_name, Key=s3_key)
            return obj["Body"].read(), attachment.file_name, attachment.file_type

        # GCS stored file (gs://bucket/path)
        if file_path.startswith("gs://") and storage.is_gcs_available:
            gcs_path = file_path.replace(f"gs://{settings.gcs_bucket_name}/", "")
            bucket = storage._gcs.bucket(settings.gcs_bucket_name)
            blob = bucket.blob(gcs_path)
            return blob.download_as_bytes(), attachment.file_name, attachment.file_type

        # Local file fallback
        local = Path(file_path.lstrip("/"))
        if not local.exists():
            not_found("File")
        return local.read_bytes(), attachment.file_name, attachment.file_type

    async def delete(self, attachment_id: UUID) -> None:
        attachment = await self.session.get(TaskAttachment, attachment_id)
        if not attachment:
            not_found("Attachment")
        await self.session.delete(attachment)
        await self.session.flush()
