"""AI coach: turns a day's numbers (or gut-health correlations) into concise advice.

Always falls back to the deterministic rule-based text if no AI provider is available.
"""
import json
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.services.coach import rules
from app.services.llm import router
from app.services.llm.client import ChatMessage
from app.services.tracker import daily

# Generous: "thinking" models (e.g. Gemini) spend part of the limit on hidden reasoning, and 900 cut answers off mid-sentence.
MAX_TOKENS = 4096

COACH_SYSTEM = """You are an elite sports nutritionist and strength coach. Be direct, specific and practical.
The athlete's goal is aggressive but sustainable fat loss while preserving muscle and strength.
Rules: protein 1.6-2.0 g/kg; deficit = TDEE − intake (never intake − exercise); Sunday is rest;
the athlete returns from the gym ~20 min before bed, so the main meal must come BEFORE training and post-gym food must be light.
Only suggest foods that fit the athlete's diet_type and intolerances (vegetarian: no meat, fish or eggs; eggetarian: eggs but
no meat or fish; vegan: no animal products).
Write 4-7 short bullet points (start each with "• "), using the actual numbers. No preamble."""


def _profile(user: User) -> dict:
    return {
        "age": user.age, "sex": user.sex, "height_cm": user.height_cm,
        "weight_kg": user.current_weight or user.starting_weight, "goal": user.goal,
        "diet_type": user.diet_type, "intolerances": user.intolerances, "gym_return_time": user.gym_return_time,
        "bedtime": user.bedtime, "rest_day": user.rest_day,
    }


async def daily_advice(db: AsyncSession, user: User, d: date) -> dict:
    day, data = await daily.compute_day(db, user, d)
    foods = [
        {"time": f.time, "meal": f.meal_type, "food": f.food_name, "kcal": f.calories, "protein": f.protein, "tags": f.tags}
        for f in data["foods"].get(d, [])
    ]
    workouts = [
        {"split": s.split, "minutes": s.lifting_duration_min} for s in data["sessions"].get(d, [])
    ] + [
        {"type": lg.workout_type, "exercise": lg.exercise_name, "minutes": lg.cardio_duration_min, "sets": lg.sets, "reps": lg.reps}
        for lg in data["logs"].get(d, [])
    ]
    payload = {
        "profile": _profile(user),
        "day": daily.public(day) | {"alerts": [a["title"] for a in day["alerts"]]},
        "foods": foods,
        "workouts": workouts,
    }
    messages = [ChatMessage("system", COACH_SYSTEM), ChatMessage("user", "Day data:\n" + json.dumps(payload, default=str))]
    try:
        result = await router.complete(db, "reasoning", messages, max_tokens=MAX_TOKENS)
        advice, source, provider, model = result.text, f"{result.provider}/{result.model}", result.provider, result.model
    except router.AllProvidersFailed:
        advice, source, provider, model = rules.summary_text(day["alerts"]), "rules", None, None

    summary = await daily.ensure_summary(db, user, d)
    summary.coach_advice = advice
    summary.coach_advice_source = source
    await db.commit()
    return {"coach_advice": advice, "provider": provider, "model": model}


async def gut_insights(db: AsyncSession, correlations: dict) -> dict:
    user = await daily.get_user(db)
    prompt = (
        "Interpret these symptom/meal correlations for the athlete. Explain likely triggers, how confident we can be given "
        "the sample size, and a concrete 7-day elimination or adjustment plan (e.g. swap whey concentrate for isolate, "
        "move dinner before the gym, reduce refined flour). Bullet points starting with '• '.\n\n"
        + json.dumps({k: correlations[k] for k in ("sample_days", "findings", "notes")} | {"athlete": _profile(user)}, default=str)
    )
    messages = [ChatMessage("system", COACH_SYSTEM), ChatMessage("user", prompt)]
    try:
        result = await router.complete(db, "reasoning", messages, max_tokens=MAX_TOKENS)
        return {"text": result.text, "provider": result.provider, "model": result.model}
    except router.AllProvidersFailed:
        lines = [f"• {f['explanation']} ({f['strength'].replace('_', ' ')})" for f in correlations["findings"][:6]]
        lines += [f"• {n}" for n in correlations["notes"]]
        return {"text": "\n".join(lines) or "• Not enough data yet.", "provider": None, "model": None}
