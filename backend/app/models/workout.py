from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, TimestampMixin


class WorkoutSession(TimestampMixin, Base):
    """A resistance-training block. Its calories are computed ONCE for the whole block
    (anti-double-counting): exercises inside it never carry their own calories."""

    __tablename__ = "workout_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    daily_summary_id: Mapped[int] = mapped_column(ForeignKey("daily_summaries.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    split: Mapped[str] = mapped_column(String(20), default="other")
    lifting_duration_min: Mapped[float | None] = mapped_column(Float)
    lifting_met: Mapped[float] = mapped_column(Float, default=4.0)
    session_rpe: Mapped[float | None] = mapped_column(Float)  # 1-10, for training load
    estimated_calories: Mapped[float] = mapped_column(Float, default=0)
    started_at: Mapped[str | None] = mapped_column(String(5))
    notes: Mapped[str | None] = mapped_column(Text)


class WorkoutLog(TimestampMixin, Base):
    """A single cardio bout (has calories) or strength exercise (calories = 0)."""

    __tablename__ = "workout_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    daily_summary_id: Mapped[int] = mapped_column(ForeignKey("daily_summaries.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("workout_sessions.id", ondelete="SET NULL"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    workout_type: Mapped[str] = mapped_column(String(20))  # "cardio" | "strength"
    exercise_name: Mapped[str] = mapped_column(String(120))
    target_muscle: Mapped[str | None] = mapped_column(String(80))
    sets: Mapped[int | None] = mapped_column(Integer)
    reps: Mapped[str | None] = mapped_column(String(20))
    weight_kg: Mapped[float | None] = mapped_column(Float)
    sets_json: Mapped[list] = mapped_column(JSONType, default=list)
    cardio_duration_min: Mapped[float | None] = mapped_column(Float)
    lifting_duration_min: Mapped[float | None] = mapped_column(Float)
    estimated_calories: Mapped[float] = mapped_column(Float, default=0)
    met_value: Mapped[float | None] = mapped_column(Float)
    rpe: Mapped[str | None] = mapped_column(String(10))
    notes: Mapped[str | None] = mapped_column(Text)
