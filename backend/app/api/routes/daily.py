from datetime import date, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.serializers import biofeedback_out, food_out, session_out, workout_out
from app.db.session import get_db
from app.schemas.tracking import CheckIn
from app.services.coach import advisor
from app.services.data.exporter import sync_if_enabled
from app.services.tracker import daily

router = APIRouter(prefix="/daily", tags=["Daily tracker"])

MAX_RANGE_DAYS = 366


@router.get("")
async def list_days(start: date | None = None, end: date | None = None, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    end = end or daily.today_for(user)
    start = start or end - timedelta(days=6)
    if start > end:
        raise HTTPException(400, "start must be before end")
    if (end - start).days > MAX_RANGE_DAYS:
        raise HTTPException(400, f"Range too large (max {MAX_RANGE_DAYS} days)")
    return [daily.public(d) for d in await daily.compute_range(db, user, start, end)]


@router.get("/{day}")
async def day_detail(day: date, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    summary, data = await daily.compute_day(db, user, day)
    foods = data["foods"].get(day, [])
    return {
        "summary": daily.public(summary),
        "foods": [food_out(f) for f in foods],
        "sessions": [session_out(s) for s in data["sessions"].get(day, [])],
        "workouts": [workout_out(w) for w in data["logs"].get(day, [])],
        "biofeedback": [biofeedback_out(b) for b in data["bio"].get(day, [])],
        "energy": {
            "bmr": summary["estimated_bmr"],
            "neat": summary["estimated_neat"],
            "tef": summary["estimated_tef"],
            "exercise": summary["estimated_exercise_calories"],
            "tdee": summary["estimated_tdee"],
            "intake": summary["total_calories"],
            "deficit": summary["calorie_deficit"],
            "status": summary["deficit_status"],
            "notes": summary["_energy_notes"],
        },
        "meal_breakdown": daily.meal_breakdown(foods),
        "macro_split": daily.macro_split(summary),
    }


@router.put("/{day}/checkin")
async def check_in(day: date, body: CheckIn, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    summary = await daily.ensure_summary(db, user, day)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(summary, key, value)
    if body.morning_weight:
        # The profile's current weight always follows the most recent weigh-in.
        user.current_weight = await daily.latest_weight(db, user)
    await db.commit()
    result = await daily.recompute(db, user, day)
    background.add_task(sync_if_enabled)
    return daily.public(result)


@router.post("/{day}/coach")
async def ai_coach(day: date, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    return await advisor.daily_advice(db, user, day)
