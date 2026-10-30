"""Presets & repetition: log a whole routine or meal in one call, repeat last performance, copy days.

Every function that writes returns `AppliedEntries`-style ids so the UI can offer Undo.
"""
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FoodLog, Preset, User, WorkoutLog, WorkoutSession
from app.services.nutrition.tagging import add_time_tags, infer_tags
from app.services.tracker import daily
from app.services.ml.training_load import parse_rpe

FOOD_FIELDS = ("food_name", "quantity", "portion_unit", "weight_grams", "calories", "protein", "carbs", "fat", "fibre")
EXERCISE_FIELDS = ("exercise_name", "target_muscle", "sets", "reps", "weight_kg", "rpe", "sets_json")
CARDIO_FIELDS = ("exercise_name", "cardio_duration_min", "met_value", "rpe")
WEIGHT_STEP_KG = 2.5


# ------------------------------------------------------------------ serialization
def summary(preset: Preset) -> dict:
    payload = preset.payload or {}
    if preset.kind == "meal":
        items = payload.get("items", [])
        return {
            "calories": round(sum(float(i.get("calories") or 0) for i in items)),
            "protein": round(sum(float(i.get("protein") or 0) for i in items), 1),
            "items": len(items),
        }
    session = payload.get("session") or {}
    return {
        "exercises": len(payload.get("exercises", [])),
        "cardio_min": round(sum(float(c.get("cardio_duration_min") or 0) for c in payload.get("cardio", []))),
        "lifting_min": session.get("lifting_duration_min"),
    }


def serialize(preset: Preset) -> dict:
    return {
        "id": preset.id,
        "kind": preset.kind,
        "name": preset.name,
        "icon": preset.icon,
        "color": preset.color,
        "split": preset.split,
        "meal_type": preset.meal_type,
        "payload": preset.payload or {},
        "use_count": preset.use_count,
        "last_used_at": preset.last_used_at,
        "created_at": preset.created_at,
        "summary": summary(preset),
    }


async def list_presets(db: AsyncSession, kind: str | None = None) -> list[Preset]:
    query = select(Preset).order_by(Preset.use_count.desc(), Preset.last_used_at.desc().nulls_last(), Preset.id)
    if kind:
        query = query.where(Preset.kind == kind)
    return list((await db.scalars(query)).all())


# ------------------------------------------------------------------ last performance
async def last_performance(db: AsyncSession, exercise_name: str, before: date | None = None) -> dict | None:
    query = select(WorkoutLog).where(
        WorkoutLog.workout_type == "strength", func.lower(WorkoutLog.exercise_name) == exercise_name.strip().lower()
    )
    if before:
        query = query.where(WorkoutLog.date <= before)
    row = await db.scalar(query.order_by(WorkoutLog.date.desc(), WorkoutLog.id.desc()).limit(1))
    if row is None:
        return None
    return {
        "exercise_name": row.exercise_name,
        "date": row.date,
        "sets": row.sets,
        "reps": row.reps,
        "weight_kg": row.weight_kg,
        "rpe": row.rpe,
        "sets_json": row.sets_json or [],
        "suggestion": progression(row.weight_kg, row.reps, row.rpe),
    }


def progression(weight_kg: float | None, reps: str | None, rpe: str | None) -> dict:
    """Simple double-progression rule: felt easy (RPE ≤ 8) → add a little; otherwise repeat."""
    effort = parse_rpe(rpe)
    if effort is not None and effort > 8:
        return {"weight_kg": weight_kg, "reps": reps, "message": "Last time was hard — repeat the same and own it."}
    if weight_kg:
        return {"weight_kg": weight_kg + WEIGHT_STEP_KG, "reps": reps,
                "message": f"Felt manageable last time — try +{WEIGHT_STEP_KG:g} kg."}
    if reps and reps.split("-")[-1].strip().isdigit():
        top = int(reps.split("-")[-1]) + 1
        return {"weight_kg": None, "reps": str(top), "message": "Bodyweight — try one more rep per set."}
    return {"weight_kg": weight_kg, "reps": reps, "message": "Repeat last time's numbers."}


