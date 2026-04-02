"""Checklist template models: templates, template items, project checklists, project checklist items, categories."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from packages.common.db.base import Base, TimestampMixin, UUIDMixin


class ChecklistTemplate(Base, UUIDMixin, TimestampMixin):
    """A reusable checklist template (e.g., 'GTM checklist for SaaS v1')."""

    __tablename__ = "checklist_templates"

    name: Mapped[str] = mapped_column(String, nullable=False)
    template_type: Mapped[str] = mapped_column(String, nullable=False)  # gtm, qa, development, or custom
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True
    )

    items: Mapped[list["ChecklistTemplateItem"]] = relationship(
        "ChecklistTemplateItem",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="ChecklistTemplateItem.sort_order",
        lazy="selectin",
    )


class ChecklistTemplateItem(Base, UUIDMixin, TimestampMixin):
    """An item within a checklist template."""

    __tablename__ = "checklist_template_items"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("checklist_templates.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, default="general")
    default_status: Mapped[str] = mapped_column(String, default="new")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    template: Mapped["ChecklistTemplate"] = relationship(
        "ChecklistTemplate", back_populates="items",
    )


class ProjectChecklist(Base, UUIDMixin, TimestampMixin):
    """An applied checklist instance on a project."""

    __tablename__ = "project_checklists"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True,
    )
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("checklist_templates.id"), nullable=True,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    checklist_type: Mapped[str] = mapped_column(String, nullable=False)  # gtm, qa, development, or custom
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True,
    )

    items: Mapped[list["ProjectChecklistItem"]] = relationship(
        "ProjectChecklistItem",
        back_populates="checklist",
        cascade="all, delete-orphan",
        order_by="ProjectChecklistItem.sort_order",
        lazy="selectin",
    )


class ProjectChecklistItem(Base, UUIDMixin, TimestampMixin):
    """An individual checklist item applied to a project."""

    __tablename__ = "project_checklist_items"

    checklist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_checklists.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, default="general")
    status: Mapped[str] = mapped_column(String, default="new")  # new, in_progress, in_review, approved, complete
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True,
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    source_template_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("checklist_template_items.id"), nullable=True,
    )

    checklist: Mapped["ProjectChecklist"] = relationship(
        "ProjectChecklist", back_populates="items",
    )
    assignee: Mapped[Optional["Profile"]] = relationship(
        "Profile", foreign_keys=[assignee_id], lazy="selectin",
    )


class ChecklistCategory(Base, UUIDMixin):
    """Dynamic user-created categories for checklist items."""

    __tablename__ = "checklist_categories"

    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
