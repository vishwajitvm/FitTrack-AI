"""Quick picks (your habitual foods) and the "Today" plan that tells you what to log next."""
import math
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FoodLog, User, WorkoutLog, WorkoutSession
from app.services.nutrition.tagging import minutes_of
from app.services.quicklog import presets as preset_service
from app.services.tracker import daily
from app.services.training.autoregulation import next_split

HISTORY_DAYS = 60
RECENCY_HALF_LIFE_DAYS = 14
SAME_SLOT_BOOST = 3.0  # foods you eat at this meal outrank foods you eat often at other times
OTHER_SLOT_FACTOR = 0.4

# Typical meal slots for this athlete's day (gym return ~21:10, bed ~21:30).
MEAL_SLOTS = [
    ("breakfast", "Breakfast", "07:00"),
    ("morning_snack", "Morning snack", "10:30"),
    ("lunch", "Lunch", "13:30"),
    ("evening_snack", "Evening snack", "17:00"),
    ("pre_workout", "Pre-workout", "18:30"),
    ("post_workout", "Post-workout", "21:15"),
]


def slot_for_time(minutes: int) -> str:
    """Meal type whose typical time is closest to now."""
    return min(MEAL_SLOTS, key=lambda s: abs((minutes_of(s[2]) or 0) - minutes))[0]


async def quick_picks(db: AsyncSession, user: User, meal_type: str | None, limit: int = 12) -> list[dict]:
    """Most-logged foods, weighted by recency (half-life 14 days) and boosted for the requested meal."""
    today = daily.today_for(user)
    rows = (await db.scalars(
        select(FoodLog).where(FoodLog.date >= today - timedelta(days=HISTORY_DAYS)).order_by(FoodLog.date.desc(), FoodLog.id.desc())
    )).all()
    groups: dict[str, dict] = {}
    for f in rows:
        key = f"{f.food_name.strip().lower()}|{round(f.calories)}"
        age = (today - f.date).days
        slot_factor = 1.0 if not meal_type else (SAME_SLOT_BOOST if f.meal_type == meal_type else OTHER_SLOT_FACTOR)
        weight = math.pow(0.5, age / RECENCY_HALF_LIFE_DAYS) * slot_factor
        entry = groups.setdefault(key, {"score": 0.0, "times": 0, "latest": f})
        entry["score"] += weight
        entry["times"] += 1
    ranked = sorted(groups.items(), key=lambda kv: -kv[1]["score"])[:limit]
    return [
        {
            "key": key,
            **preset_service.food_item(entry["latest"]),
            "meal_type": meal_type or entry["latest"].meal_type,
            "times_logged": entry["times"],
            "last_logged": entry["latest"].date,
        }
        for key, entry in ranked
    ]


async def today_plan(db: AsyncSession, user: User) -> dict:
    now = daily.now_for(user)
    today = now.date()
    day, data = await daily.compute_day(db, user, today)
    foods = data["foods"].get(today, [])
    logged_meals = {f.meal_type for f in foods}

    split, is_rest = await next_split(db, user, today)
    workout_presets = await preset_service.list_presets(db, "workout")
    suggested_workout = next((p for p in workout_presets if p.split == split), None)
    trained = bool(await db.scalar(select(WorkoutSession.id).where(WorkoutSession.date == today).limit(1))
                   or await db.scalar(select(WorkoutLog.id).where(WorkoutLog.date == today).limit(1)))

    meal_presets = await preset_service.list_presets(db, "meal")
    meals = []
    for meal_type, label, typical in MEAL_SLOTS:
        preset = next((p for p in meal_presets if p.meal_type == meal_type), None)
        picks = await quick_picks(db, user, meal_type, limit=4)
        meals.append({
            "meal_type": meal_type,
            "label": label,
            "typical_time": typical,
            "logged": meal_type in logged_meals,
            "suggested_preset": preset_service.serialize(preset) if preset else None,
            "top_picks": [p for p in picks if p["meal_type"] == meal_type][:4] or picks[:2],
        })

    protein_target = round(day["weight_used_kg"] * (user.protein_target_g_per_kg or 1.8))
    checkin_done = any(day.get(k) is not None for k in ("energy_level", "sleep_hours", "readiness_score"))
    now_min = now.hour * 60 + now.minute

    if not checkin_done or day["morning_weight"] is None:
        label = "Do your 10-second morning check-in" if now_min < 12 * 60 else "Add today's check-in (weight, sleep, energy)"
        next_action = {"kind": "checkin", "label": label, "meal_type": None}
    else:
        due = [m for m in meals if not m["logged"] and (minutes_of(m["typical_time"]) or 0) <= now_min + 30]
        if due:
            next_action = {"kind": "meal", "label": f"Log {due[-1]['label'].lower()}", "meal_type": due[-1]["meal_type"]}
        elif not trained and not is_rest and now_min >= 17 * 60:
            next_action = {"kind": "workout", "label": f"Log today's {split} workout", "meal_type": None}
        elif day["total_protein"] < protein_target * 0.8 and now_min >= 18 * 60:
            next_action = {"kind": "scoop", "label": "Protein is low — add a scoop", "meal_type": "post_workout"}
        else:
            next_action = {"kind": "done", "label": "You're up to date", "meal_type": None}

    return {
        "date": today,
        "weekday": daily.WEEKDAYS[today.weekday()].title(),
        "is_rest_day": is_rest,
        "checkin_done": checkin_done,
        "weight_logged": day["morning_weight"] is not None,
        "workout": {
            "split": split,
            "preset": preset_service.serialize(suggested_workout) if suggested_workout else None,
            "logged": trained,
            "message": "Rest & recovery day — no gym." if is_rest else (
                f"Done for today ({split})." if trained else f"Today's plan: {split.title()} day."),
        },
        "meals": meals,
        "protein": {"eaten": day["total_protein"], "target": protein_target},
        "calories": {"eaten": day["total_calories"], "target": (day["estimated_tdee"] - 600) if day["estimated_tdee"] else None},
        "next_action": next_action,
    }

