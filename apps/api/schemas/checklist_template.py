"""Checklist template schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# --- Template schemas ---

class ChecklistTemplateCreate(BaseModel):
    name: str
    template_type: str
    description: str | None = None
    is_active: bool = True


class ChecklistTemplateUpdate(BaseModel):
    name: str | None = None
    template_type: str | None = None
    description: str | None = None
    is_active: bool | None = None


class ChecklistTemplateItemCreate(BaseModel):
    title: str
    category: str = "general"
    default_status: str = "new"
    sort_order: int = 0


class ChecklistTemplateItemUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    default_status: str | None = None
    sort_order: int | None = None


class ChecklistTemplateItemResponse(BaseModel):
    id: UUID
    template_id: UUID
    title: str
    category: str
    default_status: str
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ChecklistTemplateResponse(BaseModel):
    id: UUID
    name: str
    template_type: str
    description: str | None
    is_active: bool
    created_by: UUID | None
    item_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChecklistTemplateDetailResponse(ChecklistTemplateResponse):
    items: list[ChecklistTemplateItemResponse] = []


# --- Project checklist schemas ---

class ProjectChecklistItemResponse(BaseModel):
    id: UUID
    checklist_id: UUID
    product_id: UUID
    title: str
    category: str
    status: str
    assignee_id: UUID | None
    assignee_name: str | None = None
    due_date: datetime | None
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectChecklistResponse(BaseModel):
    id: UUID
    product_id: UUID
    template_id: UUID | None
    name: str
    checklist_type: str
    created_by: UUID | None
    item_count: int = 0
    completed_count: int = 0
    items: list[ProjectChecklistItemResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectChecklistItemUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    status: str | None = None
    assignee_id: UUID | None = None
    due_date: datetime | None = None
    sort_order: int | None = None


class ProjectChecklistItemCreate(BaseModel):
    title: str
    category: str = "general"
    assignee_id: UUID | None = None
    due_date: datetime | None = None


class ApplyTemplateRequest(BaseModel):
    product_id: UUID


# --- Category schemas ---

class ChecklistCategoryResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChecklistCategoryCreate(BaseModel):
    name: str
