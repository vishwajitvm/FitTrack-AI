"""Training load analytics (sports science, no LLM).

Session load (arbitrary units) = minutes × session RPE (Foster's session-RPE method).
Acute / chronic load = exponentially weighted moving averages, λ = 2/(N+1), N = 7 and 28.
ACWR = acute ÷ chronic. Monotony = mean ÷ SD of the last 7 days' load; strain = 7-day load × monotony.
These describe how training is trending; on their own they don't predict injury.
"""
import statistics
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import WorkoutLog, WorkoutSession

ACUTE_DAYS, CHRONIC_DAYS = 7, 28
DEFAULT_LIFTING_RPE = 7.0
ZONES = [(0.8, "low"), (1.3, "optimal"), (1.5, "high"), (float("inf"), "very_high")]


def parse_rpe(value: str | None) -> float | None:
    """Parses "8", "8-9", "7.5" → number (midpoint for ranges)."""
    if not value:
        return None
    parts = [p for p in value.replace("–", "-").split("-") if p.strip()]
    try:
        nums = [float(p) for p in parts]
    except ValueError:
        return None
    return sum(nums) / len(nums) if nums else None


def _cardio_rpe(met: float | None) -> float:
    """Rough MET → RPE mapping for cardio bouts (MET 4.5 ≈ RPE 6)."""
    return max(3.0, min(9.0, (met or 4.5) + 1.5))


def zone(acwr: float | None) -> str | None:
    if acwr is None:
        return None
    return next(label for limit, label in ZONES if acwr < limit)


async def daily_loads(db: AsyncSession, start: date, end: date) -> dict[date, float]:
    sessions = (await db.scalars(select(WorkoutSession).where(WorkoutSession.date.between(start, end)))).all()
    logs = (await db.scalars(select(WorkoutLog).where(WorkoutLog.date.between(start, end)))).all()
    strength_rpe: dict[int, list[float]] = {}
    for lg in logs:
        if lg.workout_type == "strength" and lg.session_id and (r := parse_rpe(lg.rpe)):
            strength_rpe.setdefault(lg.session_id, []).append(r)

    loads: dict[date, float] = {}
    for s in sessions:
        if not s.lifting_duration_min:
            continue
        rpe = s.session_rpe or (statistics.mean(strength_rpe[s.id]) if s.id in strength_rpe else DEFAULT_LIFTING_RPE)
        loads[s.date] = loads.get(s.date, 0.0) + s.lifting_duration_min * rpe
    for lg in logs:
        if lg.workout_type == "cardio" and lg.cardio_duration_min:
            rpe = parse_rpe(lg.rpe) or _cardio_rpe(lg.met_value)
            loads[lg.date] = loads.get(lg.date, 0.0) + lg.cardio_duration_min * rpe
    return loads


def analyse_loads(loads: dict[date, float], start: date, end: date) -> dict:
    acute_l, chronic_l = 2 / (ACUTE_DAYS + 1), 2 / (CHRONIC_DAYS + 1)
    acute = chronic = 0.0
    points = []
    d = start
    history: list[float] = []
    first_training: int | None = None
    while d <= end:
        load = loads.get(d, 0.0)
        acute = acute_l * load + (1 - acute_l) * acute
        chronic = chronic_l * load + (1 - chronic_l) * chronic
        history.append(load)
        if load > 0 and first_training is None:
            first_training = len(history)
        trained_days_span = len(history) - first_training if first_training else 0
        # ACWR is unstable until there are ~2 weeks of training history.
        acwr = round(acute / chronic, 2) if chronic > 1 and trained_days_span >= 14 else None
        points.append({"date": d, "load": round(load), "acute": round(acute, 1), "chronic": round(chronic, 1), "acwr": acwr})
        d += timedelta(days=1)

    last7 = history[-7:]
    weekly = sum(last7)
    monotony = None
    if len(last7) == 7 and statistics.pstdev(last7) > 0:
        monotony = round(statistics.mean(last7) / statistics.pstdev(last7), 2)
    current = points[-1]["acwr"] if points else None
    notes = []
    if current is None:
        notes.append("ACWR needs about 2–4 weeks of training history before it is meaningful.")
    if current is not None and current > 1.5:
        notes.append("Training load jumped well above your recent average — consider an easier day.")
    if monotony is not None and monotony > 2:
        notes.append("Very similar load every day (high monotony) — vary hard and easy days.")
    return {
        "points": points,
        "acwr": current,
        "acwr_zone": zone(current),
        "monotony": monotony,
        "strain": round(weekly * monotony) if monotony is not None else None,
        "weekly_load": round(weekly),
        "notes": notes,
    }


async def training_load(db: AsyncSession, end: date, days: int = 56) -> dict:
    # Warm the EWMAs up with extra history before the displayed window.
    warmup_start = end - timedelta(days=days + CHRONIC_DAYS)
    loads = await daily_loads(db, warmup_start, end)
    result = analyse_loads(loads, warmup_start, end)
    window_start = end - timedelta(days=days - 1)
    result["points"] = [p for p in result["points"] if p["date"] >= window_start]
    return result
