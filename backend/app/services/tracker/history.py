"""Day-by-day history: one row per logged day, newest first, with search, filters and pagination.

Rows are computed live from the logs (same numbers as the daily tracker); the detail of a row is
`GET /api/daily/{date}`.
"""
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.services.tracker import daily

MAX_DAYS = 366
SERIES_DAYS = 90
LEVEL_RANK = {"critical": 3, "warning": 2, "info": 1, "ok": 0}
SORT_KEYS = {
    "date": lambda r: r["date"],
    "calories": lambda r: r["total_calories"],
    "protein": lambda r: r["total_protein"],
    "deficit": lambda r: r["calorie_deficit"] if r["calorie_deficit"] is not None else float("-inf"),
    "weight": lambda r: r["morning_weight"] if r["morning_weight"] is not None else float("-inf"),
    "exercise": lambda r: r["estimated_exercise_calories"],
}


@dataclass
class HistoryQuery:
    page: int = 1
    page_size: int = 10
    q: str = ""
    start: date | None = None
    end: date | None = None
    workout: str = "any"  # any | trained | rest
    split: str | None = None
    balance: str = "any"  # any | deficit | surplus | pending
    status: str = "any"  # any | critical | warning | ok
    weighed: bool | None = None
    sort: str = "date"
    order: str = "desc"


def _has_data(day: dict, data: dict) -> bool:
    d = date.fromisoformat(day["date"])
    checkin = any(day.get(f) not in (None, [], "") for f in daily.CHECKIN_FIELDS)
    return bool(day["food_count"] or day["has_workout"] or day["morning_weight"] or checkin or data["bio"].get(d))


def _status(alerts: list[dict]) -> str:
    worst = max((a["level"] for a in alerts), key=lambda lv: LEVEL_RANK.get(lv, 0), default="ok")
    return worst if worst in ("critical", "warning") else "ok"


def build_row(day: dict, data: dict, previous_weight: float | None, today: date) -> dict:
    """A compact table row for one computed day."""
    d = date.fromisoformat(day["date"])
    foods = data["foods"].get(d, [])
    sessions = data["sessions"].get(d, [])
    logs = data["logs"].get(d, [])
    weight = day["morning_weight"]
    cardio_min = sum(lg.cardio_duration_min or 0 for lg in logs if lg.workout_type == "cardio")
    lifting_min = sum(s.lifting_duration_min or 0 for s in sessions)
    splits = sorted({s.split for s in sessions} | ({"cardio"} if cardio_min and not sessions else set()))
    alerts = day["alerts"]
    return {
        "date": day["date"],
        "day_number": day["day_number"],
        "weekday": day["weekday"],
        "is_today": d == today,
        "is_rest_day": day["is_rest_day"],
        "complete": day["_complete"],
        "morning_weight": weight,
        "weight_change": round(weight - previous_weight, 2) if weight and previous_weight else None,
        "total_calories": day["total_calories"],
        "total_protein": day["total_protein"],
        "total_carbs": day["total_carbs"],
        "total_fat": day["total_fat"],
        "protein_per_kg": day["protein_per_kg"],
        "estimated_exercise_calories": day["estimated_exercise_calories"],
        "estimated_tdee": day["estimated_tdee"],
        "calorie_deficit": day["calorie_deficit"],
        "deficit_status": day["deficit_status"],
        "food_count": len(foods),
        "foods_preview": [f.food_name for f in foods[:4]],
        "workout": {
            "splits": splits,
            "lifting_min": round(lifting_min) or None,
            "cardio_min": round(cardio_min) or None,
            "exercise_count": len(logs),
            "exercises_preview": [lg.exercise_name for lg in logs[:4]],
        },
        "energy_level": day["energy_level"],
        "sleep_hours": day["sleep_hours"],
        "mood": day["mood"],
        "bloating_status": day["bloating_status"],
        "steps": day["steps"],
        "status": _status(alerts),
        "alerts_count": len(alerts),
        "top_alert": max(alerts, key=lambda a: LEVEL_RANK.get(a["level"], 0))["title"] if alerts else None,
    }


