"""Profile protein-powder details (per-scoop label values) and how each lab report was read.

Revision ID: 0003_protein_powder_lab_method
Revises: 0002_machine_learning
Create Date: 2026-10-27
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_protein_powder_lab_method"
down_revision: str | None = "0002_machine_learning"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCOOP_COLUMNS = ("scoop_size_g", "protein_per_scoop_g", "calories_per_scoop", "carbs_per_scoop_g", "fat_per_scoop_g")


def upgrade() -> None:
    with op.batch_alter_table("medical_reports") as batch:
        batch.add_column(sa.Column("extraction_method", sa.String(20), nullable=True))

    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("protein_supplement_name", sa.String(120), nullable=True))
        batch.add_column(sa.Column("protein_supplement_type", sa.String(20), nullable=True))
        for column in SCOOP_COLUMNS:
            batch.add_column(sa.Column(column, sa.Float(), nullable=True))

    # Existing profiles get the baseline whey (33 g scoop: 24.5 g protein, 125 kcal, 2.5 g carbs, 1.5 g fat).
    op.execute(
        "UPDATE users SET protein_supplement_name = 'Whey protein', protein_supplement_type = 'whey_concentrate', "
        "scoop_size_g = 33, protein_per_scoop_g = 24.5, calories_per_scoop = 125, carbs_per_scoop_g = 2.5, "
        "fat_per_scoop_g = 1.5 WHERE protein_supplement_name IS NULL"
    )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        for column in ("protein_supplement_name", "protein_supplement_type", *SCOOP_COLUMNS):
            batch.drop_column(column)
    with op.batch_alter_table("medical_reports") as batch:
        batch.drop_column("extraction_method")
