"""Data-quality checks: catches typos and implausible entries before they skew your numbers.

- Atwater consistency: logged kcal vs 4·protein + 4·carbs + 9·fat.
- Impossible energy density: > 9.2 kcal per gram (pure fat is 9).
- Unusual day: robust z-score (median / MAD) of daily intake vs your last 30 days.
- Weigh-in outliers: flagged by the Kalman filter (see energy_model).
- Duplicate entries: same food, same meal, same time, same day.
"""
from collections import Counter
from datetime import date, timedelta

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FoodLog, User
from app.services.ml import energy_model
from app.services.tracker import daily

ATWATER_TOLERANCE = 0.25
MAX_KCAL_PER_GRAM = 9.2
ROBUST_Z_LIMIT = 3.5


def _robust_z(values: list[float], x: float) -> float:
    arr = np.array(values, dtype=float)
    median = float(np.median(arr))
    mad = float(np.median(np.abs(arr - median))) or 1.0
    return 0.6745 * (x - median) / mad


async def detect(db: AsyncSession, user: User, days: int = 30) -> list[dict]:
    end = daily.today_for(user)
    start = max(user.start_date, end - timedelta(days=days - 1))
    foods = (await db.scalars(select(FoodLog).where(FoodLog.date.between(start, end)))).all()
    out: list[dict] = []

    for f in foods:
        atwater = 4 * f.protein + 4 * f.carbs + 9 * f.fat
        if f.calories > 60 and atwater > 0 and abs(f.calories - atwater) / f.calories > ATWATER_TOLERANCE:
            out.append({"date": f.date, "kind": "atwater_mismatch", "severity": "warning", "ref_id": f.id,
                        "message": f"{f.food_name}: {f.calories:.0f} kcal logged but its macros add up to {atwater:.0f} kcal. "
                                   "One of the numbers is probably a typo."})
        if f.weight_grams and f.weight_grams > 0 and f.calories / f.weight_grams > MAX_KCAL_PER_GRAM:
            out.append({"date": f.date, "kind": "impossible_density", "severity": "warning", "ref_id": f.id,
                        "message": f"{f.food_name}: {f.calories / f.weight_grams:.1f} kcal per gram is physically impossible "
                                   "(pure oil is 9). Check the weight or calories."})

    keys = Counter((f.date, f.meal_type, f.time, f.food_name.lower(), round(f.calories)) for f in foods)
    for (d, meal, time, name, kcal), count in keys.items():
        if count > 1:
            out.append({"date": d, "kind": "duplicate_entry", "severity": "info", "ref_id": None,
                        "message": f"'{name}' ({kcal} kcal) is logged {count}× for {meal.replace('_', ' ')}"
                                   f"{' at ' + time if time else ''}. Delete the extra if it was added twice."})

    summaries = await daily.compute_range(db, user, start, end, adaptive=False)
    complete = [d for d in summaries if d["food_count"] and d["_complete"]]
    intakes = [d["total_calories"] for d in complete]
    if len(intakes) >= 7:
        for d in complete:
            z = _robust_z(intakes, d["total_calories"])
            if abs(z) > ROBUST_Z_LIMIT:
                out.append({"date": date.fromisoformat(d["date"]), "kind": "unusual_day", "severity": "info", "ref_id": None,
                            "message": f"{d['total_calories']:.0f} kcal is very {'high' if z > 0 else 'low'} compared with "
                                       "your usual days — was something missed or double-logged?"})

    estimates = energy_model.run_filter(
        daily.adaptive_inputs(summaries), daily.adaptive_prior(summaries, user), summaries[0]["weight_used_kg"]
    ) if summaries else []
    for est, d in zip(estimates, summaries):
        if est.outlier and d["morning_weight"]:
            out.append({"date": est.day, "kind": "weight_outlier", "severity": "warning", "ref_id": None,
                        "message": f"Weigh-in {d['morning_weight']} kg is far from your trend ({est.trend:.1f} kg). "
                                   "It was ignored for the trend — check for a typo."})
    return sorted(out, key=lambda a: a["date"], reverse=True)
