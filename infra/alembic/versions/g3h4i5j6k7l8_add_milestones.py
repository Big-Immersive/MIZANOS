"""Add milestones table and milestone_id to tasks.

Revision ID: g3h4i5j6k7l8
Revises: f2a3b4c5d6e7
Create Date: 2026-04-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "g3h4i5j6k7l8"
down_revision: str = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "milestones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False, index=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("status", sa.String, nullable=True, server_default="backlog"),
        sa.Column("priority", sa.String, nullable=True, server_default="medium"),
        sa.Column("pillar", sa.String, nullable=True, server_default="development"),
        sa.Column("assignee_id", UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=True),
        sa.Column("assignee_ids", JSONB, server_default=sa.text("'[]'"), nullable=True),
        sa.Column("sort_order", sa.Integer, server_default=sa.text("0"), nullable=False),
        sa.Column("is_default", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.add_column("tasks", sa.Column("milestone_id", UUID(as_uuid=True), sa.ForeignKey("milestones.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_tasks_milestone_id", "tasks", ["milestone_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_milestone_id", table_name="tasks")
    op.drop_column("tasks", "milestone_id")
    op.drop_table("milestones")
