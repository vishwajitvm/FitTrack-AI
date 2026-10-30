"""Presets: saved workout routines and meals for one-tap logging.

Revision ID: 0004_presets
Revises: 0003_protein_powder_lab_method
Create Date: 2026-10-27
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_presets"
down_revision: str | None = "0003_protein_powder_lab_method"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "presets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("icon", sa.String(40)),
        sa.Column("color", sa.String(20)),
        sa.Column("split", sa.String(20)),
        sa.Column("meal_type", sa.String(20)),
        sa.Column("payload", JSON, nullable=False),
        sa.Column("use_count", sa.Integer(), nullable=False),
        sa.Column("last_used_at", TS),
        sa.Column("created_at", TS, nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_presets")),
    )
    op.create_index(op.f("ix_presets_kind"), "presets", ["kind"])


def downgrade() -> None:
    op.drop_table("presets")