async def prefill(db: AsyncSession, preset: Preset, day: date) -> dict:
    """Preset payload with each exercise updated to the most recent real performance."""
    payload = {**(preset.payload or {})}
    if preset.kind != "workout":
        return payload
    exercises = []
    for ex in payload.get("exercises", []):
        last = await last_performance(db, ex.get("exercise_name", ""), before=day)
        merged = dict(ex)
        if last:
            for key in ("sets", "reps", "weight_kg", "rpe", "sets_json"):
                if last.get(key) not in (None, "", []):
                    merged[key] = last[key]
            merged["last"] = {"date": last["date"], "suggestion": last["suggestion"]}
        exercises.append(merged)
    payload["exercises"] = exercises
    return payload


# ------------------------------------------------------------------ apply
async def _add_food(db: AsyncSession, user: User, summary_id: int, day: date, meal_type: str, time: str | None,
                    item: dict, scale: float, source: str) -> FoodLog:
    values = {k: item.get(k) for k in FOOD_FIELDS}
    for key in ("quantity", "weight_grams", "calories", "protein", "carbs", "fat", "fibre"):
        if values.get(key) is not None:
            values[key] = round(float(values[key]) * scale, 1)
    for key in ("calories", "protein", "carbs", "fat", "fibre"):
        values[key] = values.get(key) or 0
    ingredients = item.get("ingredients") or []
    row = FoodLog(daily_summary_id=summary_id, date=day, meal_type=item.get("meal_type") or meal_type, time=time,
                  ingredients_json=ingredients, research_source=source, confidence_score=item.get("confidence_score") or 0.9,
                  **values)
    row.tags = add_time_tags(infer_tags(row.food_name, ingredients, item.get("tags")), time, user.bedtime)
    db.add(row)
    return row


async def apply_payload(db: AsyncSession, user: User, kind: str, payload: dict, day: date, time: str | None,
                        scale: float = 1.0, source: str = "Preset") -> dict:
    summary_row = await daily.ensure_summary(db, user, day)
    created = {"food_ids": [], "workout_log_ids": [], "session_ids": []}
    rows: list = []
    if kind == "meal":
        meal_type = payload.get("meal_type") or "other"
        for item in payload.get("items", []):
            rows.append(("food", await _add_food(db, user, summary_row.id, day, meal_type, time, item, scale, source)))
        label = f"{len(rows)} food item(s)"
    else:
        session = None
        if payload.get("session"):
            s = payload["session"]
            session = WorkoutSession(daily_summary_id=summary_row.id, date=day, split=s.get("split") or "other",
                                     lifting_duration_min=s.get("lifting_duration_min"), lifting_met=s.get("lifting_met") or 4.0,
                                     session_rpe=s.get("session_rpe"), started_at=time, notes=s.get("notes"))
            db.add(session)
            await db.flush()
            rows.append(("session", session))
        for c in payload.get("cardio", []):
            if c.get("skip") or not c.get("cardio_duration_min"):
                continue
            rows.append(("log", WorkoutLog(daily_summary_id=summary_row.id, date=day, workout_type="cardio",
                                           target_muscle="Cardio", met_value=c.get("met_value") or 4.5,
                                           **{k: c.get(k) for k in ("exercise_name", "cardio_duration_min", "rpe")})))
        for ex in payload.get("exercises", []):
            if ex.get("skip"):
                continue
            values = {k: ex.get(k) for k in EXERCISE_FIELDS}
            values["sets_json"] = values.get("sets_json") or []
            if values.get("reps") is not None:
                values["reps"] = str(values["reps"])
            if values.get("rpe") is not None:
                values["rpe"] = str(values["rpe"])
            rows.append(("log", WorkoutLog(daily_summary_id=summary_row.id, date=day, workout_type="strength",
                                           session_id=session.id if session else None, **values)))
        for kind_, row in rows:
            if kind_ == "log":
                db.add(row)
        label = f"{sum(1 for k, _ in rows if k == 'log')} workout entr(ies)"
    await db.flush()
    for kind_, row in rows:
        key = {"food": "food_ids", "log": "workout_log_ids", "session": "session_ids"}[kind_]
        created[key].append(row.id)
    await db.commit()
    await daily.recompute(db, user, day)
    created["summary"] = f"Logged {label} for {day.isoformat()}."
    return created


