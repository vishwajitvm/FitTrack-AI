from datetime import date, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.serializers import session_out, workout_out
from app.db.session import get_db
from app.models import WorkoutLog, WorkoutSession
from app.schemas.tracking import WorkoutLogCreate, WorkoutLogUpdate, WorkoutSessionCreate, WorkoutSessionUpdate
from app.services.data.exporter import sync_if_enabled
from app.services.science.energy import MET_REFERENCE
from app.services.tracker import daily
from app.services.training.autoregulation import EXERCISE_LIBRARY, recommend

router = APIRouter(prefix="/workouts", tags=["Workouts"])


@router.get("")
async def workouts_for_day(day: date | None = Query(None, alias="date"), db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    day = day or daily.today_for(user)
    sessions = (await db.scalars(select(WorkoutSession).where(WorkoutSession.date == day).order_by(WorkoutSession.id))).all()
    logs = (await db.scalars(select(WorkoutLog).where(WorkoutLog.date == day).order_by(WorkoutLog.id))).all()
    total = sum(s.estimated_calories for s in sessions) + sum(w.estimated_calories for w in logs)
    return {"sessions": [session_out(s) for s in sessions], "logs": [workout_out(w) for w in logs], "total_calories": round(total, 1)}


@router.get("/history")
async def history(days: int = 30, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    end = daily.today_for(user)
    start = end - timedelta(days=min(days, 365) - 1)
    sessions = (await db.scalars(select(WorkoutSession).where(WorkoutSession.date.between(start, end)))).all()
    logs = (await db.scalars(select(WorkoutLog).where(WorkoutLog.date.between(start, end)))).all()
    by_day: dict[date, dict] = {}
    for s in sessions:
        entry = by_day.setdefault(s.date, {"date": s.date, "split": s.split, "total_calories": 0.0, "cardio_min": 0.0, "lifting_min": 0.0, "exercises": 0})
        entry["split"] = s.split
        entry["total_calories"] += s.estimated_calories
        entry["lifting_min"] += s.lifting_duration_min or 0
    for w in logs:
        entry = by_day.setdefault(w.date, {"date": w.date, "split": "cardio", "total_calories": 0.0, "cardio_min": 0.0, "lifting_min": 0.0, "exercises": 0})
        entry["total_calories"] += w.estimated_calories
        entry["cardio_min"] += w.cardio_duration_min or 0
        entry["exercises"] += 1 if w.workout_type == "strength" else 0
    return [dict(v, total_calories=round(v["total_calories"], 1)) for _, v in sorted(by_day.items(), reverse=True)]


@router.post("/sessions")
async def create_session(body: WorkoutSessionCreate, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    summary = await daily.ensure_summary(db, user, body.date)
    row = WorkoutSession(**body.model_dump(), daily_summary_id=summary.id)
    db.add(row)
    await db.commit()
    await daily.recompute(db, user, body.date)
    background.add_task(sync_if_enabled)
    await db.refresh(row)
    return session_out(row)


@router.put("/sessions/{session_id}")
async def update_session(session_id: int, body: WorkoutSessionUpdate, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    row = await db.get(WorkoutSession, session_id)
    if row is None:
        raise HTTPException(404, "Session not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    await db.commit()
    await daily.recompute(db, user, row.date)
    background.add_task(sync_if_enabled)
    await db.refresh(row)
    return session_out(row)


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    row = await db.get(WorkoutSession, session_id)
    if row is None:
        raise HTTPException(404, "Session not found")
    d = row.date
    await db.delete(row)
    await db.commit()
    await daily.recompute(db, user, d)
    background.add_task(sync_if_enabled)
    return {"ok": True}


@router.post("/logs")
async def create_log(body: WorkoutLogCreate, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    summary = await daily.ensure_summary(db, user, body.date)
    data = body.model_dump()
    if body.workout_type == "strength":
        data["cardio_duration_min"] = None  # strength work is covered by its session's lifting block
    elif not data.get("met_value"):
        data["met_value"] = 4.5
    row = WorkoutLog(**data, daily_summary_id=summary.id)
    db.add(row)
    await db.commit()
    await daily.recompute(db, user, body.date)
    background.add_task(sync_if_enabled)
    await db.refresh(row)
    return workout_out(row)


@router.put("/logs/{log_id}")
async def update_log(log_id: int, body: WorkoutLogUpdate, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    row = await db.get(WorkoutLog, log_id)
    if row is None:
        raise HTTPException(404, "Workout entry not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    await db.commit()
    await daily.recompute(db, user, row.date)
    background.add_task(sync_if_enabled)
    await db.refresh(row)
    return workout_out(row)


@router.delete("/logs/{log_id}")
async def delete_log(log_id: int, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    row = await db.get(WorkoutLog, log_id)
    if row is None:
        raise HTTPException(404, "Workout entry not found")
    d = row.date
    await db.delete(row)
    await db.commit()
    await daily.recompute(db, user, d)
    background.add_task(sync_if_enabled)
    return {"ok": True}


@router.get("/recommendation")
async def recommendation(day: date | None = Query(None, alias="date"), db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    return await recommend(db, user, day or daily.today_for(user))


@router.get("/exercises")
async def exercises():
    return EXERCISE_LIBRARY


@router.get("/met-reference")
async def met_reference():
    return MET_REFERENCE
