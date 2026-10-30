"""Daily tracker: computes each day's totals, energy balance and alerts from the raw logs.

The raw logs (food_logs, workout_sessions, workout_logs, bio_feedback) are the source of
truth; `daily_summaries` caches the computed totals so the table is complete on its own.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BioFeedback, DailySummary, FoodLog, User, WorkoutLog, WorkoutSession
from app.services.coach import rules
from app.services.nutrition.tagging import minutes_of
from app.services.ml import energy_model
from app.services.science import energy

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
MEAL_ORDER = ["breakfast", "morning_snack", "lunch", "evening_snack", "pre_workout", "post_workout", "dinner", "other"]
CHECKIN_FIELDS = [
    "readiness_score", "energy_level", "sleep_hours", "sleep_quality", "bloating_status", "soreness_notes",
    "soreness_muscles", "steps", "water_ml", "mood", "stress", "notes",
]


async def get_user(db: AsyncSession) -> User:
    user = await db.scalar(select(User).order_by(User.id).limit(1))
    if user is None:
        user = User(id=1, height_cm=173.0, starting_weight=94.5, current_weight=94.5, start_date=date.today(), rest_day="sunday")
        db.add(user)
        await db.commit()
    return user


def now_for(user: User) -> datetime:
    try:
        return datetime.now(ZoneInfo(user.timezone)) if user.timezone else datetime.now()
    except Exception:  # noqa: BLE001  unknown timezone string
        return datetime.now()


def today_for(user: User) -> date:
    return now_for(user).date()


def day_number(user: User, d: date) -> int:
    return (d - user.start_date).days + 1


async def ensure_summary(db: AsyncSession, user: User, d: date) -> DailySummary:
    summary = await db.scalar(select(DailySummary).where(DailySummary.user_id == user.id, DailySummary.date == d))
    if summary is None:
        summary = DailySummary(user_id=user.id, date=d, day_number=day_number(user, d), soreness_muscles=[])
        db.add(summary)
        await db.flush()
    return summary


async def weight_before(db: AsyncSession, user: User, d: date) -> float | None:
    row = await db.scalar(
        select(DailySummary.morning_weight)
        .where(DailySummary.user_id == user.id, DailySummary.date < d, DailySummary.morning_weight.is_not(None))
        .order_by(DailySummary.date.desc())
        .limit(1)
    )
    return row


async def latest_weight(db: AsyncSession, user: User) -> float | None:
    return await db.scalar(
        select(DailySummary.morning_weight)
        .where(DailySummary.user_id == user.id, DailySummary.morning_weight.is_not(None))
        .order_by(DailySummary.date.desc())
        .limit(1)
    )


async def load_range(db: AsyncSession, user: User, start: date, end: date) -> dict:
    """Loads every log in [start, end] grouped by date (avoids N+1 queries)."""
    def grouped(rows):
        out = defaultdict(list)
        for r in rows:
            out[r.date].append(r)
        return out

    foods = (await db.scalars(select(FoodLog).where(FoodLog.date.between(start, end)).order_by(FoodLog.date, FoodLog.time, FoodLog.id))).all()
    sessions = (await db.scalars(select(WorkoutSession).where(WorkoutSession.date.between(start, end)).order_by(WorkoutSession.id))).all()
    logs = (await db.scalars(select(WorkoutLog).where(WorkoutLog.date.between(start, end)).order_by(WorkoutLog.id))).all()
    bio = (await db.scalars(select(BioFeedback).where(BioFeedback.user_id == user.id, BioFeedback.date.between(start, end)).order_by(BioFeedback.timestamp))).all()
    summaries = (await db.scalars(select(DailySummary).where(DailySummary.user_id == user.id, DailySummary.date.between(start, end)))).all()
    return {
        "foods": grouped(foods),
        "sessions": grouped(sessions),
        "logs": grouped(logs),
        "bio": grouped(bio),
        "summaries": {s.date: s for s in summaries},
        "weight_before_start": await weight_before(db, user, start),
    }


def _is_day_complete(user: User, d: date, foods: list[FoodLog]) -> bool:
    now = now_for(user)
    if d < now.date():
        return True
    if d > now.date():
        return False
    minute = now.hour * 60 + now.minute
    if any(f.meal_type == "dinner" for f in foods):
        return True
    # a post-workout snack only ends the day after the evening gym session (a mid-day whey shake logged as
    # "post_workout" used to mark the day complete and fire end-of-day deficit alerts at lunchtime)
    gym = minutes_of(user.gym_return_time)
    if any(f.meal_type == "post_workout" for f in foods) and (gym is None or minute >= gym):
        return True
    bed = minutes_of(user.bedtime)
    return bed is not None and minute >= bed


def compute(user: User, d: date, data: dict, weight_kg: float) -> dict:
    """Pure computation of one day's summary from pre-loaded rows."""
    foods = data["foods"].get(d, [])
    sessions = data["sessions"].get(d, [])
    logs = data["logs"].get(d, [])
    summary: DailySummary | None = data["summaries"].get(d)

    totals = {k: sum(getattr(f, k) or 0 for f in foods) for k in ("calories", "protein", "carbs", "fat", "fibre")}

    # Exercise: lifting blocks counted once per session + cardio bouts. Strength rows carry 0 kcal.
    session_kcal = {s.id: energy.met_calories(s.lifting_met, weight_kg, s.lifting_duration_min) for s in sessions}
    cardio_kcal = {
        lg.id: energy.met_calories(lg.met_value, weight_kg, lg.cardio_duration_min) for lg in logs if lg.workout_type == "cardio"
    }
    exercise = sum(session_kcal.values()) + sum(cardio_kcal.values())

    steps = (summary.steps if summary else None) or user.avg_daily_steps
    bmr = energy.bmr_mifflin(weight_kg, user.height_cm, user.age, user.sex)
    neat, neat_note = energy.neat_calories(bmr, weight_kg, steps, user.activity_level)
    tef = energy.tef_calories(totals["protein"], totals["carbs"], totals["fat"])
    tdee = bmr + (neat or 0) + tef + exercise if bmr is not None else None
    deficit = energy.deficit(tdee, totals["calories"])

    notes = []
    if bmr is None:
        low, high = energy.bmr_range_unknown_age_sex(weight_kg, user.height_cm)
        notes.append(f"BMR pending age & sex. Indicative range if male aged 20–40: {low:,.0f}–{high:,.0f} kcal.")
    notes.append(f"NEAT {neat_note}.")
    notes.append("TEF = 25% protein + 7.5% carbs + 2% fat energy.")
    notes.append("Exercise = MET × 3.5 × kg ÷ 200 × minutes; lifting counted once per session (no double counting).")

    is_rest = WEEKDAYS[d.weekday()] == (user.rest_day or "sunday")
    complete = _is_day_complete(user, d, foods)
    missing_duration = any(not s.lifting_duration_min for s in sessions)
    alerts = rules.evaluate(
        rules.DayFacts(
            weight_kg=weight_kg,
            intake=totals["calories"],
            protein=totals["protein"],
            carbs=totals["carbs"],
            fat=totals["fat"],
            fibre=totals["fibre"],
            bmr=bmr,
            tdee=tdee,
            deficit=deficit,
            protein_g_per_kg_target=user.protein_target_g_per_kg,
            foods=foods,
            has_training=bool(sessions or logs),
            missing_workout_duration=missing_duration,
            is_rest_day=is_rest,
            day_complete=complete,
            sleep_hours=summary.sleep_hours if summary else None,
            sleep_target=user.sleep_target_hours,
            bloating_status=summary.bloating_status if summary else None,
            energy_level=summary.energy_level if summary else None,
            bedtime=user.bedtime,
            gym_return_time=user.gym_return_time,
        )
    )

    whey_scoops = sum((f.quantity or 1) for f in foods if "whey" in f.food_name.lower())
    result = {
        "id": summary.id if summary else None,
        "date": d.isoformat(),
        "day_number": day_number(user, d),
        "weekday": WEEKDAYS[d.weekday()].title(),
        "is_rest_day": is_rest,
        "morning_weight": summary.morning_weight if summary else None,
        "weight_used_kg": weight_kg,
        "total_calories": round(totals["calories"], 1),
        "total_protein": round(totals["protein"], 1),
        "total_carbs": round(totals["carbs"], 1),
        "total_fat": round(totals["fat"], 1),
        "total_fibre": round(totals["fibre"], 1),
        "whey_scoops": whey_scoops,
        "protein_per_kg": round(totals["protein"] / weight_kg, 2) if weight_kg else None,
        "estimated_exercise_calories": round(exercise),
        "estimated_bmr": round(bmr) if bmr is not None else None,
        "estimated_neat": round(neat) if neat is not None else None,
        "estimated_tef": round(tef),
        "estimated_tdee": round(tdee) if tdee is not None else None,
        "calorie_deficit": round(deficit) if deficit is not None else None,
        "deficit_status": "ok" if deficit is not None else "pending",
        "coach_advice": (summary.coach_advice if summary and summary.coach_advice else rules.summary_text(alerts)),
        "coach_advice_source": summary.coach_advice_source if summary and summary.coach_advice else "rules",
        "alerts": alerts,
        "has_workout": bool(sessions or logs),
        "food_count": len(foods),
        "_session_kcal": session_kcal,
        "_cardio_kcal": cardio_kcal,
        "_energy_notes": notes,
        "_complete": complete,
        "_formula_tdee": round(tdee) if tdee is not None else None,
        "adaptive_tdee": None,
        "adaptive_confidence": 0.0,
        "tdee_source": "formula" if tdee is not None else "pending",
    }
    for fld in CHECKIN_FIELDS:
        result[fld] = getattr(summary, fld) if summary else ([] if fld == "soreness_muscles" else None)
    return result


