"""Request bodies for presets, day copy and undo."""
import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ClockTime, limited
from app.schemas.tracking import MealType, Split

PresetKind = Literal["workout", "meal"]


class PresetCreate(BaseModel):
    kind: PresetKind
    name: limited(80)
    icon: limited(40) | None = None
    color: limited(20) | None = None
    split: Split | None = None
    meal_type: MealType | None = None
    payload: dict = {}


class PresetUpdate(BaseModel):
    name: limited(80) | None = None
    icon: limited(40) | None = None
    color: limited(20) | None = None
    split: Split | None = None
    meal_type: MealType | None = None
    payload: dict | None = None


class PresetApply(BaseModel):
    date: dt.date
    time: ClockTime | None = None
    payload: dict | None = None  # edited version from the UI sheet
    scale: float = Field(1.0, gt=0, le=5)


class PresetFromDay(BaseModel):
    kind: PresetKind
    date: dt.date
    name: limited(80)
    meal_type: MealType | None = None
    icon: limited(40) | None = None


class DayCopy(BaseModel):
    from_date: dt.date
    to_date: dt.date
    include: list[Literal["food", "workouts"]] = ["food", "workouts"]
    meal_types: list[MealType] | None = None


class EntriesDelete(BaseModel):
    food_ids: list[int] = []
    workout_log_ids: list[int] = []
    session_ids: list[int] = []
