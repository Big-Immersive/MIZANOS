"""add parent_id to tasks

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-03-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "b4c5d6e7f8a9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True),
    )
    op.create_index("ix_tasks_parent_id", "tasks", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_parent_id", table_name="tasks")
    op.drop_column("tasks", "parent_id")
