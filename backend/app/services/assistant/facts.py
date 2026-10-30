"""The fact sheet the assistant answers from: every number is computed here from the logs, so the LLM
only explains them (and the offline answers use the same facts)."""
import re
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.services.assistant import dates, projection
from app.services.ml import energy_model
from app.services.tracker import daily
from app.services.tracker.history import build_row
from app.services.tracker.metrics import profile_metrics

HISTORY_DAYS = 120
RECENT_DETAIL_DAYS = 7
MAX_TABLE_DAYS = 60
BASIS_DAYS = 14
TREND_MIN_WEIGH_INS = 7
DEFAULT_WEEKS = [1, 2, 4, 8, 12, 26]


def _r(v, digits=0):
    return None if v is None else round(v, digits) if digits else round(v)


def day_detail(day: dict, data: dict) -> dict:
    """Everything logged on one day, in plain field names."""
    d = date.fromisoformat(day["date"])
    return {
        "date": day["date"],
        "weekday": day["weekday"],
        "day_number": day["day_number"],
        "complete": day["_complete"],
        "is_rest_day": day["is_rest_day"],
        "morning_weight_kg": day["morning_weight"],
        "intake": {k: day[f"total_{k}"] for k in ("calories", "protein", "carbs", "fat", "fibre")},
        "protein_g_per_kg": day["protein_per_kg"],
        "energy": {
            "bmr": day["estimated_bmr"], "neat": day["estimated_neat"], "tef": day["estimated_tef"],
            "exercise": day["estimated_exercise_calories"], "tdee": day["estimated_tdee"], "tdee_source": day["tdee_source"],
            "deficit": day["calorie_deficit"], "deficit_status": day["deficit_status"],
        },
        "foods": [
            {
                "time": f.time, "meal": f.meal_type, "food": f.food_name, "quantity": f.quantity, "unit": f.portion_unit,
                "grams": f.weight_grams, "kcal": _r(f.calories), "protein": _r(f.protein, 1), "carbs": _r(f.carbs, 1), "fat": _r(f.fat, 1),
            }
            for f in data["foods"].get(d, [])
        ],
        "training_sessions": [
            {"split": s.split, "minutes": s.lifting_duration_min, "kcal": _r(s.estimated_calories), "session_rpe": s.session_rpe, "started_at": s.started_at}
            for s in data["sessions"].get(d, [])
        ],
        "exercises": [
            {
                "exercise": lg.exercise_name, "type": lg.workout_type, "muscle": lg.target_muscle, "sets": lg.sets, "reps": lg.reps,
                "weight_kg": lg.weight_kg, "minutes": lg.cardio_duration_min, "kcal": _r(lg.estimated_calories) if lg.workout_type == "cardio" else None,
            }
            for lg in data["logs"].get(d, [])
        ],
        "check_in": {f: day.get(f) for f in daily.CHECKIN_FIELDS if day.get(f) not in (None, [], "")},
        "symptoms": [
            {"symptom": b.symptom_type, "severity_0_3": b.severity, "suspected_trigger": b.trigger_suspect, "notes": b.notes}
            for b in data["bio"].get(d, [])
        ],
        "alerts": [a["title"] for a in day["alerts"]],
    }


def _averages(days: list[dict]) -> dict | None:
    if not days:
        return None
    avg = projection.average
    return {
        "days": len(days),
        "from": days[0]["date"],
        "to": days[-1]["date"],
        "intake_kcal": _r(avg([d["total_calories"] for d in days])),
        "protein_g": _r(avg([d["total_protein"] for d in days]), 1),
        "carbs_g": _r(avg([d["total_carbs"] for d in days]), 1),
        "fat_g": _r(avg([d["total_fat"] for d in days]), 1),
        "exercise_kcal": _r(avg([d["estimated_exercise_calories"] for d in days])),
        "tdee_kcal": _r(avg([d["estimated_tdee"] for d in days])),
        "deficit_kcal": _r(avg([d["calorie_deficit"] for d in days])),
        "protein_g_per_kg": _r(avg([d["protein_per_kg"] for d in days]), 2),
        "training_days": sum(1 for d in days if d["has_workout"]),
    }


