"""add engine column to backtests

Revision ID: d42caf556b3d
Revises: 98a5c8489cca
Create Date: 2026-05-22 23:40:18.794249

Why this migration:
  We're adding a `engine` discriminator column so the frontend knows which
  schema/renderer to apply for each backtest row. Existing rows are all from
  the manual-upload path → backfilled to 'manual'. New VAM-engine rows will
  set engine='vam'.

Safety:
  * Uses server_default='manual' so the column can be NOT NULL even on a
    table that already has rows — Postgres backfills atomically.
  * Adds the CHECK constraint after the column exists.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d42caf556b3d"
down_revision: Union[str, None] = "98a5c8489cca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: add the column with a server-side default so existing rows backfill.
    op.add_column(
        "backtests",
        sa.Column(
            "engine",
            sa.String(length=20),
            nullable=False,
            server_default="manual",
        ),
    )

    # Step 2: enforce the enum at the DB level so a buggy code path can't write
    # an unexpected value (e.g. "vam_v2") without a migration first.
    op.create_check_constraint(
        "backtest_engine_valid",
        "backtests",
        "engine IN ('manual','vam')",
    )

    # Step 3 (optional): keep the server_default — harmless, and means if any
    # ORM caller forgets to set engine, it still falls back to 'manual'. We
    # leave it in place.


def downgrade() -> None:
    op.drop_constraint("backtest_engine_valid", "backtests", type_="check")
    op.drop_column("backtests", "engine")
