"""Dashboard daily brief: one cached message per day, regenerated only when that day's logs change.

Revision ID: 0006_daily_briefs
Revises: 0005_assistant_messages
Create Date: 2026-10-30 09:10:00.000000+00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0006_daily_briefs'
down_revision: str | None = '0005_assistant_messages'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('daily_briefs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('fingerprint', sa.String(length=64), nullable=False),
    sa.Column('payload', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('source', sa.String(length=120), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_daily_briefs')),
    sa.UniqueConstraint('date', name=op.f('uq_daily_briefs_date'))
    )


def downgrade() -> None:
    op.drop_table('daily_briefs')
