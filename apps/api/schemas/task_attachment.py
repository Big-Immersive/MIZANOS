"""Task attachment schemas."""

from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TaskAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    file_name: str
    file_path: str
    file_type: str
    file_size: int
    uploaded_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
