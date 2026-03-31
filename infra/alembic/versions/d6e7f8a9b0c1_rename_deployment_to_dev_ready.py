"""rename Deployment to Dev Ready in product stages

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-03-31
"""

from alembic import op

revision: str = "d6e7f8a9b0c1"
down_revision: str = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE products SET stage = 'Dev Ready' WHERE stage = 'Deployment'")


def downgrade() -> None:
    op.execute("UPDATE products SET stage = 'Deployment' WHERE stage = 'Dev Ready'")
