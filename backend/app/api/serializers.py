"""ORM → JSON dictionaries matching docs/API.md."""
from app.models import BioFeedback, FoodLog, User, WorkoutLog, WorkoutSession

SEVERITY_LABELS = ["none", "mild", "moderate", "severe"]

PROFILE_FIELDS = [
    "id", "name", "age", "sex", "height_cm", "goal", "target_weight_kg", "start_date", "weekly_rate_kg", "activity_level",
    "avg_daily_steps", "body_fat_pct", "waist_cm", "neck_cm", "hip_cm", "diet_type", "allergies", "intolerances",
    "medical_conditions", "medications", "supplements", "protein_supplement_name", "protein_supplement_type",
    "scoop_size_g", "protein_per_scoop_g", "calories_per_scoop", "carbs_per_scoop_g", "fat_per_scoop_g", "training_split", "training_experience", "rest_day", "wake_time",
    "gym_start_time", "gym_return_time", "bedtime", "protein_target_g_per_kg", "water_target_ml", "sleep_target_hours",
    "preferred_cuisine", "timezone", "notes", "created_at", "updated_at",
]


def profile_out(u: User) -> dict:
    out = {f: getattr(u, f) for f in PROFILE_FIELDS}
    out["starting_weight_kg"] = u.starting_weight
    out["current_weight_kg"] = u.current_weight or u.starting_weight
    return out


def food_out(f: FoodLog) -> dict:
    return {
        "id": f.id,
        "date": f.date,
        "meal_type": f.meal_type,
        "time": f.time,
        "timestamp": f.timestamp,
        "food_name": f.food_name,
        "ingredients": f.ingredients_json or [],
        "quantity": f.quantity,
        "portion_unit": f.portion_unit,
        "weight_grams": f.weight_grams,
        "calories": f.calories,
        "protein": f.protein,
        "carbs": f.carbs,
        "fat": f.fat,
        "fibre": f.fibre,
        "calories_low": f.calories_low,
        "calories_high": f.calories_high,
        "confidence_score": f.confidence_score,
        "research_source": f.research_source,
        "image_url": f.image_url,
        "tags": f.tags or [],
        "notes": f.notes,
        "analysis_id": f.analysis_id,
    }


def session_out(s: WorkoutSession) -> dict:
    return {
        "id": s.id,
        "date": s.date,
        "split": s.split,
        "lifting_duration_min": s.lifting_duration_min,
        "lifting_met": s.lifting_met,
        "session_rpe": s.session_rpe,
        "estimated_calories": s.estimated_calories,
        "started_at": s.started_at,
        "notes": s.notes,
    }


def workout_out(w: WorkoutLog) -> dict:
    return {
        "id": w.id,
        "date": w.date,
        "session_id": w.session_id,
        "workout_type": w.workout_type,
        "exercise_name": w.exercise_name,
        "target_muscle": w.target_muscle,
        "sets": w.sets,
        "reps": w.reps,
        "weight_kg": w.weight_kg,
        "sets_json": w.sets_json or [],
        "cardio_duration_min": w.cardio_duration_min,
        "lifting_duration_min": w.lifting_duration_min,
        "estimated_calories": w.estimated_calories,
        "met_value": w.met_value,
        "rpe": w.rpe,
        "notes": w.notes,
    }


def biofeedback_out(b: BioFeedback) -> dict:
    return {
        "id": b.id,
        "timestamp": b.timestamp,
        "date": b.date,
        "symptom_type": b.symptom_type,
        "severity": b.severity,
        "severity_label": SEVERITY_LABELS[max(0, min(3, b.severity))],
        "trigger_suspect": b.trigger_suspect,
        "body_part": b.body_part,
        "notes": b.notes,
    }
