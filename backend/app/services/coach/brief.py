"""The dashboard's daily brief: a short, human read of the day so far — what's going well, what to watch, what to do next.

It is cached in `daily_briefs` per day together with a fingerprint of everything it was written from (food,
workouts, check-in, symptoms, profile targets). Reloading the page or restarting the app serves the stored text;
only a change to that day's logs (or profile) produces a new fingerprint and a new brief.

Written by the LLM router ("fast" task) from the day's facts; every number it uses must match the facts, otherwise
— or with no AI available — a rule-based brief is written instead, so the card always works.
"""
import asyncio
import hashlib
import json
import logging
import re
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import utcnow
from app.models import DailyBrief, User
from app.services.llm import router
from app.services.llm.client import ChatMessage
from app.services.llm.json_utils import extract_json
from app.services.tracker import daily
from app.services.tracker.metrics import profile_metrics

log = logging.getLogger(__name__)

# Bump when the prompt or rules change, so stored briefs are rewritten once.
BRIEF_VERSION = 4
TASK = "fast"
TIMEOUT_SECONDS = 25
MAX_ITEMS = 3
MAX_ITEM_CHARS = 220
TONES = ("start", "great", "good", "mixed", "off")
MAIN_MEALS = ("breakfast", "lunch", "dinner")
GOAL_DEFICIT_KCAL = 600  # middle of the 500-750 kcal/day fat-loss range
MIN_GOAL_KCAL = 1500

_locks: dict[date, asyncio.Lock] = {}

SYSTEM = """You are the athlete's personal coach and a friend who knows nutrition and training well. You're looking at
their day so far and writing the short note at the top of their dashboard.

Write like a real person talking to them: warm, direct, specific, a bit informal, never robotic or preachy. Use
"you". Point out what they're doing well, what's off and what it could lead to (e.g. low protein → losing muscle and
feeling hungrier; a very low intake → low energy, poor sleep, cravings; late heavy meals → bloating, worse sleep), and
the one or two things that would help most for the rest of today. Make sensible assumptions from the time of day and
what's logged, and say them as guesses (for instance that a main meal seems to be missing from the log, or that
tonight looks like a gym night so the big meal should come first). Put it in your own words every time. If everything
is on track, say so and suggest how to keep it that way. Only suggest foods that fit their diet type and intolerances.

While the day is in progress ("day_in_progress": true) the deficit is only "so far" and will shrink as they eat, so
don't call it too big: talk about what's left to eat today ("intake_goal_today_kcal" and "protein_left_g"). Judge the
full-day deficit only when the day is over. A healthy fat-loss deficit is about 500-750 kcal a day.

Rules: use ONLY numbers that appear in the facts (you may round them); don't invent foods or workouts they didn't
log; deficit means calories burned minus calories eaten; no medical diagnoses; plain punctuation (commas, full
stops, hyphens).

Reply with JSON only:
{"headline": "1-2 sentences, the main thing about today", "good": ["..."], "watch": ["..."], "next": ["..."],
 "tone": "start|great|good|mixed|off"}
Each list has 0-3 short items (one sentence each). "next" has at least one item. tone: start = nothing logged yet,
great/good = on track, mixed = some things off, off = clearly off track."""


def _r(x: float | None, nd: int = 0):
    return None if x is None else (round(x) if nd == 0 else round(x, nd))


