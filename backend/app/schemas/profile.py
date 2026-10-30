import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ClockTime, limited


class ProfileUpdate(BaseModel):
    """All fields optional — only provided fields are updated."""

    # basic
    name: limited(120) | None = None
    age: int | None = Field(None, ge=10, le=100)
    sex: Literal["male", "female"] | None = None
    height_cm: float | None = Field(None, gt=50, lt=260)
    starting_weight_kg: float | None = Field(None, gt=20, lt=400)
    current_weight_kg: float | None = Field(None, gt=20, lt=400)
    goal: str | None = None
    target_weight_kg: float | None = None
    start_date: dt.date | None = None
    # advanced
    weekly_rate_kg: float | None = None
    activity_level: Literal["sedentary", "light", "moderate", "active"] | None = None
    avg_daily_steps: int | None = Field(None, ge=0)
    body_fat_pct: float | None = None
    waist_cm: float | None = None
    neck_cm: float | None = None
    hip_cm: float | None = None
    diet_type: Literal["vegetarian", "eggetarian", "non_vegetarian", "vegan"] | None = None
    allergies: list[str] | None = None
    intolerances: list[str] | None = None
    medical_conditions: list[str] | None = None
    medications: list[str] | None = None
    supplements: list[str] | None = None
    protein_supplement_name: limited(120) | None = None
    protein_supplement_type: Literal["whey_concentrate", "whey_isolate", "plant", "casein", "other"] | None = None
    scoop_size_g: float | None = Field(None, gt=0, le=200)
    protein_per_scoop_g: float | None = Field(None, ge=0, le=100)
    calories_per_scoop: float | None = Field(None, ge=0, le=1000)
    carbs_per_scoop_g: float | None = Field(None, ge=0, le=200)
    fat_per_scoop_g: float | None = Field(None, ge=0, le=100)
    training_split: limited(200) | None = None
    training_experience: Literal["beginner", "intermediate", "advanced"] | None = None
    rest_day: Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] | None = None
    wake_time: ClockTime | None = None
    gym_start_time: ClockTime | None = None
    gym_return_time: ClockTime | None = None
    bedtime: ClockTime | None = None
    protein_target_g_per_kg: float | None = Field(None, ge=0.8, le=3.5)
    water_target_ml: int | None = None
    sleep_target_hours: float | None = None
    preferred_cuisine: limited(120) | None = None
    timezone: limited(60) | None = None
    notes: str | None = None
