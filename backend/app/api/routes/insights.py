"""Machine-learning status and data-driven insights (no LLM involved). See docs/ML.md."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models import MealMemory, PortionCalibration
from app.services.ml import anomalies, energy_model, meal_optimizer, runtime, training_load
from app.services.nutrition.tagging import minutes_of
from app.services.tracker import daily
from app.services.training.autoregulation import readiness_model_for

router = APIRouter(tags=["Machine learning & insights"])

SLOTS = ("now", "dinner", "post_workout", "snack")


# ------------------------------------------------------------------ ML status
@router.get("/ml/status")
async def ml_status(db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    model = await _readiness(db, user)
    text_ready, vision_ready = runtime.is_ready("text"), runtime.is_ready("vision")
    return {
        "enabled": settings.ml_enabled,
        "models": runtime.status(),
        "features": {
            "semantic_search": text_ready,
            "photo_recognition": text_ready and vision_ready,
            "personal_meal_memory": vision_ready,
            "adaptive_tdee": True,
            "readiness_model": model["mode"] == "personal_model",
            "meal_optimizer": True,
        },
        "stats": {
            "saved_meal_embeddings": await db.scalar(select(func.count()).select_from(MealMemory)) or 0,
            "portion_calibrations": await db.scalar(select(func.count()).select_from(PortionCalibration)) or 0,
            "readiness_samples": model["samples"],
        },
    }


@router.post("/ml/models/{key}/load")
async def load_model(key: str, db: AsyncSession = Depends(get_db)):
    if key not in runtime.SLOTS:
        raise HTTPException(404, f"Unknown model '{key}'. Use one of: {', '.join(runtime.SLOTS)}")
    if not settings.ml_enabled:
        raise HTTPException(400, "Machine learning is disabled (ML_ENABLED=false in backend/.env).")
    runtime.start_background_load(key)
    return await ml_status(db)


# ------------------------------------------------------------------ helpers
async def _history(db: AsyncSession, user, days: int) -> list[dict]:
    end = daily.today_for(user)
    return await daily.compute_range(db, user, max(user.start_date, end - timedelta(days=days - 1)), end, adaptive=False)


def _filter(history: list[dict], user) -> list[energy_model.DayEstimate]:
    if not history:
        return []
    return energy_model.run_filter(daily.adaptive_inputs(history), daily.adaptive_prior(history, user), history[0]["weight_used_kg"])


async def _readiness(db: AsyncSession, user) -> dict:
    return await readiness_model_for(db, user)


# ------------------------------------------------------------------ insights
@router.get("/insights/weight")
async def weight_insight(days: int = Query(90, ge=7, le=365), db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    history = await _history(db, user, days)
    estimates = _filter(history, user)
    weigh_ins = [d for d in history if d["morning_weight"]]
    points = [
        {
            "date": d["date"],
            "weight": d["morning_weight"],
            "trend": round(e.trend, 2) if weigh_ins and date.fromisoformat(d["date"]) >= date.fromisoformat(weigh_ins[0]["date"]) else None,
            "lower": round(e.trend - 1.645 * e.trend_sd, 2) if weigh_ins else None,
            "upper": round(e.trend + 1.645 * e.trend_sd, 2) if weigh_ins else None,
            "outlier": e.outlier and d["morning_weight"] is not None,
        }
        for d, e in zip(history, estimates)
    ]
    for p in points:
        if p["trend"] is None:
            p["lower"] = p["upper"] = None
    trend_now = estimates[-1].trend if estimates and weigh_ins else None
    recent = [(date.fromisoformat(p["date"]), p["trend"]) for p in points[-14:] if p["trend"] is not None]
    rate = energy_model.regression_rate(recent) if len(weigh_ins) >= 3 else None
    status = energy_model.rate_status(rate, trend_now or user.starting_weight, len(weigh_ins))
    today = daily.today_for(user)
    fc = energy_model.forecast(trend_now, rate, user.target_weight_kg, today) if trend_now else None

    deficits = [d["calorie_deficit"] for d in history[-14:] if d["calorie_deficit"] is not None]
    plateau = {"detected": False, "since": None, "message": "No plateau detected."}
    if rate is not None and abs(rate) < 0.1 and len(recent) >= 10 and deficits and sum(deficits) / len(deficits) > 300:
        plateau = {"detected": True, "since": recent[0][0],
                   "message": "Weight trend is flat for ~2 weeks despite a logged deficit — logging may be missing food, "
                              "or water retention is masking fat loss. Keep going 1–2 more weeks before changing calories."}
    notes = []
    if len(weigh_ins) < 7:
        notes.append(f"{len(weigh_ins)} weigh-in(s) so far. Weigh every morning (after the toilet, before food) for a reliable trend.")
    if user.target_weight_kg is None:
        notes.append("Set a target weight in Profile to see a goal date.")
    return {
        "points": points,
        "trend_weight": round(trend_now, 2) if trend_now else None,
        "rate_kg_per_week": round(rate, 2) if rate is not None else None,
        "rate_pct_per_week": round(rate / trend_now * 100, 2) if rate is not None and trend_now else None,
        "rate_status": status,
        "target_weight": user.target_weight_kg,
        "forecast": fc,
        "plateau": plateau,
        "notes": notes,
    }


@router.get("/insights/expenditure")
async def expenditure_insight(days: int = Query(90, ge=7, le=365), db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    history = await _history(db, user, days)
    estimates = _filter(history, user)
    last, est = history[-1], estimates[-1]
    conf = round(est.confidence, 2)
    formula = last["_formula_tdee"]
    adaptive = round(est.expenditure) if conf >= 0.3 else None
    if conf >= daily.ADAPTIVE_MIN_CONFIDENCE:
        blended = round(est.expenditure if formula is None else formula * (1 - conf) + est.expenditure * conf)
        source = "adaptive" if formula is None else "blended"
    else:
        blended, source = formula, ("formula" if formula else "pending")
    logged = [d for d in history if d["food_count"] and d["_complete"]]
    first_weigh_in = next((i for i, d in enumerate(history) if d["morning_weight"]), len(history))
    notes = [
        "Adaptive expenditure learns your real burn from logged food and morning weight (Kalman filter, 7,700 kcal per kg).",
    ]
    if conf < daily.ADAPTIVE_MIN_CONFIDENCE:
        notes.append("Needs ~2–3 weeks of complete food logs and regular weigh-ins before it can be trusted.")
    if len(logged) < len(history) * 0.7:
        notes.append("Several days are not fully logged — incomplete days are skipped, so log every meal for accuracy.")
    return {
        "formula_tdee": formula,
        "adaptive_tdee": adaptive,
        "adaptive_low": round(est.expenditure - 1.645 * est.expenditure_sd) if adaptive else None,
        "adaptive_high": round(est.expenditure + 1.645 * est.expenditure_sd) if adaptive else None,
        "confidence": conf,
        "blended_tdee": blended,
        "tdee_source": source,
        "days_used": len(history),
        "weigh_ins_used": sum(1 for d in history if d["morning_weight"]),
        "logged_days": len(logged),
        "points": [
            {
                "date": d["date"],
                "intake": d["total_calories"] if d["food_count"] else None,
                "expenditure": round(e.expenditure),
                "low": round(e.expenditure - 1.645 * e.expenditure_sd),
                "high": round(e.expenditure + 1.645 * e.expenditure_sd),
                "trend_weight": round(e.trend, 2) if i >= first_weigh_in else None,
            }
            for i, (d, e) in enumerate(zip(history, estimates))
        ],
        "notes": notes,
    }


@router.get("/insights/training-load")
async def training_load_insight(days: int = Query(56, ge=7, le=365), db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    return await training_load.training_load(db, daily.today_for(user), days)


@router.get("/insights/readiness-model")
async def readiness_insight(db: AsyncSession = Depends(get_db)):
    return await _readiness(db, await daily.get_user(db))


@router.get("/insights/meal-suggestions")
async def meal_suggestions(day: date | None = Query(None, alias="date"), slot: str = "now", db: AsyncSession = Depends(get_db)):
    if slot not in SLOTS:
        raise HTTPException(400, f"slot must be one of {SLOTS}")
    user = await daily.get_user(db)
    target_day = day or daily.today_for(user)
    summary, _ = await daily.compute_day(db, user, target_day)
    now = daily.now_for(user)
    now_minutes = now.hour * 60 + now.minute if target_day == now.date() else None
    if slot == "dinner" and minutes_of(user.bedtime):
        now_minutes = None
    return await meal_optimizer.suggest(db, user, summary, slot, now_minutes)


@router.get("/insights/anomalies")
async def anomalies_insight(days: int = Query(30, ge=3, le=365), db: AsyncSession = Depends(get_db)):
    return await anomalies.detect(db, await daily.get_user(db), days)


@router.get("/insights/summary")
async def insights_summary(db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    weight = await weight_insight(90, db)
    expenditure = await expenditure_insight(90, db)
    load = await training_load.training_load(db, daily.today_for(user), 28)
    model = await _readiness(db, user)
    found = await anomalies.detect(db, user, 30)
    return {
        "trend_weight": weight["trend_weight"],
        "rate_kg_per_week": weight["rate_kg_per_week"],
        "rate_status": weight["rate_status"],
        "eta_date": weight["forecast"]["eta_date"] if weight["forecast"] else None,
        "adaptive_tdee": expenditure["adaptive_tdee"],
        "adaptive_confidence": expenditure["confidence"],
        "tdee_source": expenditure["tdee_source"],
        "acwr": load["acwr"],
        "acwr_zone": load["acwr_zone"],
        "readiness_mode": model["mode"],
        "anomalies_count": len([a for a in found if a["severity"] == "warning"]),
    }
