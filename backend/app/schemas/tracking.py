"""Request bodies for the daily tracker, food log and workouts."""
import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ClockTime, limited

MealType = Literal["breakfast", "morning_snack", "lunch", "evening_snack", "pre_workout", "post_workout", "dinner", "other"]
Split = Literal["pull", "push", "legs", "cardio", "full_body", "rest", "other"]



class CheckIn(BaseModel):
    morning_weight: float | None = Field(None, gt=20, lt=400)
    readiness_score: int | None = Field(None, ge=1, le=10)
    energy_level: int | None = Field(None, ge=1, le=10)
    sleep_hours: float | None = Field(None, ge=0, le=24)
    sleep_quality: int | None = Field(None, ge=1, le=10)
    bloating_status: Literal["none", "mild", "moderate", "severe"] | None = None
    soreness_notes: str | None = None
    soreness_muscles: list[str] | None = None
    steps: int | None = Field(None, ge=0)
    water_ml: int | None = Field(None, ge=0)
    mood: int | None = Field(None, ge=1, le=10)
    stress: int | None = Field(None, ge=1, le=10)
    notes: str | None = None


class FoodLogBase(BaseModel):
    meal_type: MealType = "other"
    time: ClockTime | None = None
    food_name: limited(200)
    ingredients: list[str] = []
    quantity: float | None = None
    portion_unit: limited(40) | None = None
    weight_grams: float | None = None
    calories: float = 0
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    fibre: float = 0
    calories_low: float | None = None
    calories_high: float | None = None
    confidence_score: float | None = None
    research_source: limited(300) | None = None
    image_url: str | None = None
    tags: list[str] | None = None
    notes: str | None = None


class FoodLogCreate(FoodLogBase):
    date: dt.date


class FoodLogUpdate(BaseModel):
    date: dt.date | None = None
    meal_type: MealType | None = None
    time: ClockTime | None = None
    food_name: limited(200) | None = None
    ingredients: list[str] | None = None
    quantity: float | None = None
    portion_unit: limited(40) | None = None
    weight_grams: float | None = None
    calories: float | None = None
    protein: float | None = None
    carbs: float | None = None
    fat: float | None = None
    fibre: float | None = None
    calories_low: float | None = None
    calories_high: float | None = None
    confidence_score: float | None = None
    research_source: limited(300) | None = None
    tags: list[str] | None = None
    notes: str | None = None


class AnalysisItemIn(BaseModel):
    name: limited(200)
    ingredients: list[str] = []
    estimated_weight_g: float | None = None
    calories: float = 0
    calories_low: float | None = None
    calories_high: float | None = None
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    fibre: float = 0
    source: limited(300) | None = None
    confidence: float | None = None
    tags: list[str] = []
    notes: str | None = None


class SaveAnalysis(BaseModel):
    items: list[AnalysisItemIn]
    meal_type: MealType = "other"
    date: dt.date
    time: ClockTime | None = None


class ParseTextRequest(BaseModel):
    text: limited(1000)
    meal_type: MealType | None = None
    date: dt.date | None = None
    time: ClockTime | None = None


class ParsedItemIn(BaseModel):
    text: limited(300) | None = None
    name: limited(200)
    quantity: float | None = None
    unit: limited(40) | None = None
    grams: float | None = None
    calories: float = 0
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    fibre: float = 0
    source: limited(300) | None = None
    confidence: float | None = None
    tags: list[str] = []


class SaveParsedMeal(BaseModel):
    items: list[ParsedItemIn]
    meal_type: MealType = "other"
    date: dt.date
    time: ClockTime | None = None


class WorkoutSessionCreate(BaseModel):
    date: dt.date
    split: Split = "other"
    lifting_duration_min: float | None = Field(None, ge=0, le=600)
    lifting_met: float = Field(4.0, ge=1, le=15)
    session_rpe: float | None = Field(None, ge=1, le=10)
    started_at: ClockTime | None = None
    notes: str | None = None


class WorkoutSessionUpdate(BaseModel):
    split: Split | None = None
    lifting_duration_min: float | None = Field(None, ge=0, le=600)
    lifting_met: float | None = Field(None, ge=1, le=15)
    session_rpe: float | None = Field(None, ge=1, le=10)
    started_at: ClockTime | None = None
    notes: str | None = None


class SetEntry(BaseModel):
    reps: int | None = None
    weight_kg: float | None = None
    rpe: float | None = None


class WorkoutLogCreate(BaseModel):
    date: dt.date
    session_id: int | None = None
    workout_type: Literal["cardio", "strength"]
    exercise_name: limited(120)
    target_muscle: limited(80) | None = None
    sets: int | None = None
    reps: limited(20) | None = None
    weight_kg: float | None = None
    sets_json: list[SetEntry] = []
    cardio_duration_min: float | None = None
    met_value: float | None = None
    rpe: limited(10) | None = None
    notes: str | None = None


class WorkoutLogUpdate(BaseModel):
    session_id: int | None = None
    exercise_name: limited(120) | None = None
    target_muscle: limited(80) | None = None
    sets: int | None = None
    reps: limited(20) | None = None
    weight_kg: float | None = None
    sets_json: list[SetEntry] | None = None
    cardio_duration_min: float | None = None
    met_value: float | None = None
    rpe: limited(10) | None = None
    notes: str | None = None