async def gather(db: AsyncSession, user: User, d: date) -> tuple[dict, dict, str]:
    """(facts for the writer, numbers for the card, fingerprint of the inputs)."""
    day, data = await daily.compute_day(db, user, d)
    metrics = await profile_metrics(db, user)
    foods = data["foods"].get(d, [])
    sessions = data["sessions"].get(d, [])
    logs = data["logs"].get(d, [])
    bio = data["bio"].get(d, [])
    summary = data["summaries"].get(d)
    now = daily.now_for(user)
    is_today = d == daily.today_for(user)

    protein = metrics.get("protein_target_g") or {}
    eaten, prot = day["total_calories"], day["total_protein"]
    tdee = day.get("adaptive_tdee") if day.get("tdee_source") == "adaptive" else day["estimated_tdee"]
    # today's goal follows today's burn (a rest day burns less than the "typical training day" behind the profile target)
    bmr = day["estimated_bmr"]
    target = round(max(tdee - GOAL_DEFICIT_KCAL, (bmr or 0) * 0.9, MIN_GOAL_KCAL)) if tdee else metrics.get("calorie_target")
    logged_meals = sorted({f.meal_type for f in foods})

    numbers = {
        "eaten_kcal": _r(eaten),
        "goal_kcal": target,
        "kcal_left": _r(target - eaten) if target else None,
        "protein_g": _r(prot),
        "protein_target_g": protein.get("target"),
        "protein_left_g": _r(max(0, protein["target"] - prot)) if protein.get("target") else None,
        "burned_kcal": _r(tdee),
        "exercise_kcal": day["estimated_exercise_calories"],
        "balance_kcal": day["calorie_deficit"],
        "food_count": len(foods),
        "has_workout": day["has_workout"],
    }

    # last 7 days before this one, for "how you're trending"
    week = [x for x in await daily.compute_range(db, user, d - timedelta(days=7), d - timedelta(days=1), adaptive=False) if x["food_count"]]
    trend = None
    if week:
        n = len(week)
        defs = [x["calorie_deficit"] for x in week if x["calorie_deficit"] is not None]
        trend = {
            "days_logged": n,
            "avg_kcal": _r(sum(x["total_calories"] for x in week) / n),
            "avg_protein_g": _r(sum(x["total_protein"] for x in week) / n),
            "avg_deficit_kcal": _r(sum(defs) / len(defs)) if defs else None,
        }

    facts = {
        "now": f"{now:%H:%M} on {now:%A}" if is_today else f"looking back at {d:%A %d %b} (the day is over)",
        "day_in_progress": is_today and not day["_complete"],
        "is_rest_day": day["is_rest_day"],
        "profile": {
            "weight_kg": day["weight_used_kg"], "goal": user.goal, "diet_type": user.diet_type, "intolerances": user.intolerances,
            "gym_return_time": user.gym_return_time, "bedtime": user.bedtime, "rest_day": user.rest_day,
        },
        "targets": {"intake_goal_today_kcal": target, "protein_g": protein or None, "fibre_g": "25-35"},
        "eaten": {"kcal": _r(eaten), "protein_g": _r(prot, 1), "carbs_g": _r(day["total_carbs"]), "fat_g": _r(day["total_fat"]), "fibre_g": _r(day["total_fibre"], 1)},
        "burned_estimate": {
            "total_kcal_for_the_day": _r(tdee), "bmr": day["estimated_bmr"], "daily_movement_neat": day["estimated_neat"],
            "digestion_tef": day["estimated_tef"], "exercise": day["estimated_exercise_calories"], "source": day["tdee_source"],
        },
        # mid-day the "so far" deficit is misleading (dinner isn't eaten yet): give the one they'd end with at today's goal
        **({"deficit_if_goal_is_eaten_kcal": _r(tdee - target) if tdee and target else None} if is_today and not day["_complete"]
           else {"deficit_kcal": day["calorie_deficit"]}),
        "kcal_left_to_goal_today": numbers["kcal_left"],
        "protein_left_g": numbers["protein_left_g"],
        "meals_logged": [{"time": f.time, "meal": f.meal_type, "food": f.food_name, "kcal": _r(f.calories), "protein_g": _r(f.protein, 1)} for f in foods],
        "main_meals_not_logged": [m for m in MAIN_MEALS if m not in logged_meals],
        "training": [{"split": s.split, "minutes": s.lifting_duration_min, "kcal": _r(s.estimated_calories)} for s in sessions]
        + [{"exercise": lg.exercise_name, "type": lg.workout_type, "minutes": lg.cardio_duration_min, "sets": lg.sets, "reps": lg.reps} for lg in logs],
        "checkin": {k: day.get(k) for k in ("morning_weight", "sleep_hours", "sleep_quality", "energy_level", "mood", "stress", "bloating_status", "water_ml", "steps")},
        "symptoms": [{"symptom": b.symptom_type, "severity": b.severity} for b in bio],
        # the alerts' own food tips aren't diet-aware ("Add eggs/… chicken"); the writer picks foods from diet_type instead
        "app_alerts": [{"level": a["level"], "title": a["title"], "detail": re.split(r"\s(?:Add|Try|Have)\s", a["message"])[0]} for a in day["alerts"]],
        "last_7_days": trend,
    }

    fingerprint_src = {
        "v": BRIEF_VERSION,
        "date": d.isoformat(),
        "foods": [(f.id, f.food_name, f.calories, f.protein, f.carbs, f.fat, f.fibre, f.time, f.meal_type, f.quantity) for f in foods],
        "sessions": [(s.id, s.split, s.lifting_duration_min, s.lifting_met, s.session_rpe) for s in sessions],
        "logs": [(lg.id, lg.workout_type, lg.exercise_name, lg.sets, lg.reps, lg.weight_kg, lg.cardio_duration_min, lg.met_value) for lg in logs],
        "checkin": [getattr(summary, k, None) for k in ("morning_weight", *daily.CHECKIN_FIELDS)] if summary else None,
        "bio": [(b.id, b.symptom_type, b.severity) for b in bio],
        "profile": [user.current_weight, user.starting_weight, user.age, user.sex, user.height_cm, user.goal, user.diet_type,
                    user.intolerances, user.protein_target_g_per_kg, user.bedtime, user.gym_return_time, user.activity_level, user.avg_daily_steps],
    }
    fp = hashlib.sha256(json.dumps(fingerprint_src, default=str, sort_keys=True).encode()).hexdigest()
    return facts, numbers, fp


