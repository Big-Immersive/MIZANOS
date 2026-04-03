"""Populate default milestones for existing products and assign orphan tasks.

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-04-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "h4i5j6k7l8m9"
down_revision: str = "g3h4i5j6k7l8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Get all products
    products = conn.execute(sa.text("SELECT id FROM products")).fetchall()

    for (product_id,) in products:
        # Check if a default milestone already exists
        existing = conn.execute(
            sa.text("SELECT id FROM milestones WHERE product_id = :pid AND is_default = true"),
            {"pid": product_id},
        ).fetchone()

        if existing:
            milestone_id = existing[0]
        else:
            # Create default "General" milestone
            result = conn.execute(
                sa.text(
                    "INSERT INTO milestones (product_id, title, description, is_default, sort_order, status) "
                    "VALUES (:pid, 'General', 'Default milestone for uncategorized tasks', true, 0, 'backlog') "
                    "RETURNING id"
                ),
                {"pid": product_id},
            )
            milestone_id = result.fetchone()[0]

        # Move all orphan tasks (milestone_id IS NULL) into the default milestone
        conn.execute(
            sa.text("UPDATE tasks SET milestone_id = :mid WHERE product_id = :pid AND milestone_id IS NULL"),
            {"mid": milestone_id, "pid": product_id},
        )


def downgrade() -> None:
    # Set all task milestone_ids to NULL
    op.execute("UPDATE tasks SET milestone_id = NULL")
    # Delete all milestones
    op.execute("DELETE FROM milestones")
