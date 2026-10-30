"""Initial schema: profile, daily tracker, food, workouts, bio-feedback, medical, AI routing.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-10-27
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
TS = sa.DateTime(timezone=True)


def _timestamps() -> list[sa.Column]:
    return [sa.Column("created_at", TS, nullable=False), sa.Column("updated_at", TS, nullable=False)]


def _embedding_column() -> sa.Column:
    """vector(256) when pgvector is installable, JSON otherwise (plain Postgres / SQLite)."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        available = bind.execute(sa.text("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'")).first()
        if available:
            op.execute("CREATE EXTENSION IF NOT EXISTS vector")
            from pgvector.sqlalchemy import Vector

            return sa.Column("embedding", Vector(256), nullable=True)
    return sa.Column("embedding", JSON, nullable=True)


def upgrade() -> None:
    # ---------------------------------------------------------------- users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(120)),
        sa.Column("age", sa.Integer()),
        sa.Column("sex", sa.String(10)),
        sa.Column("height_cm", sa.Float(), nullable=False),
        sa.Column("starting_weight", sa.Float(), nullable=False),
        sa.Column("current_weight", sa.Float()),
        sa.Column("goal", sa.Text()),
        sa.Column("target_weight_kg", sa.Float()),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("weekly_rate_kg", sa.Float()),
        sa.Column("activity_level", sa.String(20)),
        sa.Column("avg_daily_steps", sa.Integer()),
        sa.Column("body_fat_pct", sa.Float()),
        sa.Column("waist_cm", sa.Float()),
        sa.Column("neck_cm", sa.Float()),
        sa.Column("hip_cm", sa.Float()),
        sa.Column("diet_type", sa.String(20)),
        sa.Column("allergies", JSON, nullable=False),
        sa.Column("intolerances", JSON, nullable=False),
        sa.Column("medical_conditions", JSON, nullable=False),
        sa.Column("medications", JSON, nullable=False),
        sa.Column("supplements", JSON, nullable=False),
        sa.Column("training_split", sa.String(200)),
        sa.Column("training_experience", sa.String(20)),
        sa.Column("rest_day", sa.String(10), nullable=False),
        sa.Column("wake_time", sa.String(5)),
        sa.Column("gym_start_time", sa.String(5)),
        sa.Column("gym_return_time", sa.String(5)),
        sa.Column("bedtime", sa.String(5)),
        sa.Column("protein_target_g_per_kg", sa.Float(), nullable=False),
        sa.Column("water_target_ml", sa.Integer()),
        sa.Column("sleep_target_hours", sa.Float()),
        sa.Column("preferred_cuisine", sa.String(120)),
        sa.Column("timezone", sa.String(60)),
        sa.Column("notes", sa.Text()),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )

    # ------------------------------------------------------ daily_summaries
    op.create_table(
        "daily_summaries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("day_number", sa.Integer(), nullable=False),
        sa.Column("morning_weight", sa.Float()),
        sa.Column("total_calories", sa.Float(), nullable=False),
        sa.Column("total_protein", sa.Float(), nullable=False),
        sa.Column("total_carbs", sa.Float(), nullable=False),
        sa.Column("total_fat", sa.Float(), nullable=False),
        sa.Column("total_fibre", sa.Float(), nullable=False),
        sa.Column("estimated_exercise_calories", sa.Float(), nullable=False),
        sa.Column("estimated_tdee", sa.Float()),
        sa.Column("calorie_deficit", sa.Float()),
        sa.Column("readiness_score", sa.Integer()),
        sa.Column("energy_level", sa.Integer()),
        sa.Column("sleep_hours", sa.Float()),
        sa.Column("sleep_quality", sa.Integer()),
        sa.Column("bloating_status", sa.String(10)),
        sa.Column("soreness_notes", sa.Text()),
        sa.Column("soreness_muscles", JSON, nullable=False),
        sa.Column("steps", sa.Integer()),
        sa.Column("water_ml", sa.Integer()),
        sa.Column("mood", sa.Integer()),
        sa.Column("stress", sa.Integer()),
        sa.Column("notes", sa.Text()),
        sa.Column("coach_advice", sa.Text()),
        sa.Column("coach_advice_source", sa.String(120)),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_daily_summaries_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_daily_summaries")),
        sa.UniqueConstraint("user_id", "date", name="uq_daily_summaries_user_date"),
    )
    op.create_index(op.f("ix_daily_summaries_user_id"), "daily_summaries", ["user_id"])
    op.create_index(op.f("ix_daily_summaries_date"), "daily_summaries", ["date"])

    # -------------------------------------------------------- food_analyses
    op.create_table(
        "food_analyses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("image_path", sa.String(300)),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error", sa.Text()),
        sa.Column("input_json", JSON, nullable=False),
        sa.Column("result_json", JSON, nullable=False),
        sa.Column("saved", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_food_analyses")),
    )

    # ------------------------------------------------------------ food_logs
    op.create_table(
        "food_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("daily_summary_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("meal_type", sa.String(20), nullable=False),
        sa.Column("time", sa.String(5)),
        sa.Column("timestamp", TS, nullable=False),
        sa.Column("food_name", sa.String(200), nullable=False),
        sa.Column("ingredients_json", JSON, nullable=False),
        sa.Column("quantity", sa.Float()),
        sa.Column("portion_unit", sa.String(40)),
        sa.Column("weight_grams", sa.Float()),
        sa.Column("calories", sa.Float(), nullable=False),
        sa.Column("protein", sa.Float(), nullable=False),
        sa.Column("carbs", sa.Float(), nullable=False),
        sa.Column("fat", sa.Float(), nullable=False),
        sa.Column("fibre", sa.Float(), nullable=False),
        sa.Column("calories_low", sa.Float()),
        sa.Column("calories_high", sa.Float()),
        sa.Column("confidence_score", sa.Float()),
        sa.Column("research_source", sa.String(300)),
        sa.Column("image_url", sa.String(300)),
        sa.Column("tags", JSON, nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("analysis_id", sa.Integer()),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["daily_summary_id"],
            ["daily_summaries.id"],
            name=op.f("fk_food_logs_daily_summary_id_daily_summaries"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["analysis_id"], ["food_analyses.id"], name=op.f("fk_food_logs_analysis_id_food_analyses"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_food_logs")),
    )
    op.create_index(op.f("ix_food_logs_daily_summary_id"), "food_logs", ["daily_summary_id"])
    op.create_index(op.f("ix_food_logs_date"), "food_logs", ["date"])

    # --------------------------------------------------------- food_library
    op.create_table(
        "food_library",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("aliases", JSON, nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("calories", sa.Float(), nullable=False),
        sa.Column("protein", sa.Float(), nullable=False),
        sa.Column("carbs", sa.Float(), nullable=False),
        sa.Column("fat", sa.Float(), nullable=False),
        sa.Column("fibre", sa.Float(), nullable=False),
        sa.Column("density_g_per_ml", sa.Float()),
        sa.Column("serving_hint", sa.String(120)),
        sa.Column("tags", JSON, nullable=False),
        sa.Column("source", sa.String(120), nullable=False),
        _embedding_column(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_food_library")),
    )
    op.create_index(op.f("ix_food_library_name"), "food_library", ["name"])

    # ----------------------------------------------------- workout_sessions
    op.create_table(
        "workout_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("daily_summary_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("split", sa.String(20), nullable=False),
        sa.Column("lifting_duration_min", sa.Float()),
        sa.Column("lifting_met", sa.Float(), nullable=False),
        sa.Column("estimated_calories", sa.Float(), nullable=False),
        sa.Column("started_at", sa.String(5)),
        sa.Column("notes", sa.Text()),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["daily_summary_id"],
            ["daily_summaries.id"],
            name=op.f("fk_workout_sessions_daily_summary_id_daily_summaries"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workout_sessions")),
    )
    op.create_index(op.f("ix_workout_sessions_daily_summary_id"), "workout_sessions", ["daily_summary_id"])
    op.create_index(op.f("ix_workout_sessions_date"), "workout_sessions", ["date"])

    # --------------------------------------------------------- workout_logs
    op.create_table(
        "workout_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("daily_summary_id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer()),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("workout_type", sa.String(20), nullable=False),
        sa.Column("exercise_name", sa.String(120), nullable=False),
        sa.Column("target_muscle", sa.String(80)),
        sa.Column("sets", sa.Integer()),
        sa.Column("reps", sa.String(20)),
        sa.Column("weight_kg", sa.Float()),
        sa.Column("sets_json", JSON, nullable=False),
        sa.Column("cardio_duration_min", sa.Float()),
        sa.Column("lifting_duration_min", sa.Float()),
        sa.Column("estimated_calories", sa.Float(), nullable=False),
        sa.Column("met_value", sa.Float()),
        sa.Column("rpe", sa.String(10)),
        sa.Column("notes", sa.Text()),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["daily_summary_id"],
            ["daily_summaries.id"],
            name=op.f("fk_workout_logs_daily_summary_id_daily_summaries"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["workout_sessions.id"],
            name=op.f("fk_workout_logs_session_id_workout_sessions"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workout_logs")),
    )
    op.create_index(op.f("ix_workout_logs_daily_summary_id"), "workout_logs", ["daily_summary_id"])
    op.create_index(op.f("ix_workout_logs_session_id"), "workout_logs", ["session_id"])
    op.create_index(op.f("ix_workout_logs_date"), "workout_logs", ["date"])

    # --------------------------------------------------------- bio_feedback
    op.create_table(
        "bio_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("timestamp", TS, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("symptom_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.Integer(), nullable=False),
        sa.Column("trigger_suspect", sa.String(200)),
        sa.Column("body_part", sa.String(80)),
        sa.Column("notes", sa.Text()),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_bio_feedback_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_bio_feedback")),
    )
    op.create_index(op.f("ix_bio_feedback_user_id"), "bio_feedback", ["user_id"])
    op.create_index(op.f("ix_bio_feedback_date"), "bio_feedback", ["date"])

    # ------------------------------------------------------ medical_reports
    op.create_table(
        "medical_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("report_date", sa.Date()),
        sa.Column("report_type", sa.String(80)),
        sa.Column("lab_name", sa.String(120)),
        sa.Column("file_path", sa.String(300)),
        sa.Column("file_name", sa.String(200)),
        sa.Column("mime_type", sa.String(80)),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("extracted_text", sa.Text()),
        sa.Column("summary", sa.Text()),
        sa.Column("nutrition_implications", JSON, nullable=False),
        sa.Column("training_implications", JSON, nullable=False),
        sa.Column("flags", JSON, nullable=False),
        sa.Column("provider", sa.String(60)),
        sa.Column("model", sa.String(160)),
        sa.Column("notes", sa.Text()),
        sa.Column("error", sa.Text()),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_medical_reports_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_medical_reports")),
    )
    op.create_index(op.f("ix_medical_reports_user_id"), "medical_reports", ["user_id"])

    # ----------------------------------------------------------- biomarkers
    op.create_table(
        "biomarkers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("report_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("category", sa.String(60)),
        sa.Column("value", sa.Float()),
        sa.Column("value_text", sa.String(80)),
        sa.Column("unit", sa.String(40)),
        sa.Column("ref_low", sa.Float()),
        sa.Column("ref_high", sa.Float()),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.ForeignKeyConstraint(
            ["report_id"], ["medical_reports.id"], name=op.f("fk_biomarkers_report_id_medical_reports"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_biomarkers")),
    )
    op.create_index(op.f("ix_biomarkers_report_id"), "biomarkers", ["report_id"])

    # ---------------------------------------------------- AI provider state
    op.create_table(
        "ai_providers",
        sa.Column("id", sa.String(40), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("base_url_override", sa.String(300)),
        sa.Column("api_key_encrypted", sa.Text()),
        sa.Column("extra", JSON, nullable=False),
        sa.Column("last_status", sa.String(20)),
        sa.Column("last_error", sa.Text()),
        sa.Column("last_checked_at", TS),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_providers")),
    )
    op.create_table(
        "ai_models",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("provider_id", sa.String(40), nullable=False),
        sa.Column("model_id", sa.String(200), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("capabilities", JSON, nullable=False),
        sa.Column("context_window", sa.Integer()),
        sa.Column("free", sa.Boolean(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("custom", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["provider_id"], ["ai_providers.id"], name=op.f("fk_ai_models_provider_id_ai_providers"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_models")),
        sa.UniqueConstraint("provider_id", "model_id", name="uq_ai_models_provider_model"),
    )
    op.create_index(op.f("ix_ai_models_provider_id"), "ai_models", ["provider_id"])

    op.create_table(
        "llm_call_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("task", sa.String(30), nullable=False),
        sa.Column("provider_id", sa.String(40), nullable=False),
        sa.Column("model_id", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("latency_ms", sa.Float()),
        sa.Column("error", sa.Text()),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_llm_call_logs")),
    )
    op.create_index(op.f("ix_llm_call_logs_created_at"), "llm_call_logs", ["created_at"])

    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(80), nullable=False),
        sa.Column("value", JSON, nullable=False),
        sa.Column("updated_at", TS, nullable=False),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_app_settings")),
    )


def downgrade() -> None:
    for table in (
        "app_settings",
        "llm_call_logs",
        "ai_models",
        "ai_providers",
        "biomarkers",
        "medical_reports",
        "bio_feedback",
        "workout_logs",
        "workout_sessions",
        "food_library",
        "food_logs",
        "food_analyses",
        "daily_summaries",
        "users",
    ):
        op.drop_table(table)
