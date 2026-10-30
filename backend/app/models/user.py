from datetime import date

from sqlalchemy import Date, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, TimestampMixin


class User(TimestampMixin, Base):
    """The athlete profile. The app is single-user, so there is normally exactly one row (id=1)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # --- basic ---
    name: Mapped[str | None] = mapped_column(String(120))
    age: Mapped[int | None] = mapped_column(Integer)
    sex: Mapped[str | None] = mapped_column(String(10))  # "male" | "female"
    height_cm: Mapped[float] = mapped_column(Float, default=173.0)
    starting_weight: Mapped[float] = mapped_column(Float, default=94.5)
    current_weight: Mapped[float | None] = mapped_column(Float)
    goal: Mapped[str | None] = mapped_column(Text)
    target_weight_kg: Mapped[float | None] = mapped_column(Float)
    start_date: Mapped[date] = mapped_column(Date)

    # --- advanced: body & activity ---
    weekly_rate_kg: Mapped[float | None] = mapped_column(Float)
    activity_level: Mapped[str | None] = mapped_column(String(20))
    avg_daily_steps: Mapped[int | None] = mapped_column(Integer)
    body_fat_pct: Mapped[float | None] = mapped_column(Float)
    waist_cm: Mapped[float | None] = mapped_column(Float)
    neck_cm: Mapped[float | None] = mapped_column(Float)
    hip_cm: Mapped[float | None] = mapped_column(Float)

    # --- advanced: diet & health ---
    diet_type: Mapped[str | None] = mapped_column(String(20))
    allergies: Mapped[list] = mapped_column(JSONType, default=list)
    intolerances: Mapped[list] = mapped_column(JSONType, default=list)
    medical_conditions: Mapped[list] = mapped_column(JSONType, default=list)
    medications: Mapped[list] = mapped_column(JSONType, default=list)
    supplements: Mapped[list] = mapped_column(JSONType, default=list)

    # --- advanced: protein powder (used whenever you log "1 scoop") ---
    protein_supplement_name: Mapped[str | None] = mapped_column(String(120))
    protein_supplement_type: Mapped[str | None] = mapped_column(String(20))  # whey_concentrate | whey_isolate | plant | casein | other
    scoop_size_g: Mapped[float | None] = mapped_column(Float)
    protein_per_scoop_g: Mapped[float | None] = mapped_column(Float)
    calories_per_scoop: Mapped[float | None] = mapped_column(Float)
    carbs_per_scoop_g: Mapped[float | None] = mapped_column(Float)
    fat_per_scoop_g: Mapped[float | None] = mapped_column(Float)

    # --- advanced: training & schedule ---
    training_split: Mapped[str | None] = mapped_column(String(200))
    training_experience: Mapped[str | None] = mapped_column(String(20))
    rest_day: Mapped[str] = mapped_column(String(10), default="sunday")
    wake_time: Mapped[str | None] = mapped_column(String(5))
    gym_start_time: Mapped[str | None] = mapped_column(String(5))
    gym_return_time: Mapped[str | None] = mapped_column(String(5))
    bedtime: Mapped[str | None] = mapped_column(String(5))

    # --- advanced: targets & preferences ---
    protein_target_g_per_kg: Mapped[float] = mapped_column(Float, default=1.8)
    water_target_ml: Mapped[int | None] = mapped_column(Integer)
    sleep_target_hours: Mapped[float | None] = mapped_column(Float)
    preferred_cuisine: Mapped[str | None] = mapped_column(String(120))
    timezone: Mapped[str | None] = mapped_column(String(60))
    notes: Mapped[str | None] = mapped_column(Text)
