"""Baseline clinical record: the athlete profile, Day 1 (26 Oct 2026) and Day 2 (27 Oct 2026).

Only these two verified days are seeded. Runs once, when the `users` table is empty.
"""
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DailySummary, FoodLog, User, WorkoutLog, WorkoutSession
from app.services.nutrition.tagging import add_time_tags, infer_tags
from app.services.tracker import daily

DAY_1 = date(2026, 10, 26)
DAY_2 = date(2026, 10, 27)

PROFILE = {
    "id": 1,
    "name": None,
    "age": None,  # pending user confirmation
    "sex": None,  # pending user confirmation
    "height_cm": 173.0,  # 5'8" ≈ 172.7 cm
    "starting_weight": 94.5,
    "current_weight": 94.5,
    "start_date": DAY_1,
    "goal": "Aggressive yet sustainable fat loss while strictly preserving lean muscle mass, strength and training recovery.",
    "training_split": "Push / Pull / Legs + Cardio (treadmill, cycling) + pull-ups & accessories",
    "rest_day": "sunday",
    "gym_return_time": "21:10",
    "bedtime": "21:30",
    "protein_target_g_per_kg": 1.8,
    "sleep_target_hours": 7.5,
    "preferred_cuisine": "Indian",
    "timezone": "Asia/Kolkata",
    "allergies": [],
    "intolerances": [],
    "medical_conditions": [],
    "medications": [],
    "supplements": ["Whey protein"],
    "protein_supplement_name": "Whey protein",
    "protein_supplement_type": "whey_concentrate",
    "scoop_size_g": 33,
    "protein_per_scoop_g": 24.5,
    "calories_per_scoop": 125,
    "carbs_per_scoop_g": 2.5,
    "fat_per_scoop_g": 1.5,
    "notes": (
        "Clinical note: only ~20 minutes between gym return (~21:10) and bedtime (~21:30). "
        "Avoid heavy, slow-digesting meals before sleep (reflux, GI distress, morning bloating)."
    ),
}

WHEY = {
    "food_name": "Whey protein in water", "ingredients": ["whey protein (1 scoop)", "water"], "quantity": 1,
    "portion_unit": "scoop", "weight_grams": 33, "calories": 125, "protein": 24.5, "carbs": 2.5, "fat": 1.5, "fibre": 0,
}
FRIED_RICE_INGREDIENTS = ["rice", "cumin", "hing", "coriander", "garlic", "peanuts", "green chilli", "onions", "tadka oil"]

FOODS = {
    DAY_1: [
        {"meal_type": "breakfast", "time": None, "food_name": "Sandwiches", "ingredients": ["bread", "vegetables", "butter"],
         "quantity": 2, "portion_unit": "sandwich", "calories": 420, "protein": 11, "carbs": 54, "fat": 18, "fibre": 5.0},
        {"meal_type": "breakfast", "time": None, "food_name": "Black coffee (unsweetened)", "ingredients": ["coffee", "water"],
         "quantity": 1, "portion_unit": "cup", "calories": 4, "protein": 0.3, "carbs": 0.2, "fat": 0, "fibre": 0},
        {"meal_type": "morning_snack", "time": None, **WHEY},
        {"meal_type": "lunch", "time": None, "food_name": "Macaroni pasta", "ingredients": ["macaroni", "vegetables", "oil", "masala"],
         "quantity": 1, "portion_unit": "tiffin (full)", "calories": 500, "protein": 13.5, "carbs": 82, "fat": 14, "fibre": 3.0},
        {"meal_type": "pre_workout", "time": None, "food_name": "Banana (medium)", "ingredients": ["banana"],
         "quantity": 1, "portion_unit": "medium", "weight_grams": 118, "calories": 105, "protein": 1.3, "carbs": 27, "fat": 0.3, "fibre": 3.1},
        {"meal_type": "post_workout", "time": None, **WHEY},
    ],
    DAY_2: [
        {"meal_type": "breakfast", "time": "07:00", "food_name": "Fried rice (tadka, peanuts, onions)", "ingredients": FRIED_RICE_INGREDIENTS,
         "quantity": 1, "portion_unit": "plate", "calories": 410, "protein": 9.3, "carbs": 63, "fat": 13.5, "fibre": 3.2},
        {"meal_type": "breakfast", "time": "07:00", "food_name": "Milk chai (very low sugar)", "ingredients": ["milk", "tea", "sugar (very little)"],
         "quantity": 1, "portion_unit": "cup", "calories": 75, "protein": 2.8, "carbs": 7.5, "fat": 3.8, "fibre": 0},
        {"meal_type": "morning_snack", "time": "07:30", **WHEY},
        {"meal_type": "lunch", "time": "13:30", "food_name": "Fried rice (tadka, peanuts, onions)", "ingredients": FRIED_RICE_INGREDIENTS,
         "quantity": 0.5, "portion_unit": "plate", "calories": 210, "protein": 4.8, "carbs": 32, "fat": 7.0, "fibre": 2.1},
        {"meal_type": "post_workout", "time": "21:15", **WHEY},
    ],
}

