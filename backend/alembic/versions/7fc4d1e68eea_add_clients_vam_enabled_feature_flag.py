"""add clients.vam_enabled feature flag

Revision ID: 7fc4d1e68eea
Revises: d42caf556b3d
Create Date: 2026-05-23 01:08:34.701849

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7fc4d1e68eea'
down_revision: Union[str, None] = 'd42caf556b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default=false backfills existing rows so the NOT NULL constraint passes
    # without an explicit backfill step. We keep the DB default in place so any future
    # row missing the column (e.g. raw INSERT) still gets a safe value.
    op.add_column(
        'clients',
        sa.Column('vam_enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('clients', 'vam_enabled')