def _weight(days: list[dict], user: User, today: date) -> dict:
    weigh_ins = [(d["date"], d["morning_weight"]) for d in days if d["morning_weight"]]
    out = {
        "starting_weight_kg": user.starting_weight,
        "latest_weigh_in": {"date": weigh_ins[-1][0], "kg": weigh_ins[-1][1]} if weigh_ins else None,
        "first_weigh_in": {"date": weigh_ins[0][0], "kg": weigh_ins[0][1]} if weigh_ins else None,
        "weigh_ins": len(weigh_ins),
        "change_since_start_kg": round(weigh_ins[-1][1] - user.starting_weight, 2) if weigh_ins else None,
        "target_weight_kg": user.target_weight_kg,
        "trend_weight_kg": None,
        "observed_rate_kg_per_week": None,
        "rate_status": "insufficient_data",
        "forecast_from_trend": None,
    }
    if not days or not weigh_ins:
        return out
    estimates = energy_model.run_filter(daily.adaptive_inputs(days), daily.adaptive_prior(days, user), days[0]["weight_used_kg"])
    first = next(i for i, d in enumerate(days) if d["morning_weight"])
    trend_points = [(date.fromisoformat(d["date"]), e.trend) for d, e in list(zip(days, estimates))[first:]][-14:]
    trend = estimates[-1].trend
    rate = energy_model.regression_rate(trend_points) if len(weigh_ins) >= 3 else None
    fc = energy_model.forecast(trend, rate, user.target_weight_kg, today)
    out.update(
        trend_weight_kg=round(trend, 2),
        observed_rate_kg_per_week=round(rate, 2) if rate is not None else None,
        rate_status=energy_model.rate_status(rate, trend, len(weigh_ins)),
        forecast_from_trend={"eta_date": fc["eta_date"], "days_remaining": fc["days_remaining"]} if fc else None,
    )
    return out


def _numbers_asked(question: str) -> dict:
    """A calorie intake or a horizon the user asked about ("if I eat 1800 kcal", "in 3 months")."""
    q = question.lower().replace(",", "")
    out: dict = {}
    deficit = re.search(r"\b(\d{2,4})\s*(?:kcal|calories|cals?)?\s*(?:a day|per day|daily)?\s*deficit\b", q)
    intake = re.search(r"\b(\d{3,4})\s*(?:kcal|calories|cals?)\b", q)
    if deficit:
        out["deficit_kcal"] = int(deficit.group(1))
    elif intake:
        out["intake_kcal"] = int(intake.group(1))
    m = re.search(r"\b(\d{1,3})\s*(week|weeks|month|months|day|days)\b", q)
    if m:
        n, unit = int(m.group(1)), m.group(2)
        weeks = round(n * 4.345) if unit.startswith("month") else n if unit.startswith("week") else max(1, round(n / 7))
        if 1 <= weeks <= 104:
            out["horizon_weeks"] = weeks
    return out


def _projection(weight: float, intake: float, burn: float, today: date, weeks: list[int], target: float | None) -> dict:
    p = projection.project(weight, intake, burn, today, weeks, target)
    return {
        "start_weight_kg": round(weight, 1),
        "intake_kcal": round(intake),
        "burn_kcal": round(burn),
        "deficit_kcal": round(burn - intake),
        "weekly_loss_kg_now": p.weekly_loss_kg,
        "verdict": projection.rate_label(p.weekly_loss_kg, weight),
        "weeks": p.points,
        "target_weight_kg": target,
        "target_date_constant": p.target_date_constant,
        "target_date_adaptive": p.target_date_adaptive,
    }


