"""add product_links table

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-03-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "c5d6e7f8a9b0"
down_revision: str = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS for safety (table may already exist on dev)
    op.execute("""
        CREATE TABLE IF NOT EXISTS product_links (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID NOT NULL REFERENCES products(id),
            name VARCHAR NOT NULL,
            url VARCHAR NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_links_product_id ON product_links(product_id)")


def downgrade() -> None:
    op.drop_index("ix_product_links_product_id")
    op.drop_table("product_links")
