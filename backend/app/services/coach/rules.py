"""Deterministic coaching rules → colour-coded alerts.

critical (soft red)  : crash deficits, dangerous patterns
warning  (soft amber): inadequate protein / fibre, late heavy meals, poor sleep, bloating
ok       (soft mint) : targets met
info                 : neutral context (rest day, day in progress, missing data)
"""
from dataclasses import dataclass

from app.services.nutrition.tagging import minutes_of

CRASH_INTAKE_KCAL = 1000
FIBRE_TARGET_G = 25
LATE_MEAL_KCAL = 400


@dataclass
class DayFacts:
    weight_kg: float
    intake: float
    protein: float
    carbs: float
    fat: float
    fibre: float
    bmr: float | None
    tdee: float | None
    deficit: float | None
    protein_g_per_kg_target: float
    foods: list  # FoodLog rows
    has_training: bool
    missing_workout_duration: bool
    is_rest_day: bool
    day_complete: bool
    sleep_hours: float | None
    sleep_target: float | None
    bloating_status: str | None
    energy_level: int | None
    bedtime: str | None
    gym_return_time: str | None


def _alert(level: str, code: str, title: str, message: str) -> dict:
    return {"level": level, "code": code, "title": title, "message": message}


def evaluate(f: DayFacts) -> list[dict]:
    alerts: list[dict] = []
    protein_per_kg = f.protein / f.weight_kg if f.weight_kg else 0
    protein_min = 1.6 * f.weight_kg

    if f.is_rest_day:
        alerts.append(_alert("info", "rest_day", "Rest & gut-recovery day",
                             "Sunday is your mandatory rest day: no gym. Keep protein high, eat fibre-rich whole foods and sleep early."))

    if not f.foods:
        alerts.append(_alert("info", "no_food", "No meals logged", "Log meals or snap a photo to see your nutrition analysis."))
        return alerts

    if not f.day_complete:
        alerts.append(_alert("info", "in_progress", "Day in progress",
                             f"{f.intake:.0f} kcal and {f.protein:.0f} g protein logged so far. Final verdict after your last meal."))
    else:
        if f.intake < CRASH_INTAKE_KCAL:
            alerts.append(_alert("critical", "crash_deficit", "CRITICAL: Crash deficit (<1,000 kcal)",
                                 f"Only {f.intake:.0f} kcal eaten. High risk of gym weakness, muscle catabolism and metabolic slowdown. "
                                 "Add a proper protein-rich meal before training."))
        else:
            aggressive_floor = max(1200.0, 0.75 * f.bmr) if f.bmr else 1500.0
            if f.intake < aggressive_floor:
                alerts.append(_alert("warning", "aggressive_deficit", "Warning: Aggressive deficit",
                                     f"{f.intake:.0f} kcal is below a sustainable floor (~{aggressive_floor:.0f} kcal) for your size. "
                                     "Expect poorer recovery and strength."))
        if f.deficit is not None and f.deficit > 1000:
            alerts.append(_alert("warning", "large_deficit", "Deficit above 1,000 kcal",
                                 f"Estimated deficit {f.deficit:.0f} kcal. Aim for 500–750 kcal to keep muscle and strength."))

        if f.protein < protein_min:
            alerts.append(_alert("warning", "low_protein", "Protein inadequate",
                                 f"{f.protein:.0f} g ({protein_per_kg:.1f} g/kg) vs target {protein_min:.0f}–{2.0 * f.weight_kg:.0f} g "
                                 "(1.6–2.0 g/kg). Add eggs/egg whites, paneer, chicken, dal + curd, or an extra whey scoop."))
        else:
            alerts.append(_alert("ok", "protein_ok", "Protein on target", f"{f.protein:.0f} g ({protein_per_kg:.1f} g/kg)."))

        if f.fibre < FIBRE_TARGET_G:
            alerts.append(_alert("warning", "low_fibre", "Low fibre",
                                 f"{f.fibre:.0f} g vs ≥{FIBRE_TARGET_G} g. Add vegetables, fruit, dal or sprouts for gut health."))

        meal_types = {food.meal_type for food in f.foods}
        solid_after_17 = [
            food for food in f.foods
            if (minutes_of(food.time) or 0) >= 17 * 60 and "whey" not in food.food_name.lower()
        ]
        if "dinner" not in meal_types and not solid_after_17:
            alerts.append(_alert("warning", "skipped_dinner", "Dinner skipped",
                                 "No solid evening meal: the body goes without amino acids overnight. Eat a balanced dinner "
                                 "60–90 min BEFORE the gym, then only a light protein after."))

    # Late heavy meals vs the gym-return → bedtime window.
    bed = minutes_of(f.bedtime)
    if bed is not None:
        for food in f.foods:
            t = minutes_of(food.time)
            if t is not None and t >= bed - 60 and (food.calories > LATE_MEAL_KCAL or food.fat > 15):
                alerts.append(_alert("warning", "late_heavy_meal", "Heavy meal close to bedtime",
                                     f"{food.food_name} ({food.calories:.0f} kcal) at {food.time}, bedtime {f.bedtime}. "
                                     "Risk of reflux and morning bloating — keep post-gym food light (whey isolate in water, egg whites)."))

    if f.has_training and f.missing_workout_duration:
        alerts.append(_alert("info", "missing_duration", "Workout duration missing",
                             "A lifting session has no duration, so its calories are not counted in TDEE. Add the duration."))

    if f.sleep_hours is not None and f.sleep_hours < (f.sleep_target or 7):
        alerts.append(_alert("warning", "short_sleep", "Short sleep",
                             f"{f.sleep_hours:g} h sleep. Recovery, hunger hormones and strength suffer below 7 h."))
    if f.bloating_status in ("moderate", "severe"):
        alerts.append(_alert("warning", "bloating", f"Bloating: {f.bloating_status}",
                             "Check the Gut Health page for suspected triggers (lactose, refined flour, late meals)."))
    if f.energy_level is not None and f.energy_level <= 4:
        alerts.append(_alert("warning", "low_energy", "Low energy",
                             "Low energy reported — consider reducing training volume today (see workout recommendation)."))

    if f.bmr is None:
        alerts.append(_alert("info", "pending_biometrics", "Pending Biometric Confirmation",
                             "Add your age and biological sex in Profile to unlock BMR, TDEE and true deficit."))

    if f.day_complete and not any(a["level"] in ("critical", "warning") for a in alerts):
        alerts.append(_alert("ok", "on_target", "On target", "Calories, protein and fibre are within healthy ranges."))
    return alerts


def summary_text(alerts: list[dict]) -> str:
    """Plain-language rule-based advice when no AI advice has been generated."""
    important = [a for a in alerts if a["level"] in ("critical", "warning")]
    if not important:
        ok = [a for a in alerts if a["level"] == "ok"]
        return " ".join(a["message"] for a in ok) or "Keep logging meals, workouts and check-ins."
    return " ".join(f"{a['title']}: {a['message']}" for a in important[:4])
