"""Database seeding. Run manually with:  python -m app.db.seed"""
import logging

from app.core.config import settings
from app.db.seed.baseline import seed_baseline
from app.db.seed.food_library import seed_food_library
from app.db.seed.presets import seed_presets
from app.db.session import SessionLocal, detect_vector_support
from app.services.llm.registry import sync_catalog

log = logging.getLogger(__name__)


async def run_all() -> None:
    await detect_vector_support()
    async with SessionLocal() as db:
        await sync_catalog(db)
        added = await seed_food_library(db)
        if added:
            log.info("Seeded %d reference foods", added)
        if settings.seed_baseline and await seed_baseline(db):
            log.info("Seeded baseline profile + Day 1 (26 Oct 2026) and Day 2 (27 Oct 2026)")
        if presets_added := await seed_presets(db):
            log.info("Seeded %d starter presets (workout routines and meals)", presets_added)