COACH = {
    DAY_1: (
        "Warning: Aggressive deficit. ~1,279 kcal with only 75 g protein (0.8 g/kg vs 1.6–2.0 g/kg target). "
        "Food minus exercise leaves only ~642 kcal (before BMR). Add a protein-rich solid meal and a third protein feeding."
    ),
    DAY_2: (
        "CRITICAL ALERT: Crash deficit (<1,000 kcal). ~945 kcal and 66 g protein. Severe risk of gym weakness, muscle "
        "catabolism and metabolic slowdown. Skipping dinner leaves the body without amino acids during sleep — eat a "
        "balanced dinner 60–90 min before the gym and keep the post-gym feed light (whey isolate / egg whites)."
    ),
}

PULL_EXERCISES = [
    {"exercise_name": "Pull-ups", "target_muscle": "Lats / upper back", "sets": 3, "reps": "10-15", "rpe": "8-9",
     "notes": "Bodyweight (94.5 kg)"},
    {"exercise_name": "Lat pulldown", "target_muscle": "Lats"},
    {"exercise_name": "Seated cable row", "target_muscle": "Mid back"},
    {"exercise_name": "Chest-supported row", "target_muscle": "Mid back / rear delts"},
    {"exercise_name": "Reverse pec-deck / rear-delt fly", "target_muscle": "Rear delts"},
    {"exercise_name": "EZ-bar biceps curl", "target_muscle": "Biceps"},
    {"exercise_name": "Hammer curl", "target_muscle": "Brachialis / forearms"},
    {"exercise_name": "Additional arm accessories", "target_muscle": "Arms"},
]


async def seed_baseline(db: AsyncSession) -> bool:
    """Returns True when data was inserted, False when a profile already exists."""
    if await db.scalar(select(User.id).limit(1)) is not None:
        return False

    user = User(**PROFILE)
    db.add(user)
    await db.flush()

    summaries: dict[date, DailySummary] = {}
    for d in (DAY_1, DAY_2):
        s = DailySummary(
            user_id=user.id, date=d, day_number=daily.day_number(user, d), soreness_muscles=[],
            coach_advice=COACH[d], coach_advice_source="baseline assessment",
        )
        if d == DAY_1:
            s.morning_weight = 94.5
        db.add(s)
        summaries[d] = s
    await db.flush()

    for d, foods in FOODS.items():
        for entry in foods:
            f = dict(entry)
            ingredients = f.pop("ingredients")
            row = FoodLog(
                daily_summary_id=summaries[d].id, date=d, ingredients_json=ingredients,
                research_source="Baseline record (verified)", confidence_score=0.9, **f,
            )
            row.tags = add_time_tags(infer_tags(row.food_name, ingredients), row.time, user.bedtime)
            db.add(row)

    # Day 1 — Pull day: 20 min treadmill + 10 min cycling + one 60-min lifting block.
    day1 = summaries[DAY_1]
    db.add(WorkoutLog(daily_summary_id=day1.id, date=DAY_1, workout_type="cardio", exercise_name="Treadmill",
                      target_muscle="Cardio", cardio_duration_min=20, met_value=4.5, notes="Brisk / incline walk"))
    db.add(WorkoutLog(daily_summary_id=day1.id, date=DAY_1, workout_type="cardio", exercise_name="Stationary cycling",
                      target_muscle="Cardio", cardio_duration_min=10, met_value=5.5, notes="Moderate"))
    pull = WorkoutSession(daily_summary_id=day1.id, date=DAY_1, split="pull", lifting_duration_min=60, lifting_met=4.0,
                          notes="Pull-ups and arm work are inside this 60-min block (never double-counted).")
    db.add(pull)
    await db.flush()
    for ex in PULL_EXERCISES:
        db.add(WorkoutLog(daily_summary_id=day1.id, date=DAY_1, session_id=pull.id, workout_type="strength", **ex))

    # Day 2 — Push day (evening). Duration was not recorded, so no calories are assumed.
    db.add(WorkoutSession(daily_summary_id=summaries[DAY_2].id, date=DAY_2, split="push", lifting_duration_min=None,
                          lifting_met=4.0, started_at=None,
                          notes="Push day (evening) — chest, shoulders, triceps. Duration not logged yet."))
    await db.commit()

    for d in (DAY_1, DAY_2):
        await daily.recompute(db, user, d)
    return True
