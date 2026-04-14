"""Milestone schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class MilestoneCreate(BaseModel):
    title: str
    description: str | None = None
    status: str = "backlog"
    priority: str = "medium"
    pillar: str = "development"
    assignee_id: UUID | None = None
    assignee_ids: list[str] | None = None
    due_date: datetime | None = None
    created_at: datetime | None = None


class MilestoneUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    pillar: str | None = None
    assignee_id: UUID | None = None
    assignee_ids: list[str] | None = None
    sort_order: int | None = None
    due_date: datetime | None = None
    created_at: datetime | None = None


class MilestoneResponse(BaseModel):
    id: UUID
    product_id: UUID
    title: str
    description: str | None
    status: str | None
    priority: str | None
    pillar: str | None
    assignee_id: UUID | None
    assignee_ids: list[str] | None = None
    sort_order: int
    is_default: bool
    due_date: datetime | None = None
    task_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