def public(day: dict) -> dict:
    return {k: v for k, v in day.items() if not k.startswith("_")}


ADAPTIVE_HISTORY_DAYS = 180
ADAPTIVE_MIN_CONFIDENCE = 0.5


def adaptive_inputs(days: list[dict]) -> list[energy_model.DayInput]:
    """Kalman inputs: only complete, logged days contribute intake."""
    return [
        energy_model.DayInput(
            day=date.fromisoformat(d["date"]),
            intake=d["total_calories"] if d["food_count"] and d["_complete"] else None,
            weight=d["morning_weight"],
        )
        for d in days
    ]


def adaptive_prior(days: list[dict], user: User) -> float:
    formula = [d["_formula_tdee"] for d in days if d["_formula_tdee"]]
    if formula:
        return sum(formula) / len(formula)
    return 30.0 * (user.current_weight or user.starting_weight)  # ~30 kcal/kg until biometrics exist


async def _attach_adaptive(db: AsyncSession, user: User, days: list[dict]) -> None:
    """Adds the Kalman-filtered expenditure to each day and, when confident, uses it for TDEE/deficit."""
    if not days:
        return
    end = date.fromisoformat(days[-1]["date"])
    history = await compute_range(
        db, user, max(user.start_date, end - timedelta(days=ADAPTIVE_HISTORY_DAYS)), end, adaptive=False
    )
    if not history:
        return
    estimates = energy_model.run_filter(
        adaptive_inputs(history), adaptive_prior(history, user), history[0]["weight_used_kg"]
    )
    by_date = {e.day.isoformat(): e for e in estimates}
    for day in days:
        est = by_date.get(day["date"])
        if est is None:
            continue
        conf = round(est.confidence, 2)
        day["adaptive_tdee"] = round(est.expenditure) if conf >= 0.3 else None
        day["adaptive_confidence"] = conf
        formula = day["_formula_tdee"]
        if conf < ADAPTIVE_MIN_CONFIDENCE:
            continue
        tdee = est.expenditure if formula is None else formula * (1 - conf) + est.expenditure * conf
        day["tdee_source"] = "adaptive" if formula is None else "blended"
        day["estimated_tdee"] = round(tdee)
        day["calorie_deficit"] = round(tdee - day["total_calories"])
        day["deficit_status"] = "ok"