async def gather(db: AsyncSession, user: User, question: str) -> dict:
    today = daily.today_for(user)
    start = min(today, max(user.start_date, today - timedelta(days=HISTORY_DAYS - 1)))
    days, data = await daily.compute_range_data(db, user, start, today)
    metrics = await profile_metrics(db, user)
    asked_dates = [d for d in dates.find_dates(question, today, user.start_date) if d >= start]
    window = dates.find_window(question)
    asked = _numbers_asked(question)

    logged = [d for d in days if d["food_count"] or d["has_workout"] or d["morning_weight"]]
    complete = [d for d in days if d["food_count"] and d["_complete"] and d["estimated_tdee"] is not None]
    weight = _weight(days, user, today)
    # the smoothed trend only after ~a week of weigh-ins; before that the latest weigh-in is the honest start
    latest = (weight["latest_weigh_in"] or {}).get("kg")
    trend = weight["trend_weight_kg"] if weight["weigh_ins"] >= TREND_MIN_WEIGH_INS else None
    weight_now = trend or latest or user.current_weight or user.starting_weight

    basis = complete[-BASIS_DAYS:]
    weeks = sorted(set(DEFAULT_WEEKS + ([asked["horizon_weeks"]] if "horizon_weeks" in asked else [])))
    projections: dict = {"basis_days": len(basis), "from_logged_average": None, "scenario": None,
                         "method": "Energy balance: 7,700 kcal ≈ 1 kg. 'constant' keeps today's deficit; 'adaptive' lets your "
                                   "daily burn fall as you get lighter (more realistic after ~4 weeks). Week 1–2 on the scale "
                                   "also moves with water and glycogen."}
    if basis:
        intake = projection.average([d["total_calories"] for d in basis])
        burn = projection.average([d["estimated_tdee"] for d in basis])
        projections["from_logged_average"] = _projection(weight_now, intake, burn, today, weeks, user.target_weight_kg)
        if "intake_kcal" in asked:
            projections["scenario"] = {"asked": f"eating {asked['intake_kcal']} kcal a day"} | _projection(
                weight_now, asked["intake_kcal"], burn, today, weeks, user.target_weight_kg)
        elif "deficit_kcal" in asked:
            projections["scenario"] = {"asked": f"a {asked['deficit_kcal']} kcal daily deficit"} | _projection(
                weight_now, burn - asked["deficit_kcal"], burn, today, weeks, user.target_weight_kg)

    detail_dates = list(asked_dates)
    for d in reversed(logged[-RECENT_DETAIL_DAYS:]):
        if date.fromisoformat(d["date"]) not in detail_dates:
            detail_dates.append(date.fromisoformat(d["date"]))
    by_date = {d["date"]: d for d in days}
    previous = data["weight_before_start"]
    rows = []
    for d in days:
        rows.append(build_row(d, data, previous, today))
        if d["morning_weight"]:
            previous = d["morning_weight"]
    table = [
        {k: r[k] for k in ("date", "weekday", "morning_weight", "total_calories", "total_protein", "estimated_exercise_calories",
                           "estimated_tdee", "calorie_deficit", "sleep_hours", "energy_level", "status")}
        | {"complete": r["complete"], "workout": r["workout"]["splits"] or None, "foods": [f.food_name for f in data["foods"].get(date.fromisoformat(r["date"]), [])]}
        for r in rows if r["food_count"] or r["workout"]["exercise_count"] or r["workout"]["splits"] or r["morning_weight"]
    ][-MAX_TABLE_DAYS:]

    weight["current_weight_kg"] = round(weight_now, 1)
    recent = _averages(complete[-7:])
    protein = metrics["protein_target_g"] or {}
    gaps = None
    if recent:  # what is left to each target, per day on average (positive = short of it)
        gaps = {
            "based_on_days": recent["days"],
            "protein_to_min_g": _r(protein["min"] - recent["protein_g"], 1) if protein.get("min") else None,
            "protein_to_target_g": _r(protein["target"] - recent["protein_g"], 1) if protein.get("target") else None,
            "kcal_to_calorie_target": _r(metrics["calorie_target"] - recent["intake_kcal"]) if metrics["calorie_target"] else None,
        }
    if user.target_weight_kg:
        gaps = (gaps or {}) | {"kg_to_target_weight": round(weight_now - user.target_weight_kg, 1)}
    if weight["weigh_ins"] < TREND_MIN_WEIGH_INS:
        weight["trend_weight_kg"] = None  # too few weigh-ins for a trend worth quoting
    return {
        "today": today,
        "today_weekday": today.strftime("%A"),
        "profile": {
            "name": user.name, "age": user.age, "sex": user.sex, "height_cm": user.height_cm, "goal": user.goal,
            "start_date": user.start_date, "days_since_start": (today - user.start_date).days + 1,
            "diet_type": user.diet_type, "rest_day": user.rest_day, "gym_return_time": user.gym_return_time, "bedtime": user.bedtime,
            "protein_target_g": metrics["protein_target_g"], "bmr": metrics["bmr"], "bmi": metrics["bmi"],
            "bmi_category": metrics["bmi_category"], "calorie_target": metrics["calorie_target"],
            "missing_for_calculations": metrics["missing_fields"],
        },
        "weight": weight,
        "averages": {
            "last_7_complete_days": _averages(complete[-7:]),
            "last_14_complete_days": _averages(complete[-14:]),
            "all_complete_days": _averages(complete),
            **({f"last_{window}_days": _averages([d for d in complete if date.fromisoformat(d["date"]) > today - timedelta(days=window)])} if window else {}),
        },
        "gaps": gaps,
        "projections": projections,
        "logged_days": len(logged),
        "complete_days": len(complete),
        "asked_dates": asked_dates,
        "asked_dates_without_logs": [d for d in asked_dates if d.isoformat() not in {r["date"] for r in table}],
        "day_table": table,
        "day_details": [day_detail(by_date[d.isoformat()], data) for d in detail_dates if d.isoformat() in by_date],
    }
