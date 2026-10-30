"""Meal suggestions that close today's protein / calorie / fibre gaps — mixed-integer linear programming.

Decision variables per eligible library food i:
  s_i ∈ {0, 1, 2, 3}  servings,   y_i ∈ {0, 1}  chosen,   s_i ≤ 3·y_i,   Σ y_i ≤ 3
Deviation variables turn |target − achieved| into linear terms:
  minimise  w_p·(protein shortfall) + w_k·(kcal over) + w_k2·(kcal under) + w_f·(fibre shortfall)
Constraints encode diet type, intolerances and the late-evening rule (light foods only close to bed).
Three diverse suggestions come from re-solving with previously chosen foods excluded.
"""
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FoodLibraryItem, User
from app.services.ml.meal_parser import CATEGORY_SERVING_G, PIECE_GRAMS
from app.services.nutrition.tagging import minutes_of

MAX_FOODS = 3
MAX_SERVINGS = 3
EXCLUDED_CATEGORIES = {"fat", "sugar", "condiment", "dessert", "fast_food", "snack", "dry_ingredient"}
MEAT = ("chicken", "fish", "mutton", "biryani", "tandoori")
EGG = ("egg", "omelette")
SLOT_SHARE = {"snack": 0.35, "post_workout": 0.5}  # fraction of the remaining gap a slot should cover
LIGHT_MAX_KCAL_PER_SERVING = 250
LIGHT_MAX_FAT_PER_SERVING = 8


def _serving_grams(item: FoodLibraryItem) -> float:
    name = item.name.lower()
    for word, grams in PIECE_GRAMS.items():
        if word in name:
            return grams
    return CATEGORY_SERVING_G.get(item.category, 150)


def _allowed(item: FoodLibraryItem, user: User, light_only: bool) -> bool:
    name = item.name.lower()
    tags = set(item.tags or [])
    if item.category in EXCLUDED_CATEGORIES or "fried" in tags:
        return False
    diet = user.diet_type or "non_vegetarian"
    if diet in ("vegetarian", "vegan", "eggetarian") and any(m in name for m in MEAT):
        return False
    if diet in ("vegetarian", "vegan") and any(e in name for e in EGG):
        return False
    if diet == "vegan" and "lactose" in tags:
        return False
    intolerances = " ".join(user.intolerances or []).lower() + " " + " ".join(user.allergies or []).lower()
    if "lactose" in intolerances or "dairy" in intolerances:
        if "lactose" in tags:
            return False
    if "gluten" in intolerances and "gluten" in tags:
        return False
    if any(a.strip() and a.strip().lower() in name for a in (user.allergies or [])):
        return False
    if light_only:
        if "caffeine" in tags:  # no tea/coffee close to bedtime
            return False
        grams = _serving_grams(item)
        if item.calories * grams / 100 > LIGHT_MAX_KCAL_PER_SERVING or item.fat * grams / 100 > LIGHT_MAX_FAT_PER_SERVING:
            return False
        if item.category in ("cooked_rice", "pasta", "bread"):
            return False
    return True


def _solve(foods: list[FoodLibraryItem], target: dict, max_foods: int = MAX_FOODS) -> list[tuple[FoodLibraryItem, int]] | None:
    n = len(foods)
    if n == 0:
        return None
    grams = np.array([_serving_grams(f) for f in foods])
    kcal = np.array([f.calories for f in foods]) * grams / 100
    protein = np.array([f.protein for f in foods]) * grams / 100
    fibre = np.array([f.fibre for f in foods]) * grams / 100

    # variable layout: s (n) | y (n) | protein_short, kcal_over, kcal_under, fibre_short, protein_over (5)
    nv = 2 * n + 5
    c = np.zeros(nv)
    c[2 * n:] = [4.0, 0.03, 0.01, 1.0, 0.5]  # protein gap dominates; overshooting kcal or protein also costs
    c[:n] = 0.05  # tiny cost per serving → prefer simpler meals

    rows, lo, hi = [], [], []

    def add(row, lower, upper):
        rows.append(row)
        lo.append(lower)
        hi.append(upper)

    for i in range(n):  # s_i − 3·y_i ≤ 0
        row = np.zeros(nv)
        row[i], row[n + i] = 1, -MAX_SERVINGS
        add(row, -np.inf, 0)
    row = np.zeros(nv)
    row[n:2 * n] = 1
    add(row, 1, max_foods)
    row = np.zeros(nv)  # protein + short − over = target
    row[:n], row[2 * n], row[2 * n + 4] = protein, 1, -1
    add(row, target["protein"], target["protein"])
    row = np.zeros(nv)  # kcal − over + under = target
    row[:n], row[2 * n + 1], row[2 * n + 2] = kcal, -1, 1
    add(row, target["calories"], target["calories"])
    row = np.zeros(nv)  # fibre + short ≥ target
    row[:n], row[2 * n + 3] = fibre, 1
    add(row, target["fibre"], np.inf)

    integrality = np.concatenate([np.ones(2 * n), np.zeros(5)])
    upper = np.concatenate([np.full(n, MAX_SERVINGS), np.ones(n), np.full(5, np.inf)])
    res = milp(c, constraints=LinearConstraint(np.array(rows), lo, hi), integrality=integrality,
               bounds=Bounds(np.zeros(nv), upper), options={"time_limit": 5})
    if res.x is None:
        return None
    servings = np.round(res.x[:n]).astype(int)
    return [(foods[i], int(servings[i])) for i in range(n) if servings[i] > 0]


