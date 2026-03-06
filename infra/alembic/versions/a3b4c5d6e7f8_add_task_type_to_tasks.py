"""add_task_type_to_tasks

Revision ID: a3b4c5d6e7f8
Revises: decfe5e43292
Create Date: 2026-03-07 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "decfe5e43292"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("task_type", sa.String(), nullable=False, server_default="task"),
    )
    op.create_index("ix_tasks_product_id_task_type", "tasks", ["product_id", "task_type"])


def downgrade() -> None:
    op.drop_index("ix_tasks_product_id_task_type", table_name="tasks")
    op.drop_column("tasks", "task_type")
