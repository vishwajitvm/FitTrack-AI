"""Profile-level metrics: BMR, BMI, protein target, maintenance estimate, body composition."""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DailySummary, User
from app.services.science import energy


async def profile_metrics(db: AsyncSession, user: User) -> dict:
    weight = user.current_weight or user.starting_weight
    missing = [f for f in ("age", "sex") if not getattr(user, f)]
    bmr = energy.bmr_mifflin(weight, user.height_cm, user.age, user.sex)
    bmi = energy.bmi(weight, user.height_cm)
    neat, _ = energy.neat_calories(bmr, weight, user.avg_daily_steps, user.activity_level)

    # Typical training day: 30 min cardio (MET 5) + 60 min lifting (MET 4); TEF ≈ 10%.
    typical_exercise = energy.met_calories(5.0, weight, 30) + energy.met_calories(4.0, weight, 60)
    tdee = None
    maintenance = None
    calorie_target = None
    if bmr is not None:
        base = bmr + (neat or 0)
        tdee = round((base + typical_exercise) / 0.9)
        maintenance = {"low": round(base / 0.9), "high": tdee}
        calorie_target = round(max(tdee - 600, bmr * 0.9, 1500))

    body_fat = user.body_fat_pct or energy.navy_body_fat(user.sex, user.height_cm, user.waist_cm, user.neck_cm, user.hip_cm)
    days_tracked = await db.scalar(select(func.count()).select_from(DailySummary).where(DailySummary.total_calories > 0)) or 0
    return {
        "bmr": round(bmr) if bmr is not None else None,
        "bmr_status": "ok" if bmr is not None else "pending",
        "missing_fields": missing,
        "bmi": round(bmi, 1),
        "bmi_category": energy.bmi_category(bmi),
        "protein_target_g": energy.protein_target(weight, user.protein_target_g_per_kg),
        "calorie_target": calorie_target,
        "tdee_estimate": tdee,
        "maintenance_range": maintenance,
        "body_fat_estimate_pct": round(body_fat, 1) if body_fat else None,
        "lean_mass_kg": round(weight * (1 - body_fat / 100), 1) if body_fat else None,
        "water_target_ml": user.water_target_ml or round(weight * 35),
        "weight_change_kg": round(weight - user.starting_weight, 2),
        "days_tracked": days_tracked,
    }
