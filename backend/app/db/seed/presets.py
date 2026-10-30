"""Starter presets built from the athlete's real routine, so day 3 can be logged in a couple of taps.

Runs whenever the presets table is empty (new installs and existing databases alike).
"""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Preset, User
from app.services.training.autoregulation import EXERCISE_LIBRARY

# Day 1 pattern: 20 min treadmill + 10 min cycling, then a 60-minute lifting block.
USUAL_CARDIO = [
    {"exercise_name": "Treadmill", "cardio_duration_min": 20, "met_value": 4.5, "rpe": None},
    {"exercise_name": "Stationary cycling", "cardio_duration_min": 10, "met_value": 5.5, "rpe": None},
]


def _split_exercises(split: str) -> list[dict]:
    return [
        {"exercise_name": e["name"], "target_muscle": e["target_muscle"], "sets": e["default_sets"],
         "reps": e["default_reps"], "weight_kg": None, "rpe": None, "sets_json": []}
        for e in EXERCISE_LIBRARY if e["split"] == split
    ]


def _workout(split: str, exercises: list[dict]) -> dict:
    return {
        "session": {"split": split, "lifting_duration_min": 60, "lifting_met": 4.0, "session_rpe": 7},
        "cardio": USUAL_CARDIO,
        "exercises": exercises,
    }


def _whey(user: User | None) -> dict:
    name = (user.protein_supplement_name if user else None) or "Whey protein"
    return {
        "food_name": f"{name} in water (1 scoop)", "quantity": 1, "portion_unit": "scoop",
        "weight_grams": (user.scoop_size_g if user else None) or 33,
        "calories": (user.calories_per_scoop if user else None) or 125,
        "protein": (user.protein_per_scoop_g if user else None) or 24.5,
        "carbs": (user.carbs_per_scoop_g if user else None) or 2.5,
        "fat": (user.fat_per_scoop_g if user else None) or 1.5,
        "fibre": 0, "ingredients": [name, "water"], "tags": ["lactose"],
    }


async def seed_presets(db: AsyncSession) -> int:
    if await db.scalar(select(func.count()).select_from(Preset)):
        return 0
    user = await db.scalar(select(User).limit(1))
    pull = [
        {"exercise_name": "Pull-ups", "target_muscle": "Lats / upper back", "sets": 3, "reps": "10-15", "weight_kg": None,
         "rpe": "8-9", "sets_json": []},
        *[e for e in _split_exercises("pull") if e["exercise_name"] not in ("Pull-ups", "Face pull")],
    ]
    presets = [
        Preset(kind="workout", name="Pull day", icon="🧗", split="pull", payload=_workout("pull", pull)),
        Preset(kind="workout", name="Push day", icon="🏋️", split="push", payload=_workout("push", _split_exercises("push"))),
        Preset(kind="workout", name="Legs day", icon="🦵", split="legs", payload=_workout("legs", _split_exercises("legs"))),
        Preset(kind="workout", name="Cardio only", icon="🏃", split="cardio",
               payload={"session": None, "cardio": [{**USUAL_CARDIO[0], "cardio_duration_min": 30}], "exercises": []}),
        Preset(kind="meal", name="Whey after gym", icon="🥤", meal_type="post_workout",
               payload={"meal_type": "post_workout", "items": [_whey(user)]}),
        Preset(kind="meal", name="Morning whey", icon="🥛", meal_type="morning_snack",
               payload={"meal_type": "morning_snack", "items": [_whey(user)]}),
        Preset(kind="meal", name="Banana before gym", icon="🍌", meal_type="pre_workout",
               payload={"meal_type": "pre_workout", "items": [
                   {"food_name": "Banana (medium)", "quantity": 1, "portion_unit": "medium", "weight_grams": 118,
                    "calories": 105, "protein": 1.3, "carbs": 27, "fat": 0.3, "fibre": 3.1, "ingredients": ["banana"], "tags": []}]}),
        Preset(kind="meal", name="Fried rice + chai", icon="🍛", meal_type="breakfast",
               payload={"meal_type": "breakfast", "items": [
                   {"food_name": "Fried rice (tadka, peanuts, onions)", "quantity": 1, "portion_unit": "plate", "weight_grams": None,
                    "calories": 410, "protein": 9.3, "carbs": 63, "fat": 13.5, "fibre": 3.2,
                    "ingredients": ["rice", "peanuts", "onions", "tadka oil"], "tags": ["fried"]},
                   {"food_name": "Milk chai (very low sugar)", "quantity": 1, "portion_unit": "cup", "weight_grams": None,
                    "calories": 75, "protein": 2.8, "carbs": 7.5, "fat": 3.8, "fibre": 0,
                    "ingredients": ["milk", "tea"], "tags": ["lactose", "caffeine"]}]}),
        Preset(kind="meal", name="Sandwiches + coffee", icon="🥪", meal_type="breakfast",
               payload={"meal_type": "breakfast", "items": [
                   {"food_name": "Sandwiches", "quantity": 2, "portion_unit": "sandwich", "weight_grams": None,
                    "calories": 420, "protein": 11, "carbs": 54, "fat": 18, "fibre": 5.0,
                    "ingredients": ["bread", "vegetables", "butter"], "tags": ["gluten", "refined_flour"]},
                   {"food_name": "Black coffee (unsweetened)", "quantity": 1, "portion_unit": "cup", "weight_grams": None,
                    "calories": 4, "protein": 0.3, "carbs": 0.2, "fat": 0, "fibre": 0, "ingredients": ["coffee"], "tags": ["caffeine"]}]}),
    ]
    for p in presets:
        p.use_count = 0
        db.add(p)
    await db.commit()
    return len(presets)