def summarize(rows: list[dict]) -> dict:
    """Averages and a date-ordered series over every matching day (not just the page shown)."""
    ordered = sorted(rows, key=lambda r: r["date"])
    food_days = [r for r in ordered if r["food_count"]]
    deficits = [r["calorie_deficit"] for r in food_days if r["calorie_deficit"] is not None]
    weights = [r["morning_weight"] for r in ordered if r["morning_weight"]]
    avg = lambda vals: round(sum(vals) / len(vals), 1) if vals else None  # noqa: E731
    return {
        "days": len(ordered),
        "food_days": len(food_days),
        "trained_days": sum(1 for r in ordered if r["workout"]["splits"] or r["workout"]["exercise_count"]),
        "avg_calories": avg([r["total_calories"] for r in food_days]),
        "avg_protein": avg([r["total_protein"] for r in food_days]),
        "avg_deficit": avg(deficits),
        "weigh_ins": len(weights),
        "weight_change": round(weights[-1] - weights[0], 2) if len(weights) > 1 else None,
        "series": [
            {"date": r["date"], "calories": r["total_calories"] if r["food_count"] else None, "protein": r["total_protein"] if r["food_count"] else None,
             "deficit": r["calorie_deficit"] if r["food_count"] else None, "weight": r["morning_weight"]}
            for r in ordered[-SERIES_DAYS:]
        ],
    }


def _search_text(day: dict, data: dict, row: dict) -> str:
    d = date.fromisoformat(day["date"])
    parts = [row["date"], row["weekday"], " ".join(row["workout"]["splits"]), day.get("notes") or "", day.get("soreness_notes") or ""]
    for f in data["foods"].get(d, []):
        parts += [f.food_name, f.meal_type.replace("_", " "), " ".join(f.ingredients_json or []), f.notes or ""]
    for s in data["sessions"].get(d, []):
        parts += [s.split, s.notes or ""]
    for lg in data["logs"].get(d, []):
        parts += [lg.exercise_name, lg.target_muscle or "", lg.notes or ""]
    for b in data["bio"].get(d, []):
        parts += [b.symptom_type.replace("_", " "), b.trigger_suspect or "", b.notes or ""]
    return " ".join(parts).lower()


def matches(row: dict, text: str, q: HistoryQuery) -> bool:
    if q.q and not all(term in text for term in q.q.lower().split()):
        return False
    trained = bool(row["workout"]["splits"] or row["workout"]["exercise_count"])
    if q.workout == "trained" and not trained:
        return False
    if q.workout == "rest" and trained:
        return False
    if q.split and q.split not in row["workout"]["splits"]:
        return False
    deficit = row["calorie_deficit"]
    if q.balance == "deficit" and not (deficit is not None and deficit > 0):
        return False
    if q.balance == "surplus" and not (deficit is not None and deficit <= 0):
        return False
    if q.balance == "pending" and deficit is not None:
        return False
    if q.status != "any" and row["status"] != q.status:
        return False
    if q.weighed is not None and bool(row["morning_weight"]) != q.weighed:
        return False
    return True


async def history(db: AsyncSession, user: User, q: HistoryQuery) -> dict:
    today = daily.today_for(user)
    end = min(q.end or today, today)
    start = max(q.start or user.start_date, end - timedelta(days=MAX_DAYS - 1))
    if start > end:
        return {"items": [], "total": 0, "page": 1, "page_size": q.page_size, "pages": 0, "range": {"start": start, "end": end}, "summary": summarize([])}
    days, data = await daily.compute_range_data(db, user, start, end)

    rows, previous = [], data["weight_before_start"]
    for day in days:
        row = build_row(day, data, previous, today)
        if day["morning_weight"]:
            previous = day["morning_weight"]
        if (_has_data(day, data) or row["is_today"]) and matches(row, _search_text(day, data, row), q):
            rows.append(row)

    rows.sort(key=SORT_KEYS.get(q.sort, SORT_KEYS["date"]), reverse=q.order != "asc")
    total = len(rows)
    pages = max(1, -(-total // q.page_size))
    page = min(max(1, q.page), pages)
    first = (page - 1) * q.page_size
    return {
        "items": rows[first:first + q.page_size],
        "total": total,
        "page": page,
        "page_size": q.page_size,
        "pages": pages,
        "range": {"start": start, "end": end},
        "summary": summarize(rows),
    }
