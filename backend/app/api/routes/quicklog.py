"""Fast daily logging: presets (routines & meals), repeat, copy, undo, quick picks and the Today plan."""
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import Preset
from app.schemas.quicklog import DayCopy, EntriesDelete, PresetApply, PresetCreate, PresetFromDay, PresetUpdate
from app.services.data.exporter import sync_if_enabled
from app.services.quicklog import presets as service
from app.services.quicklog import today as today_service
from app.services.tracker import daily

router = APIRouter(tags=["Quick logging"])


async def _preset_or_404(db: AsyncSession, preset_id: int) -> Preset:
    preset = await db.get(Preset, preset_id)
    if preset is None:
        raise HTTPException(404, "Preset not found")
    return preset


@router.get("/presets")
async def list_presets(kind: str | None = Query(None, pattern="^(workout|meal)$"), db: AsyncSession = Depends(get_db)):
    return [service.serialize(p) for p in await service.list_presets(db, kind)]


@router.post("/presets")
async def create_preset(body: PresetCreate, db: AsyncSession = Depends(get_db)):
    preset = Preset(**body.model_dump(), use_count=0)
    db.add(preset)
    await db.commit()
    await db.refresh(preset)
    return service.serialize(preset)


@router.put("/presets/{preset_id}")
async def update_preset(preset_id: int, body: PresetUpdate, db: AsyncSession = Depends(get_db)):
    preset = await _preset_or_404(db, preset_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(preset, key, value)
    await db.commit()
    await db.refresh(preset)
    return service.serialize(preset)


@router.delete("/presets/{preset_id}")
async def delete_preset(preset_id: int, db: AsyncSession = Depends(get_db)):
    await db.delete(await _preset_or_404(db, preset_id))
    await db.commit()
    return {"ok": True}


@router.get("/presets/{preset_id}/prefill")
async def prefill_preset(preset_id: int, day: date | None = Query(None, alias="date"), db: AsyncSession = Depends(get_db)):
    """Preset payload ready to edit, with exercises updated to your last real performance."""
    preset = await _preset_or_404(db, preset_id)
    user = await daily.get_user(db)
    return {"preset": service.serialize(preset), "payload": await service.prefill(db, preset, day or daily.today_for(user))}


@router.post("/presets/{preset_id}/apply")
async def apply_preset(preset_id: int, body: PresetApply, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    preset = await _preset_or_404(db, preset_id)
    result = await service.apply_preset(db, await daily.get_user(db), preset, body.date, body.time, body.payload, body.scale)
    background.add_task(sync_if_enabled)
    return result


@router.post("/presets/from-day")
async def preset_from_day(body: PresetFromDay, db: AsyncSession = Depends(get_db)):
    if body.kind == "meal":
        if not body.meal_type:
            raise HTTPException(400, "meal_type is required for a meal preset")
        payload = await service.day_meal_payload(db, body.date, body.meal_type)
        if not payload["items"]:
            raise HTTPException(400, f"Nothing logged for {body.meal_type.replace('_', ' ')} on {body.date}")
        split = None
    else:
        payload = await service.day_workout_payload(db, body.date)
        if not (payload["session"] or payload["cardio"] or payload["exercises"]):
            raise HTTPException(400, f"No workout logged on {body.date}")
        split = (payload["session"] or {}).get("split") or "cardio"
    preset = Preset(kind=body.kind, name=body.name, icon=body.icon, split=split, meal_type=body.meal_type,
                    payload=payload, use_count=0)
    db.add(preset)
    await db.commit()
    await db.refresh(preset)
    return service.serialize(preset)


@router.post("/days/copy")
async def copy_day(body: DayCopy, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    if body.from_date == body.to_date:
        raise HTTPException(400, "Pick a different day to copy from")
    result = await service.copy_day(db, await daily.get_user(db), body.from_date, body.to_date, body.include, body.meal_types)
    background.add_task(sync_if_enabled)
    return result


@router.post("/entries/delete")
async def delete_entries(body: EntriesDelete, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Bulk delete used by Undo after one-tap actions."""
    deleted = await service.delete_entries(db, await daily.get_user(db), body.food_ids, body.workout_log_ids, body.session_ids)
    background.add_task(sync_if_enabled)
    return {"ok": True, "deleted": deleted}


@router.get("/quick-picks")
async def quick_picks(meal_type: str | None = None, limit: int = Query(12, ge=1, le=40), db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    if meal_type is None:
        now = daily.now_for(user)
        meal_type = today_service.slot_for_time(now.hour * 60 + now.minute)
    return await today_service.quick_picks(db, user, meal_type, limit)


@router.get("/workouts/last-performance")
async def last_performance(exercise: str, db: AsyncSession = Depends(get_db)):
    return await service.last_performance(db, exercise)


@router.get("/today")
async def today(db: AsyncSession = Depends(get_db)):
    return await today_service.today_plan(db, await daily.get_user(db))