async def compute_range(db: AsyncSession, user: User, start: date, end: date, adaptive: bool = True) -> list[dict]:
    days, _ = await compute_range_data(db, user, start, end, adaptive)
    return days


async def compute_range_data(db: AsyncSession, user: User, start: date, end: date, adaptive: bool = True) -> tuple[list[dict], dict]:
    """Like compute_range, plus the raw rows it was computed from (foods, sessions, logs, bio …)."""
    data = await load_range(db, user, start, end)
    weight = data["weight_before_start"] or user.current_weight or user.starting_weight
    days = []
    d = start
    while d <= end:
        s = data["summaries"].get(d)
        if s and s.morning_weight:
            weight = s.morning_weight
        days.append(compute(user, d, data, weight))
        d += timedelta(days=1)
    if adaptive:
        await _attach_adaptive(db, user, days)
    return days, data


async def compute_day(db: AsyncSession, user: User, d: date) -> tuple[dict, dict]:
    data = await load_range(db, user, d, d)
    s = data["summaries"].get(d)
    weight = (s.morning_weight if s and s.morning_weight else None) or data["weight_before_start"] or user.current_weight or user.starting_weight
    day = compute(user, d, data, weight)
    await _attach_adaptive(db, user, [day])
    return day, data


async def recompute(db: AsyncSession, user: User, d: date) -> dict:
    """Recompute a day and persist cached totals + per-row calories."""
    day, data = await compute_day(db, user, d)
    summary = await ensure_summary(db, user, d)
    summary.day_number = day["day_number"]
    summary.total_calories = day["total_calories"]
    summary.total_protein = day["total_protein"]
    summary.total_carbs = day["total_carbs"]
    summary.total_fat = day["total_fat"]
    summary.total_fibre = day["total_fibre"]
    summary.estimated_exercise_calories = day["estimated_exercise_calories"]
    summary.estimated_tdee = day["estimated_tdee"]
    summary.calorie_deficit = day["calorie_deficit"]
    for s in data["sessions"].get(d, []):
        s.estimated_calories = round(day["_session_kcal"].get(s.id, 0), 1)
    for lg in data["logs"].get(d, []):
        lg.estimated_calories = round(day["_cardio_kcal"].get(lg.id, 0), 1)
    await db.commit()
    day["id"] = summary.id
    return day


def meal_breakdown(foods: list[FoodLog]) -> list[dict]:
    groups: dict[str, list[FoodLog]] = defaultdict(list)
    for f in foods:
        groups[f.meal_type].append(f)
    out = []
    for meal in sorted(groups, key=lambda m: MEAL_ORDER.index(m) if m in MEAL_ORDER else 99):
        items = groups[meal]
        out.append(
            {
                "meal_type": meal,
                "calories": round(sum(i.calories for i in items), 1),
                "protein": round(sum(i.protein for i in items), 1),
                "carbs": round(sum(i.carbs for i in items), 1),
                "fat": round(sum(i.fat for i in items), 1),
                "fibre": round(sum(i.fibre for i in items), 1),
                "items": len(items),
            }
        )
    return out


def macro_split(day: dict) -> dict:
    p, c, f = day["total_protein"] * 4, day["total_carbs"] * 4, day["total_fat"] * 9
    total = p + c + f
    if not total:
        return {"protein_pct": 0, "carbs_pct": 0, "fat_pct": 0}
    return {"protein_pct": round(100 * p / total), "carbs_pct": round(100 * c / total), "fat_pct": round(100 * f / total)}
