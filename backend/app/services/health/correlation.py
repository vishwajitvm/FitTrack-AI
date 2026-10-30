"""Gut-health & symptom correlation engine.

For each symptom and candidate trigger it compares how often the symptom occurs on days WITH
the trigger (same day or the previous evening) versus days WITHOUT it, using a Bayesian
beta-binomial N-of-1 analysis (see services/ml/bayes.py) plus Fisher's exact test. With few
days of data, findings are labelled `insufficient_data` instead of guessing.
"""
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.services.ml import bayes
from app.services.nutrition.tagging import is_late, minutes_of
from app.services.tracker import daily

TRIGGERS = {
    "lactose": "Lactose (milk, chai, whey concentrate, paneer)",
    "gluten": "Gluten (bread, pasta, roti, maida)",
    "refined_flour": "Refined flour (maida, white bread, pasta)",
    "late_meal": "Eating close to bedtime",
    "high_fat": "High-fat / oily day (>70 g fat)",
    "fried": "Fried / tadka-heavy food",
    "low_fibre": "Low fibre (<15 g)",
    "legumes": "Legumes (rajma, chole, dal)",
    "crash_intake": "Very low intake (<1,200 kcal)",
    "low_protein": "Low protein (<1.2 g/kg)",
}
SYMPTOM_TRIGGERS = {
    "bloating": ["lactose", "gluten", "refined_flour", "late_meal", "high_fat", "fried", "legumes", "low_fibre"],
    "gas": ["lactose", "legumes", "gluten", "refined_flour", "low_fibre"],
    "acid_reflux": ["late_meal", "high_fat", "fried"],
    "weakness": ["crash_intake", "low_protein"],
    "low_energy": ["crash_intake", "low_protein", "late_meal"],
    "poor_sleep": ["late_meal", "high_fat"],
}
SEVERITY_LABELS = ["none", "mild", "moderate", "severe"]
BLOATING_SCORE = {"none": 0, "mild": 1, "moderate": 2, "severe": 3}


def _day_features(day: dict, foods: list, prev_foods: list, user: User) -> dict:
    tags = set()
    for f in foods:
        tags.update(f.tags or [])
    # Previous-evening foods (after 18:00) can cause next-morning symptoms.
    for f in prev_foods:
        if (minutes_of(f.time) or 0) >= 18 * 60:
            tags.update(t for t in (f.tags or []) if t in ("lactose", "gluten", "refined_flour", "fried", "legumes"))
    late_kcal = sum(f.calories for f in [*foods, *prev_foods] if is_late(f.time, user.bedtime))
    weight = day["weight_used_kg"] or 1
    return {
        "lactose": "lactose" in tags,
        "gluten": "gluten" in tags,
        "refined_flour": "refined_flour" in tags,
        "fried": "fried" in tags,
        "legumes": "legumes" in tags,
        "late_meal": late_kcal >= 150,
        "high_fat": day["total_fat"] > 70,
        "low_fibre": day["food_count"] > 0 and day["total_fibre"] < 15,
        "crash_intake": day["food_count"] > 0 and day["total_calories"] < 1200,
        "low_protein": day["food_count"] > 0 and day["total_protein"] / weight < 1.2,
        "_late_kcal": round(late_kcal),
    }


def _day_symptoms(day: dict, bio: list) -> dict:
    sym = {s: 0 for s in SYMPTOM_TRIGGERS}
    for b in bio:
        if b.symptom_type in sym:
            sym[b.symptom_type] = max(sym[b.symptom_type], b.severity)
    sym["bloating"] = max(sym["bloating"], BLOATING_SCORE.get(day.get("bloating_status") or "none", 0))
    if day.get("energy_level") is not None and day["energy_level"] <= 4:
        sym["low_energy"] = max(sym["low_energy"], 2)
    if day.get("sleep_quality") is not None and day["sleep_quality"] <= 4:
        sym["poor_sleep"] = max(sym["poor_sleep"], 1)
    return sym