def _line(item: FoodLibraryItem, servings: int) -> dict:
    grams = _serving_grams(item) * servings
    return {
        "food": item.name,
        "servings": servings,
        "grams": round(grams),
        "calories": round(item.calories * grams / 100),
        "protein": round(item.protein * grams / 100, 1),
        "carbs": round(item.carbs * grams / 100, 1),
        "fat": round(item.fat * grams / 100, 1),
        "fibre": round(item.fibre * grams / 100, 1),
    }


async def suggest(db: AsyncSession, user: User, day: dict, slot: str, now_minutes: int | None) -> dict:
    weight = day["weight_used_kg"]
    protein_target = weight * (user.protein_target_g_per_kg or 1.8)
    tdee = day.get("estimated_tdee") or day.get("adaptive_tdee")
    calorie_target = (tdee - 600) if tdee else 30 * weight - 600  # moderate deficit
    remaining = {
        "calories": max(0, round(calorie_target - day["total_calories"])),
        "protein": max(0, round(protein_target - day["total_protein"], 1)),
        "carbs": None,
        "fat": None,
        "fibre": max(0, round(25 - day["total_fibre"], 1)),
    }
    bed = minutes_of(user.bedtime)
    late = slot == "post_workout" or (slot == "now" and bed is not None and now_minutes is not None and now_minutes >= bed - 90)
    share = SLOT_SHARE.get(slot, 1.0)
    target = {
        "calories": min(remaining["calories"] * share, 350 if late else 900),
        "protein": min(remaining["protein"] * share, 40 if late else 60),
        "fibre": 0 if late else remaining["fibre"] * share,
    }

    constraints = [f"Diet: {(user.diet_type or 'non_vegetarian').replace('_', ' ')}"]
    if user.intolerances:
        constraints.append("Avoids: " + ", ".join(user.intolerances))
    if late:
        constraints.append(f"Close to bedtime ({user.bedtime}): light, low-fat, no caffeine, ≤ 350 kcal, max 2 foods")
    constraints.append("No fried foods, sweets or fast food")

    library = (await db.scalars(select(FoodLibraryItem))).all()
    eligible = [f for f in library if _allowed(f, user, late)]
    suggestions, excluded = [], set()
    if target["calories"] > 50 or target["protein"] > 5:
        for _ in range(3):
            pool = [f for f in eligible if f.id not in excluded]
            picked = _solve(pool, target, max_foods=2 if late else MAX_FOODS)
            if not picked:
                break
            lines = [_line(f, s) for f, s in picked]
            totals = {k: round(sum(line[k] for line in lines), 1) for k in ("calories", "protein", "carbs", "fat", "fibre")}
            excluded |= {f.id for f, _ in picked}
            suggestions.append(
                {
                    "title": " + ".join(line["food"].split(" (")[0].split(",")[0] for line in lines),
                    "items": lines,
                    "totals": totals,
                    "reason": f"{totals['protein']:.0f} g protein for {totals['calories']:.0f} kcal "
                              f"(aim for this {'light ' if late else ''}meal: ~{target['protein']:.0f} g protein, "
                              f"~{target['calories']:.0f} kcal).",
                }
            )
    return {
        "date": day["date"],
        "slot": slot,
        "remaining": remaining,
        "constraints": constraints,
        "suggestions": suggestions,
        "method": "milp",
    }