# ---------- rule-based brief (no AI) ----------

def _protein_foods(diet: str | None) -> str:
    if diet == "vegan":
        return "tofu, soya chunks, dal or a vegan protein shake"
    if diet == "vegetarian":
        return "paneer, Greek yoghurt, dal or a whey scoop"
    if diet == "eggetarian":
        return "eggs, paneer, Greek yoghurt or a whey scoop"
    return "chicken, eggs, paneer or a whey scoop"


def rules_brief(facts: dict, numbers: dict) -> dict:
    eaten, target = numbers["eaten_kcal"] or 0, numbers["goal_kcal"]
    prot, ptarget = numbers["protein_g"] or 0, numbers["protein_target_g"]
    in_progress = facts["day_in_progress"]
    diet = facts["profile"]["diet_type"]
    good: list[str] = []
    watch: list[str] = []
    nxt: list[str] = []

    if not numbers["food_count"]:
        headline = "Nothing logged yet today. Start with your first meal — a protein-rich breakfast makes the rest of the day easier."
        if numbers["has_workout"]:
            good.append("You've already got your workout in.")
        nxt.append(f"Log breakfast, and build it around protein ({_protein_foods(diet)}).")
        return {"headline": headline, "good": good, "watch": watch, "next": nxt, "tone": "start"}

    ratio = prot / ptarget if ptarget else None
    if ratio is not None and ratio >= 0.9:
        good.append(f"Protein is on point at {prot} g — that protects your muscle while you're losing fat.")
    if numbers["has_workout"]:
        good.append(f"You trained today ({numbers['exercise_kcal']} kcal from exercise).")
    sleep = facts["checkin"].get("sleep_hours")
    if sleep and sleep >= 7:
        good.append(f"{sleep} h of sleep — that helps recovery and appetite.")

    for a in facts["app_alerts"]:
        if a["level"] in ("critical", "warning") and len(watch) < MAX_ITEMS:
            watch.append(f"{a['title']}: {a['detail']}")
    if ratio is not None and ratio < 0.6 and not in_progress and len(watch) < MAX_ITEMS:
        watch.append(f"Protein ended at {prot} g of {ptarget} g — too little protein means slower recovery and more hunger.")

    left = numbers["protein_left_g"]
    if in_progress and left:
        nxt.append(f"You still need about {left} g of protein — {_protein_foods(diet)} would cover it.")
    if in_progress and facts["main_meals_not_logged"]:
        missing = ", ".join(facts["main_meals_not_logged"])
        nxt.append(f"No {missing} logged yet — if you've eaten, add it so today's numbers are right.")
    if facts["profile"]["gym_return_time"] and in_progress and not numbers["has_workout"] and not facts["is_rest_day"]:
        nxt.append("If you're training tonight, have your main meal before the gym and keep it light afterwards.")
    if not nxt:
        nxt.append("Keep tomorrow looking like today: protein at every meal and your main meal before training.")

    if target:
        if eaten <= target:
            headline = f"You've had {eaten} kcal so far, about {target - eaten} kcal under today's goal of {target} kcal."
        else:
            headline = f"You've had {eaten} kcal — about {eaten - target} kcal over today's goal of {target} kcal."
    else:
        headline = f"You've had {eaten} kcal and {prot} g protein so far today."
    if numbers["burned_kcal"]:
        headline += f" You'll burn roughly {numbers['burned_kcal']} kcal today."

    tone = "off" if any(a["level"] == "critical" for a in facts["app_alerts"]) else "mixed" if watch else "great" if len(good) >= 2 else "good"
    return {"headline": headline, "good": good[:MAX_ITEMS], "watch": watch[:MAX_ITEMS], "next": nxt[:MAX_ITEMS], "tone": tone}


# ---------- AI brief ----------

_NUM_UNIT = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(?:kcal|calories|cal\b|g\b|grams|kg\b|min\b|minutes|ml\b|h\b|hours|%)", re.IGNORECASE)


def _fact_numbers(obj) -> list[float]:
    out: list[float] = []
    if isinstance(obj, bool) or obj is None:
        return out
    if isinstance(obj, (int, float)):
        return [float(obj)]
    if isinstance(obj, str):
        return [float(x.replace(",", "")) for x in re.findall(r"\d[\d,]*(?:\.\d+)?", obj)]
    if isinstance(obj, dict):
        obj = list(obj.values())
    for v in obj:
        out += _fact_numbers(v)
    return out


