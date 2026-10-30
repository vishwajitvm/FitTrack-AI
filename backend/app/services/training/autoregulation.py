"""Workout auto-regulation: picks today's PPL split and scales volume/RPE to readiness.

Readiness (0-100) blends the morning check-in (energy, sleep, soreness, bloating) with
recent nutrition (crash deficits and low protein in the last two days).
"""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, WorkoutSession
from app.services.ml import readiness_model, training_load
from app.services.nutrition.tagging import is_late, minutes_of
from app.services.tracker import daily

ACWR_PENALTY = {"high": 5, "very_high": 12}


async def readiness_model_for(db: AsyncSession, user: User, history_days: int = 120) -> dict:
    """Fits the personal readiness model on the user's history (see services/ml/readiness_model.py)."""
    end = daily.today_for(user)
    history = await daily.compute_range(db, user, max(user.start_date, end - timedelta(days=history_days - 1)), end, adaptive=False)
    data = await daily.load_range(db, user, date.fromisoformat(history[0]["date"]), end)
    late_kcal = {d.isoformat(): sum(f.calories for f in foods if is_late(f.time, user.bedtime)) for d, foods in data["foods"].items()}
    load = await training_load.training_load(db, end, days=len(history))
    acwr = {p["date"]: p["acwr"] for p in load["points"]}
    return readiness_model.fit(readiness_model.build_rows(history, late_kcal, acwr))

ROTATION = ["pull", "push", "legs"]

EXERCISE_LIBRARY = [
    # pull
    {"name": "Pull-ups", "target_muscle": "Lats / upper back", "split": "pull", "default_sets": 3, "default_reps": "8-12"},
    {"name": "Lat pulldown", "target_muscle": "Lats", "split": "pull", "default_sets": 3, "default_reps": "10-12"},
    {"name": "Seated cable row", "target_muscle": "Mid back", "split": "pull", "default_sets": 3, "default_reps": "10-12"},
    {"name": "Chest-supported row", "target_muscle": "Mid back / rear delts", "split": "pull", "default_sets": 3, "default_reps": "10-12"},
    {"name": "Reverse pec-deck / rear-delt fly", "target_muscle": "Rear delts", "split": "pull", "default_sets": 3, "default_reps": "12-15"},
    {"name": "EZ-bar biceps curl", "target_muscle": "Biceps", "split": "pull", "default_sets": 3, "default_reps": "10-12"},
    {"name": "Hammer curl", "target_muscle": "Brachialis / forearms", "split": "pull", "default_sets": 3, "default_reps": "10-12"},
    {"name": "Face pull", "target_muscle": "Rear delts / rotator cuff", "split": "pull", "default_sets": 3, "default_reps": "12-15"},
    # push
    {"name": "Barbell bench press", "target_muscle": "Chest", "split": "push", "default_sets": 3, "default_reps": "6-10"},
    {"name": "Incline dumbbell press", "target_muscle": "Upper chest", "split": "push", "default_sets": 3, "default_reps": "8-12"},
    {"name": "Seated dumbbell shoulder press", "target_muscle": "Shoulders", "split": "push", "default_sets": 3, "default_reps": "8-12"},
    {"name": "Cable / pec-deck fly", "target_muscle": "Chest", "split": "push", "default_sets": 3, "default_reps": "12-15"},
    {"name": "Lateral raise", "target_muscle": "Side delts", "split": "push", "default_sets": 3, "default_reps": "12-20"},
    {"name": "Triceps rope pushdown", "target_muscle": "Triceps", "split": "push", "default_sets": 3, "default_reps": "10-15"},
    {"name": "Overhead triceps extension", "target_muscle": "Triceps (long head)", "split": "push", "default_sets": 3, "default_reps": "10-12"},
    # legs
    {"name": "Back squat / hack squat", "target_muscle": "Quads / glutes", "split": "legs", "default_sets": 3, "default_reps": "6-10"},
    {"name": "Romanian deadlift", "target_muscle": "Hamstrings / glutes", "split": "legs", "default_sets": 3, "default_reps": "8-10"},
    {"name": "Leg press", "target_muscle": "Quads", "split": "legs", "default_sets": 3, "default_reps": "10-12"},
    {"name": "Walking lunges", "target_muscle": "Quads / glutes", "split": "legs", "default_sets": 2, "default_reps": "10/leg"},
    {"name": "Lying leg curl", "target_muscle": "Hamstrings", "split": "legs", "default_sets": 3, "default_reps": "10-12"},
    {"name": "Leg extension", "target_muscle": "Quads", "split": "legs", "default_sets": 3, "default_reps": "12-15"},
    {"name": "Standing calf raise", "target_muscle": "Calves", "split": "legs", "default_sets": 3, "default_reps": "12-15"},
    # cardio
    {"name": "Treadmill (brisk / incline walk)", "target_muscle": "Cardio", "split": "cardio", "default_sets": 1, "default_reps": "20 min"},
    {"name": "Stationary cycling", "target_muscle": "Cardio", "split": "cardio", "default_sets": 1, "default_reps": "10 min"},
]


