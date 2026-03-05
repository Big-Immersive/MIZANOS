"""add_verification_criteria_to_tasks

Revision ID: decfe5e43292
Revises: 1fae329886d6
Create Date: 2026-02-27 14:31:34.723273
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'decfe5e43292'
down_revision: Union[str, None] = '1fae329886d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('verification_criteria', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'verification_criteria')