def check_numbers(text: str, facts: dict, numbers: dict) -> list[str]:
    """Numbers with a unit in `text` that match no number in the facts (±3 % or ±2) nor a sum/difference of two big ones (±1 %)."""
    known = set(_fact_numbers(facts) + _fact_numbers(numbers))
    # "x kcal left" style arithmetic on the big numbers (kcal totals); small ones must match a fact directly
    big = [k for k in known if k >= 100]
    derived = {abs(a - b) for a in big for b in big} | {a + b for a in big for b in big}
    bad = []
    for m in _NUM_UNIT.finditer(text):
        x = float(m.group(1).replace(",", ""))
        if x < 10:
            continue
        if not any(abs(x - k) <= max(2.0, 0.03 * k) for k in known) and not any(abs(x - k) <= max(1.0, 0.01 * k) for k in derived):
            bad.append(m.group(0))
    return bad


def _fix_text(s: str) -> str:
    """Repair UTF-8 read as cp1252 ("â€”" for "—") that some models produce, and normalise dashes."""
    if "â€" in s or "Ã" in s:
        try:
            s = s.encode("cp1252").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            s = s.replace("â€”", "—").replace("â€“", "–").replace("â€™", "'").replace("â€œ", '"').replace("â€", '"')
    return s.strip()


def _clean(raw: dict) -> dict:
    def items(key: str) -> list[str]:
        vals = raw.get(key) or []
        if isinstance(vals, str):
            vals = [vals]
        return [_fix_text(str(v))[:MAX_ITEM_CHARS] for v in vals if str(v).strip()][:MAX_ITEMS]

    headline = _fix_text(str(raw.get("headline") or ""))
    if not headline:
        raise ValueError("no headline")
    tone = str(raw.get("tone") or "good").lower()
    return {"headline": headline[:400], "good": items("good"), "watch": items("watch"), "next": items("next"), "tone": tone if tone in TONES else "good"}


async def write_ai(db: AsyncSession, facts: dict, numbers: dict) -> tuple[dict, str]:
    messages = [ChatMessage("system", SYSTEM), ChatMessage("user", "Facts:\n" + json.dumps(facts, default=str))]
    for attempt in range(2):
        result = await router.complete(db, TASK, messages, json_mode=True, max_tokens=2048, timeout=TIMEOUT_SECONDS)
        brief = _clean(result.data if isinstance(result.data, dict) else extract_json(result.text))
        if not brief["next"]:
            brief["next"] = rules_brief(facts, numbers)["next"][:1]
        text = " ".join([brief["headline"], *brief["good"], *brief["watch"], *brief["next"]])
        bad = check_numbers(text, facts, numbers)
        if not bad:
            return brief, f"{result.provider}/{result.model}"[:120]
        log.info("Daily brief attempt %d used numbers not in the facts: %s", attempt + 1, bad)
        messages += [ChatMessage("assistant", result.text), ChatMessage("user", f"These numbers aren't in the facts: {', '.join(bad)}. Rewrite using only numbers from the facts. JSON only.")]
    raise ValueError("numbers didn't match the facts")


async def get_brief(db: AsyncSession, d: date | None = None, force: bool = False) -> dict:
    user = await daily.get_user(db)
    d = d or daily.today_for(user)
    facts, numbers, fp = await gather(db, user, d)
    row = await db.scalar(select(DailyBrief).where(DailyBrief.date == d))
    if row is not None and row.fingerprint == fp and not force:
        return _serve(row, numbers, cached=True)

    lock = _locks.setdefault(d, asyncio.Lock())
    async with lock:
        row = await db.scalar(select(DailyBrief).where(DailyBrief.date == d))
        if row is not None and row.fingerprint == fp and not force:  # written by a request that held the lock
            return _serve(row, numbers, cached=True)
        try:
            payload, source = await write_ai(db, facts, numbers)
        except (router.AllProvidersFailed, ValueError, TypeError) as exc:
            log.info("Daily brief: using rules (%s)", exc)
            payload, source = rules_brief(facts, numbers), "rules"
        if row is None:
            row = DailyBrief(date=d, fingerprint=fp, payload=payload, source=source)
            db.add(row)
        else:
            row.fingerprint, row.payload, row.source, row.created_at = fp, payload, source, utcnow()
        await db.commit()
        await db.refresh(row)
        return _serve(row, numbers, cached=False)


def _serve(row: DailyBrief, numbers: dict, cached: bool) -> dict:
    return {
        "date": row.date.isoformat(),
        **row.payload,
        "numbers": numbers,
        "source": row.source,
        "generated_at": row.created_at.isoformat(),
        "cached": cached,
    }