async def next_split(db: AsyncSession, user: User, d: date) -> tuple[str, bool]:
    weekday = daily.WEEKDAYS[d.weekday()]
    if weekday == (user.rest_day or "sunday"):
        return "rest", True
    today_session = await db.scalar(select(WorkoutSession).where(WorkoutSession.date == d).order_by(WorkoutSession.id.desc()).limit(1))
    if today_session and today_session.split in ROTATION:
        return today_session.split, False
    last = await db.scalar(
        select(WorkoutSession)
        .where(WorkoutSession.date < d, WorkoutSession.split.in_(ROTATION))
        .order_by(WorkoutSession.date.desc(), WorkoutSession.id.desc())
        .limit(1)
    )
    if last is None:
        return "pull", False
    return ROTATION[(ROTATION.index(last.split) + 1) % len(ROTATION)], False


def _readiness(today: dict, recent: list[dict], weight: float) -> tuple[int, list[str], bool]:
    score = 80.0
    reasons: list[str] = []
    has_checkin = False

    energy = today.get("energy_level") or today.get("readiness_score")
    if energy:
        has_checkin = True
        score += (energy - 7) * 5
        reasons.append(f"Energy {energy}/10")
    if today.get("sleep_hours") is not None:
        has_checkin = True
        sleep = today["sleep_hours"]
        if sleep < 6:
            score -= 15
            reasons.append(f"Only {sleep:g} h sleep (−15)")
        elif sleep < 7:
            score -= 8
            reasons.append(f"{sleep:g} h sleep (−8)")
    if today.get("sleep_quality"):
        score += (today["sleep_quality"] - 7) * 2
    if today.get("soreness_muscles"):
        has_checkin = True
        score -= min(15, 4 * len(today["soreness_muscles"]))
        reasons.append("Soreness: " + ", ".join(today["soreness_muscles"]))
    bloat_penalty = {"mild": 3, "moderate": 8, "severe": 15}.get(today.get("bloating_status") or "", 0)
    if bloat_penalty:
        has_checkin = True
        score -= bloat_penalty
        reasons.append(f"Bloating {today['bloating_status']} (−{bloat_penalty})")

    for day in recent:
        if day["food_count"] and day["total_calories"] < 1000:
            score -= 12
            reasons.append(f"Crash intake on {day['date']} ({day['total_calories']:.0f} kcal) (−12)")
        elif day["food_count"] and day["total_calories"] < 1500:
            score -= 5
            reasons.append(f"Aggressive deficit on {day['date']} (−5)")
        if day["food_count"] and day["total_protein"] < 1.6 * weight:
            score -= 4
            reasons.append(f"Low protein on {day['date']} ({day['total_protein']:.0f} g) (−4)")
    return int(max(0, min(100, score))), reasons, has_checkin


def _volume(score: int) -> tuple[float, int, str]:
    if score >= 75:
        return 1.0, 9, "Primed"
    if score >= 60:
        return 0.85, 8, "Good"
    if score >= 45:
        return 0.7, 7, "Fatigued"
    return 0.5, 6, "Depleted"


