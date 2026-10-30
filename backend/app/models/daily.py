import datetime as dt
from datetime import date

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, TimestampMixin, utcnow


class DailySummary(TimestampMixin, Base):
    """One row per tracked day. Totals are recomputed from logs whenever the day changes."""

    __tablename__ = "daily_summaries"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_daily_summaries_user_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    day_number: Mapped[int] = mapped_column(Integer)
    morning_weight: Mapped[float | None] = mapped_column(Float)

    # cached totals (source of truth = food_logs / workout tables)
    total_calories: Mapped[float] = mapped_column(Float, default=0)
    total_protein: Mapped[float] = mapped_column(Float, default=0)
    total_carbs: Mapped[float] = mapped_column(Float, default=0)
    total_fat: Mapped[float] = mapped_column(Float, default=0)
    total_fibre: Mapped[float] = mapped_column(Float, default=0)
    estimated_exercise_calories: Mapped[float] = mapped_column(Float, default=0)
    estimated_tdee: Mapped[float | None] = mapped_column(Float)
    calorie_deficit: Mapped[float | None] = mapped_column(Float)

    # daily check-in / bio-feedback snapshot
    readiness_score: Mapped[int | None] = mapped_column(Integer)
    energy_level: Mapped[int | None] = mapped_column(Integer)
    sleep_hours: Mapped[float | None] = mapped_column(Float)
    sleep_quality: Mapped[int | None] = mapped_column(Integer)
    bloating_status: Mapped[str | None] = mapped_column(String(10))
    soreness_notes: Mapped[str | None] = mapped_column(Text)
    soreness_muscles: Mapped[list] = mapped_column(JSONType, default=list)
    steps: Mapped[int | None] = mapped_column(Integer)
    water_ml: Mapped[int | None] = mapped_column(Integer)
    mood: Mapped[int | None] = mapped_column(Integer)
    stress: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    coach_advice: Mapped[str | None] = mapped_column(Text)
    coach_advice_source: Mapped[str | None] = mapped_column(String(120))


class DailyBrief(Base):
    """The dashboard's "your day so far" message. Kept until the day's logs change (`fingerprint` of the inputs),
    so refreshing or restarting never regenerates it."""

    __tablename__ = "daily_briefs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[dt.date] = mapped_column(Date, unique=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    # headline, good, watch, next, tone (+ numbers/meta added when served)
    payload: Mapped[dict] = mapped_column(JSONType, default=dict)
    source: Mapped[str] = mapped_column(String(120))  # "provider/model" or "rules"
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
