"""Energy-balance formulas: BMR (Mifflin-St Jeor), MET exercise cost, NEAT, TEF, TDEE, deficit.

All functions are pure so they are easy to test and reason about.
"""
import math

# NEAT as a fraction of BMR when step count is unknown (exercise is counted separately,
# so these are deliberately lower than classic "activity multipliers").
NEAT_FRACTION_BY_ACTIVITY = {"sedentary": 0.20, "light": 0.30, "moderate": 0.40, "active": 0.50}

# kcal per step per kg of body weight (≈ 0.47 kcal/step at 94.5 kg).
KCAL_PER_STEP_PER_KG = 0.0005

MET_REFERENCE = [
    {"key": "treadmill_walk", "activity": "Brisk treadmill walking / incline", "met_low": 4.0, "met_high": 5.0, "default": 4.5},
    {"key": "cycling_moderate", "activity": "Stationary cycling (moderate)", "met_low": 5.0, "met_high": 6.0, "default": 5.5},
    {"key": "resistance_general", "activity": "General resistance training (with rest)", "met_low": 3.5, "met_high": 4.5, "default": 4.0},
    {"key": "resistance_vigorous", "activity": "Vigorous lifting / circuit", "met_low": 5.0, "met_high": 6.0, "default": 5.5},
    {"key": "running_8kmh", "activity": "Running ~8 km/h", "met_low": 7.5, "met_high": 8.5, "default": 8.0},
    {"key": "elliptical", "activity": "Elliptical (moderate)", "met_low": 4.5, "met_high": 5.5, "default": 5.0},
    {"key": "rowing_machine", "activity": "Rowing machine (moderate)", "met_low": 4.8, "met_high": 7.0, "default": 6.0},
    {"key": "stair_climber", "activity": "Stair climber", "met_low": 8.0, "met_high": 9.0, "default": 8.8},
    {"key": "walking_casual", "activity": "Casual walking", "met_low": 3.0, "met_high": 3.5, "default": 3.3},
    {"key": "yoga_stretching", "activity": "Yoga / mobility", "met_low": 2.3, "met_high": 3.0, "default": 2.5},
]


def bmr_mifflin(weight_kg: float | None, height_cm: float | None, age: int | None, sex: str | None) -> float | None:
    """Mifflin-St Jeor. Returns None until weight, height, age and sex are all known."""
    if not weight_kg or not height_cm or not age or sex not in ("male", "female"):
        return None
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + 5 if sex == "male" else base - 161


def bmr_range_unknown_age_sex(weight_kg: float, height_cm: float) -> tuple[float, float]:
    """Indicative male BMR range for ages 20-40, shown while biometrics are pending."""
    base = 10 * weight_kg + 6.25 * height_cm + 5
    return base - 5 * 40, base - 5 * 20


def met_calories(met: float | None, weight_kg: float, minutes: float | None) -> float:
    """Exercise kcal ≈ MET × 3.5 × weight(kg) / 200 × minutes."""
    if not met or not minutes:
        return 0.0
    return met * 3.5 * weight_kg / 200 * minutes


def neat_calories(bmr: float | None, weight_kg: float, steps: int | None, activity_level: str | None) -> tuple[float | None, str]:
    """Non-exercise activity. Prefers step count; falls back to an activity-level fraction of BMR."""
    if steps:
        return steps * KCAL_PER_STEP_PER_KG * weight_kg, f"from {steps:,} steps"
    if bmr is None:
        return None, "pending BMR"
    level = activity_level or "sedentary"
    fraction = NEAT_FRACTION_BY_ACTIVITY.get(level, 0.20)
    note = f"estimated as {int(fraction * 100)}% of BMR ({level}{'' if activity_level else ', default'})"
    return bmr * fraction, note


def tef_calories(protein_g: float, carbs_g: float, fat_g: float) -> float:
    """Thermic effect of food, macro-weighted: protein 25%, carbs 7.5%, fat 2% of their energy."""
    return protein_g * 4 * 0.25 + carbs_g * 4 * 0.075 + fat_g * 9 * 0.02


def deficit(tdee: float | None, intake: float) -> float | None:
    """Daily deficit = TDEE − food intake (positive = deficit). Never intake − exercise."""
    if tdee is None:
        return None
    return tdee - intake


def bmi(weight_kg: float, height_cm: float) -> float:
    m = height_cm / 100
    return weight_kg / (m * m)


def bmi_category(value: float) -> str:
    if value < 18.5:
        return "Underweight"
    if value < 25:
        return "Normal"
    if value < 30:
        return "Overweight"
    return "Obese"


def navy_body_fat(sex: str | None, height_cm: float, waist_cm: float | None, neck_cm: float | None, hip_cm: float | None) -> float | None:
    """US-Navy circumference method (cm)."""
    try:
        if sex == "male" and waist_cm and neck_cm and waist_cm > neck_cm:
            return 495 / (1.0324 - 0.19077 * math.log10(waist_cm - neck_cm) + 0.15456 * math.log10(height_cm)) - 450
        if sex == "female" and waist_cm and neck_cm and hip_cm and waist_cm + hip_cm > neck_cm:
            return 495 / (1.29579 - 0.35004 * math.log10(waist_cm + hip_cm - neck_cm) + 0.22100 * math.log10(height_cm)) - 450
    except ValueError:
        return None
    return None


def protein_target(weight_kg: float, g_per_kg: float = 1.8) -> dict:
    return {"min": round(weight_kg * 1.6), "max": round(weight_kg * 2.0), "target": round(weight_kg * g_per_kg)}
