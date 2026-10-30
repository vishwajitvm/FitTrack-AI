"""Loads the built-in reference foods into `food_library` (with trigram embeddings)."""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FoodLibraryItem
from app.services.nutrition.embedding import embed
from app.services.nutrition.food_library_data import FOODS


async def seed_food_library(db: AsyncSession) -> int:
    if await db.scalar(select(func.count()).select_from(FoodLibraryItem)):
        return 0
    for name, aliases, category, kcal, p, c, f, fib, density, hint, tags in FOODS:
        db.add(
            FoodLibraryItem(
                name=name, aliases=aliases, category=category, calories=kcal, protein=p, carbs=c, fat=f, fibre=fib,
                density_g_per_ml=density, serving_hint=hint, tags=tags, source="Built-in (IFCT/USDA composite)",
                embedding=embed(" ".join([name, *aliases])),
            )
        )
    await db.commit()
    return len(FOODS)