async def analyse(db: AsyncSession, user: User, days: int = 30) -> dict:
    end = daily.today_for(user)
    start = max(user.start_date, end - timedelta(days=days - 1))
    summaries = await daily.compute_range(db, user, start - timedelta(days=1), end)
    data = await daily.load_range(db, user, start - timedelta(days=1), end)

    rows = []
    for i in range(1, len(summaries)):
        day = summaries[i]
        d = date.fromisoformat(day["date"])
        prev_d = d - timedelta(days=1)
        has_data = day["food_count"] > 0 or data["bio"].get(d) or day.get("bloating_status") or day.get("energy_level")
        if not has_data:
            continue
        feats = _day_features(day, data["foods"].get(d, []), data["foods"].get(prev_d, []), user)
        syms = _day_symptoms(day, data["bio"].get(d, []))
        rows.append((day, feats, syms))

    findings = []
    symptoms_seen = sorted({s for _, _, syms in rows for s, v in syms.items() if v > 0})
    for symptom in symptoms_seen:
        for trig in SYMPTOM_TRIGGERS[symptom]:
            with_t = [r for r in rows if r[1][trig]]
            without_t = [r for r in rows if not r[1][trig]]
            s_with = sum(1 for r in with_t if r[2][symptom] > 0)
            s_without = sum(1 for r in without_t if r[2][symptom] > 0)
            if not with_t:
                continue
            rate_with = s_with / len(with_t)
            rate_without = s_without / len(without_t) if without_t else 0.0
            if s_with == 0:
                continue
            rr = (s_with + 0.5) / (len(with_t) + 1) / ((s_without + 0.5) / (len(without_t) + 1))
            stats = bayes.compare_rates(s_with, len(with_t), s_without, len(without_t))
            label = bayes.strength(stats["posterior_prob"], rate_with - rate_without, len(with_t), len(without_t))
            if label is None:
                continue
            findings.append(
                {
                    "symptom": symptom,
                    "trigger": trig,
                    "label": TRIGGERS[trig],
                    "days_with_trigger": len(with_t),
                    "symptom_with_trigger": s_with,
                    "days_without_trigger": len(without_t),
                    "symptom_without_trigger": s_without,
                    "rate_with": round(rate_with, 2),
                    "rate_without": round(rate_without, 2),
                    "relative_risk": round(rr, 2),
                    **stats,
                    "strength": label,
                    "explanation": (
                        f"{symptom.replace('_', ' ').title()} on {s_with}/{len(with_t)} days with {TRIGGERS[trig].lower()} "
                        f"vs {s_without}/{len(without_t)} days without — {round(stats['posterior_prob'] * 100)}% likely "
                        "to be a real link given your data."
                    ),
                }
            )
    order = {"strong": 0, "moderate": 1, "weak": 2, "insufficient_data": 3}
    findings.sort(key=lambda f: (order[f["strength"]], -f["posterior_prob"]))

    timeline = [
        {
            "date": day["date"],
            "energy": day.get("energy_level"),
            "bloating_score": syms["bloating"],
            "calories": day["total_calories"],
            "protein": day["total_protein"],
            "late_meal_kcal": feats["_late_kcal"],
            "lactose": feats["lactose"],
            "gluten": feats["gluten"],
            "refined_flour": feats["refined_flour"],
        }
        for day, feats, syms in rows
    ]
    notes = []
    if len(rows) < 7:
        notes.append(f"Only {len(rows)} day(s) of data. Correlations become meaningful after ~2 weeks of daily check-ins.")
    if not symptoms_seen:
        notes.append("No symptoms logged yet. Use the check-in to record bloating, energy and sleep.")
    notes.append("Correlation is not causation — confirm suspected triggers with a 1–2 week elimination test.")
    return {
        "method": "bayesian_beta_binomial",
        "sample_days": len(rows),
        "symptoms_analysed": symptoms_seen,
        "findings": findings,
        "timeline": timeline,
        "notes": notes,
    }
