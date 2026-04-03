"""Milestone model — grouping layer for tasks within a project."""

import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from packages.common.db.base import Base, TimestampMixin, UUIDMixin


class Milestone(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "milestones"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="backlog")
    priority: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="medium")
    pillar: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="development")
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True,
    )
    assignee_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