async def apply_preset(db: AsyncSession, user: User, preset: Preset, day: date, time: str | None,
                       payload: dict | None, scale: float) -> dict:
    result = await apply_payload(db, user, preset.kind, payload or preset.payload or {}, day, time, scale,
                                 source=f"Preset: {preset.name}")
    preset.use_count += 1
    preset.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    result["summary"] = f"{preset.name}: {result['summary']}"
    return result


# ------------------------------------------------------------------ snapshots & copies
def food_item(f: FoodLog) -> dict:
    return {**{k: getattr(f, k) for k in FOOD_FIELDS}, "ingredients": f.ingredients_json or [], "tags": f.tags or [],
            "meal_type": f.meal_type}


async def day_workout_payload(db: AsyncSession, day: date) -> dict:
    sessions = (await db.scalars(select(WorkoutSession).where(WorkoutSession.date == day).order_by(WorkoutSession.id))).all()
    logs = (await db.scalars(select(WorkoutLog).where(WorkoutLog.date == day).order_by(WorkoutLog.id))).all()
    s = sessions[0] if sessions else None
    return {
        "session": {"split": s.split, "lifting_duration_min": s.lifting_duration_min, "lifting_met": s.lifting_met,
                    "session_rpe": s.session_rpe} if s else None,
        "cardio": [{k: getattr(lg, k) for k in CARDIO_FIELDS} for lg in logs if lg.workout_type == "cardio"],
        "exercises": [{k: getattr(lg, k) for k in EXERCISE_FIELDS}
                      for lg in logs if lg.workout_type == "strength"],
    }


async def day_meal_payload(db: AsyncSession, day: date, meal_type: str) -> dict:
    foods = (await db.scalars(select(FoodLog).where(FoodLog.date == day, FoodLog.meal_type == meal_type).order_by(FoodLog.id))).all()
    return {"meal_type": meal_type, "items": [food_item(f) for f in foods]}


async def copy_day(db: AsyncSession, user: User, src: date, dst: date, include: list[str], meal_types: list[str] | None) -> dict:
    created = {"food_ids": [], "workout_log_ids": [], "session_ids": []}
    parts = []
    if "food" in include:
        query = select(FoodLog).where(FoodLog.date == src)
        if meal_types:
            query = query.where(FoodLog.meal_type.in_(meal_types))
        foods = (await db.scalars(query.order_by(FoodLog.time, FoodLog.id))).all()
        by_meal: dict[str, list[FoodLog]] = {}
        for f in foods:
            by_meal.setdefault(f.meal_type, []).append(f)
        for meal_type, items in by_meal.items():
            res = await apply_payload(db, user, "meal", {"meal_type": meal_type, "items": [food_item(f) for f in items]},
                                      dst, items[0].time, source=f"Copied from {src.isoformat()}")
            created["food_ids"] += res["food_ids"]
        parts.append(f"{len(created['food_ids'])} food item(s)")
    if "workouts" in include:
        payload = await day_workout_payload(db, src)
        if payload["session"] or payload["cardio"] or payload["exercises"]:
            res = await apply_payload(db, user, "workout", payload, dst, None)
            created["workout_log_ids"] += res["workout_log_ids"]
            created["session_ids"] += res["session_ids"]
        parts.append(f"{len(created['workout_log_ids'])} workout entr(ies)")
    created["summary"] = f"Copied {' and '.join(parts) or 'nothing'} from {src.isoformat()} to {dst.isoformat()}."
    return created


async def delete_entries(db: AsyncSession, user: User, food_ids: list[int], log_ids: list[int], session_ids: list[int]) -> int:
    touched: set[date] = set()
    deleted = 0
    for model, ids in ((FoodLog, food_ids), (WorkoutLog, log_ids), (WorkoutSession, session_ids)):
        for row in (await db.scalars(select(model).where(model.id.in_(ids or [-1])))).all():
            touched.add(row.date)
            await db.delete(row)
            deleted += 1
    await db.commit()
    for d in touched:
        await daily.recompute(db, user, d)
    return deleted
