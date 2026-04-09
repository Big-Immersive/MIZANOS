"""Product-related models: products, members, environments, documents, notes."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from packages.common.db.base import Base, TimestampMixin, UUIDMixin


class Product(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    stage: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pillar: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    progress: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    health_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    repository_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    github_pat_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("github_pats.id"), nullable=True
    )
    github_repo_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    github_repo_error: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tracked_branch: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    lovable_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True
    )
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    start_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    end_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    tasks_locked: Mapped[bool] = mapped_column(
        Boolean, server_default="false", nullable=False
    )

    creator: Mapped[Optional["Profile"]] = relationship(
        "Profile", foreign_keys=[created_by], lazy="selectin"
    )

    @property
    def created_by_name(self) -> str | None:
        return self.creator.full_name if self.creator else None


class ProductMember(Base, UUIDMixin):
    __tablename__ = "product_members"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    role: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    profile: Mapped["Profile"] = relationship(
        "Profile", foreign_keys=[profile_id], lazy="selectin"
    )


class ProductEnvironment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "product_environments"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    environment_type: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    branch: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")
    target_domain: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    railway_project_url: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )
    railway_toml_present: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    last_deployment_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ProductLink(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "product_links"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, nullable=False)


class ProductDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "product_documents"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    folder_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_folders.id"), nullable=True
    )
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    summary_generated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ProductManagementNote(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "product_management_notes"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(String, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)


class ProductPartnerNote(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "product_partner_notes"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False
    )
    partner_name: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)


class ProductNotificationSetting(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "product_notification_settings"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
