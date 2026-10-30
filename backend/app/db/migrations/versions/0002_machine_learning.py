"""Machine learning: personal meal memory, portion calibration, semantic & image embeddings, session RPE.

Revision ID: 0002_machine_learning
Revises: 0001_initial_schema
Create Date: 2026-10-27
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_machine_learning"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
TS = sa.DateTime(timezone=True)
SEMANTIC_DIM = 768


def _vector_type():
    """vector(768) when the pgvector extension is installed, JSON otherwise."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        installed = bind.execute(sa.text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).first()
        if installed:
            from pgvector.sqlalchemy import Vector

            return Vector(SEMANTIC_DIM)
    return JSON


def upgrade() -> None:
    vector = _vector_type()

    with op.batch_alter_table("food_library") as batch:
        batch.add_column(sa.Column("semantic_embedding", vector, nullable=True))

    with op.batch_alter_table("food_analyses") as batch:
        batch.add_column(sa.Column("phash", sa.String(16), nullable=True))
        batch.add_column(sa.Column("image_embedding", vector, nullable=True))
    op.create_index(op.f("ix_food_analyses_phash"), "food_analyses", ["phash"])

    with op.batch_alter_table("workout_sessions") as batch:
        batch.add_column(sa.Column("session_rpe", sa.Float(), nullable=True))

    op.create_table(
        "meal_memories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("analysis_id", sa.Integer()),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("image_url", sa.String(300)),
        sa.Column("container_id", sa.String(40)),
        sa.Column("items_json", JSON, nullable=False),
        sa.Column("calories", sa.Float(), nullable=False),
        sa.Column("weight_grams", sa.Float()),
        sa.Column("image_embedding", vector, nullable=False),
        sa.ForeignKeyConstraint(
            ["analysis_id"], ["food_analyses.id"], name=op.f("fk_meal_memories_analysis_id_food_analyses"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_meal_memories")),
    )
    op.create_index(op.f("ix_meal_memories_analysis_id"), "meal_memories", ["analysis_id"])
    op.create_index(op.f("ix_meal_memories_date"), "meal_memories", ["date"])

    op.create_table(
        "portion_calibrations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("container_id", sa.String(40), nullable=False),
        sa.Column("food_category", sa.String(40), nullable=False),
        sa.Column("samples", sa.Integer(), nullable=False),
        sa.Column("mean_log_ratio", sa.Float(), nullable=False),
        sa.Column("updated_at", TS, nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portion_calibrations")),
        sa.UniqueConstraint("container_id", "food_category", name="uq_portion_calibrations_container_category"),
    )


def downgrade() -> None:
    op.drop_table("portion_calibrations")
    op.drop_table("meal_memories")
    with op.batch_alter_table("workout_sessions") as batch:
        batch.drop_column("session_rpe")
    op.drop_index(op.f("ix_food_analyses_phash"), table_name="food_analyses")
    with op.batch_alter_table("food_analyses") as batch:
        batch.drop_column("image_embedding")
        batch.drop_column("phash")
    with op.batch_alter_table("food_library") as batch:
        batch.drop_column("semantic_embedding")