def _timing_tips(user: User) -> list[str]:
    tips = []
    ret, bed = user.gym_return_time, user.bedtime
    gap = (minutes_of(bed) or 0) - (minutes_of(ret) or 0) if ret and bed else None
    if gap is not None and gap <= 30:
        tips.append(f"Only ~{gap} min between gym return ({ret}) and bed ({bed}): eat your main dinner 60–90 min BEFORE training.")
        tips.append("Post-gym: whey ISOLATE in water (25–30 g protein) or 4–5 boiled egg whites — nothing heavy, fried or high-volume.")
        tips.append("Avoid milk chai, large rice/pasta portions and tadka-oil dishes after 20:30 to prevent reflux and morning bloating.")
    tips.append("Spread protein across 4–5 feedings of 30–40 g; front-load carbs before training.")
    return tips


async def recommend(db: AsyncSession, user: User, d: date) -> dict:
    split, is_rest = await next_split(db, user, d)
    days = await daily.compute_range(db, user, d - timedelta(days=2), d)
    today, recent = days[-1], days[:-1]
    weight = today["weight_used_kg"]
    score, reasons, has_checkin = _readiness(today, recent, weight)

    load = await training_load.training_load(db, d, days=28)
    acwr, acwr_zone = load["acwr"], load["acwr_zone"]
    if penalty := ACWR_PENALTY.get(acwr_zone or ""):
        score = max(0, score - penalty)
        reasons.append(f"Training load ratio (ACWR) {acwr} is {acwr_zone.replace('_', ' ')} (−{penalty})")

    model = await readiness_model_for(db, user)
    if model["mode"] == "personal_model" and model["prediction_today"] is not None:
        predicted = model["prediction_today"] * 10
        reasons.append(f"Your personal model predicts energy {model['prediction_today']}/10 (blended 50/50 with the rules)")
        score = round(0.5 * score + 0.5 * predicted)
    modifier, rpe_cap, label = _volume(score)

    adjustments = list(reasons)
    if not has_checkin:
        adjustments.append("No morning check-in yet — readiness is based on nutrition only. Log energy/sleep for a better estimate.")

    if is_rest:
        recommendation = "Rest & gut-recovery day. Optional 20–30 min easy walk; prioritise sleep, protein and fibre."
        suggested = []
    else:
        suggested = []
        for ex in (e for e in EXERCISE_LIBRARY if e["split"] == split):
            sets = max(2, round(ex["default_sets"] * modifier))
            suggested.append({"name": ex["name"], "sets": sets, "reps": ex["default_reps"], "rpe": rpe_cap, "notes": ex["target_muscle"]})
        if modifier < 0.6:
            recommendation = (f"{split.title()} day, but readiness is low ({score}/100). Do a reduced session: ~50% volume, RPE ≤ {rpe_cap}, "
                              "or swap for 30 min easy cardio + mobility. Eat a proper meal first.")
        elif modifier < 1.0:
            recommendation = f"{split.title()} day at {int(modifier * 100)}% volume, cap effort at RPE {rpe_cap}. Keep 1–2 reps in reserve."
        else:
            recommendation = f"{split.title()} day — full volume. Push top sets to RPE {rpe_cap} with good form."
        suggested.append({"name": "Treadmill incline walk", "sets": 1, "reps": f"{15 if modifier < 0.8 else 20} min", "rpe": 6, "notes": "MET ≈ 4.5"})

    return {
        "date": d.isoformat(),
        "split_today": split,
        "is_rest_day": is_rest,
        "readiness_score": score,
        "readiness_label": label,
        "volume_modifier": modifier,
        "rpe_cap": rpe_cap,
        "recommendation": recommendation,
        "adjustments": adjustments,
        "suggested_exercises": suggested,
        "nutrition_timing": _timing_tips(user),
        "acwr": acwr,
        "acwr_zone": acwr_zone,
        "readiness_mode": model["mode"],
    }
