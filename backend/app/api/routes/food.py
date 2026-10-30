from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.serializers import food_out
from app.core.config import settings
from app.db.session import get_db
from app.models import FoodAnalysis, FoodLog
from app.schemas.tracking import FoodLogCreate, FoodLogUpdate, ParseTextRequest, SaveAnalysis, SaveParsedMeal
from app.services.data.exporter import sync_if_enabled
from app.services.ml import calibration, food_recognition, meal_parser
from app.services.nutrition import analyzer, search
from app.services.nutrition.portions import CONTAINERS
from app.services.nutrition.tagging import add_time_tags, infer_tags
from app.services.tracker import daily

router = APIRouter(tags=["Food & nutrition"])


@router.get("/food")
async def list_food(day: date | None = Query(None, alias="date"), db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    day = day or daily.today_for(user)
    rows = (await db.scalars(select(FoodLog).where(FoodLog.date == day).order_by(FoodLog.time, FoodLog.id))).all()
    return [food_out(f) for f in rows]


@router.post("/food")
async def create_food(body: FoodLogCreate, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    summary = await daily.ensure_summary(db, user, body.date)
    data = body.model_dump(exclude={"ingredients", "tags"})
    row = FoodLog(**data, daily_summary_id=summary.id, ingredients_json=body.ingredients)
    row.tags = add_time_tags(infer_tags(body.food_name, body.ingredients, body.tags), body.time, user.bedtime)
    db.add(row)
    await db.commit()
    await daily.recompute(db, user, body.date)
    background.add_task(sync_if_enabled)
    await db.refresh(row)
    return food_out(row)


@router.put("/food/{food_id}")
async def update_food(food_id: int, body: FoodLogUpdate, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    row = await db.get(FoodLog, food_id)
    if row is None:
        raise HTTPException(404, "Food entry not found")
    old_date = row.date
    changes = body.model_dump(exclude_unset=True)
    if "ingredients" in changes:
        row.ingredients_json = changes.pop("ingredients") or []
    for key, value in changes.items():
        setattr(row, key, value)
    if body.date and body.date != old_date:
        row.daily_summary_id = (await daily.ensure_summary(db, user, body.date)).id
    row.tags = add_time_tags(infer_tags(row.food_name, row.ingredients_json, body.tags or row.tags), row.time, user.bedtime)
    await db.commit()
    for d in {old_date, row.date}:
        await daily.recompute(db, user, d)
    background.add_task(sync_if_enabled)
    await db.refresh(row)
    return food_out(row)


@router.delete("/food/{food_id}")
async def delete_food(food_id: int, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    row = await db.get(FoodLog, food_id)
    if row is None:
        raise HTTPException(404, "Food entry not found")
    d = row.date
    await db.delete(row)
    await db.commit()
    await daily.recompute(db, user, d)
    background.add_task(sync_if_enabled)
    return {"ok": True}


@router.get("/food/containers")
async def containers():
    return CONTAINERS


@router.post("/food/analyze")
async def analyze_food(
    image: UploadFile | None = File(None),
    description: str | None = Form(None),
    ingredients: str | None = Form(None),
    container_id: str | None = Form(None),
    container_size_ml: float | None = Form(None),
    plate_diameter_cm: float | None = Form(None),
    fill_level: str | None = Form(None),
    known_weight_g: float | None = Form(None),
    servings: float | None = Form(1),
    portion_eaten: float | None = Form(1),
    cooking_method: str | None = Form(None),
    oil_used: str | None = Form(None),
    meal_type: str | None = Form(None),
    date: str | None = Form(None),
    time: str | None = Form(None),
    ml_only: bool = Form(False),
    force_ai: bool = Form(False),
    db: AsyncSession = Depends(get_db),
):
    """Analyse a meal photo and/or description. `ml_only` never calls an LLM; `force_ai` skips the
    duplicate-photo and personal-meal shortcuts."""
    image_bytes = await image.read() if image is not None else None
    if image_bytes and len(image_bytes) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"Image larger than {settings.max_upload_mb} MB")
    if not image_bytes and not (description or ingredients):
        raise HTTPException(400, "Upload a photo or describe the meal.")
    inp = {
        "description": description, "ingredients": ingredients, "container_id": container_id,
        "container_size_ml": container_size_ml, "plate_diameter_cm": plate_diameter_cm, "fill_level": fill_level,
        "known_weight_g": known_weight_g, "servings": servings, "portion_eaten": portion_eaten,
        "cooking_method": cooking_method, "oil_used": oil_used, "meal_type": meal_type, "date": date, "time": time,
    }
    try:
        record = await analyzer.analyze(
            db, {k: v for k, v in inp.items() if v not in (None, "")}, image_bytes, ml_only=ml_only, force_ai=force_ai
        )
    except OSError as exc:  # PIL could not read the image
        raise HTTPException(400, f"Could not read image: {exc}") from exc
    return analyzer.serialize(record)


@router.get("/food/analyses")
async def list_analyses(limit: int = 20, db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(FoodAnalysis).order_by(FoodAnalysis.id.desc()).limit(min(limit, 100)))).all()
    return [analyzer.serialize(r) for r in rows]


@router.get("/food/analyses/{analysis_id}")
async def get_analysis(analysis_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(FoodAnalysis, analysis_id)
    if row is None:
        raise HTTPException(404, "Analysis not found")
    return analyzer.serialize(row)


@router.delete("/food/analyses/{analysis_id}")
async def delete_analysis(analysis_id: int, db: AsyncSession = Depends(get_db)):
    """Deletes an analysis and its personal meal memory. Saved food-log entries are kept."""
    row = await db.get(FoodAnalysis, analysis_id)
    if row is None:
        raise HTTPException(404, "Analysis not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


@router.post("/food/analyses/{analysis_id}/save")
async def save_analysis(analysis_id: int, body: SaveAnalysis, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    record = await db.get(FoodAnalysis, analysis_id)
    if record is None:
        raise HTTPException(404, "Analysis not found")
    summary = await daily.ensure_summary(db, user, body.date)
    rows = []
    for item in body.items:
        row = FoodLog(
            daily_summary_id=summary.id,
            date=body.date,
            meal_type=body.meal_type,
            time=body.time,
            food_name=item.name,
            ingredients_json=item.ingredients,
            quantity=1,
            portion_unit="serving",
            weight_grams=item.estimated_weight_g,
            calories=item.calories,
            protein=item.protein,
            carbs=item.carbs,
            fat=item.fat,
            fibre=item.fibre,
            calories_low=item.calories_low,
            calories_high=item.calories_high,
            confidence_score=item.confidence,
            research_source=item.source,
            image_url=record.image_path,
            notes=item.notes,
            analysis_id=record.id,
        )
        row.tags = add_time_tags(infer_tags(item.name, item.ingredients, item.tags), body.time, user.bedtime)
        db.add(row)
        rows.append(row)
    record.saved = True
    await _learn_from_saved_analysis(db, record, body)
    await db.commit()
    await daily.recompute(db, user, body.date)
    background.add_task(sync_if_enabled)
    for r in rows:
        await db.refresh(r)
    return [food_out(r) for r in rows]


async def _learn_from_saved_analysis(db: AsyncSession, record: FoodAnalysis, body: SaveAnalysis) -> None:
    """Personal ML: calibrate portions from your weight corrections and remember this meal's photo."""
    result = record.result_json or {}
    geometry = result.get("geometry") or {}
    estimated = sum(float(i.get("estimated_weight_g") or 0) for i in result.get("items", []))
    corrected = sum(float(i.estimated_weight_g or 0) for i in body.items)
    if result.get("method") in ("ai+ml", "ml_only") and geometry.get("food_category"):
        await calibration.learn(db, (record.input_json or {}).get("container_id"), geometry["food_category"], estimated, corrected)
    saved_items = [i.model_dump() for i in body.items]
    label = ", ".join(i.name for i in body.items)[:200] or "Meal"
    await food_recognition.remember_meal(db, record, saved_items, body.date, label)


@router.post("/food/parse-text")
async def parse_text(body: ParseTextRequest, db: AsyncSession = Depends(get_db)):
    """Typed meal → items with grams and macros, using rules + on-device embeddings (no LLM)."""
    return await meal_parser.parse(db, body.text, await daily.get_user(db))


@router.post("/food/parse-text/save")
async def save_parsed(body: SaveParsedMeal, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    summary = await daily.ensure_summary(db, user, body.date)
    rows = []
    for item in body.items:
        row = FoodLog(
            daily_summary_id=summary.id, date=body.date, meal_type=body.meal_type, time=body.time,
            food_name=item.name, ingredients_json=[item.text] if item.text else [], quantity=item.quantity,
            portion_unit=item.unit, weight_grams=item.grams, calories=item.calories, protein=item.protein,
            carbs=item.carbs, fat=item.fat, fibre=item.fibre, confidence_score=item.confidence,
            research_source=item.source or "Typed entry (on-device parser)",
        )
        row.tags = add_time_tags(infer_tags(item.name, [item.text or ""], item.tags), body.time, user.bedtime)
        db.add(row)
        rows.append(row)
    await db.commit()
    await daily.recompute(db, user, body.date)
    background.add_task(sync_if_enabled)
    for r in rows:
        await db.refresh(r)
    return [food_out(r) for r in rows]


@router.get("/nutrition/search")
async def nutrition_search(q: str, db: AsyncSession = Depends(get_db)):
    return await search.search_all(db, q)
