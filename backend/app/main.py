"""FitTrack AI — FastAPI application entry point.

Startup sequence: apply Alembic migrations → detect pgvector → sync the AI catalog →
seed reference foods and the baseline record (first run only) → connect cache.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import ai, assistant, daily, food, health, insights, ollama, profile, quicklog, system, workouts
from app.core.cache import cache
from app.core.config import settings
from app.db.migrate import run_migrations
from app.db.seed import run_all as run_seeds
from app.db.session import SessionLocal, engine
from app.services.ml import food_recognition, runtime
from app.services.data.exporter import sync_if_enabled

logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
log = logging.getLogger("fittrack")


async def _after_model_load(key: str) -> None:
    """Once the text model is ready, give every food-library item a semantic embedding."""
    if key == "text":
        async with SessionLocal() as db:
            added = await food_recognition.backfill_library_embeddings(db)
            if added:
                log.info("Semantic embeddings added for %d food-library items", added)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await run_migrations()
    await run_seeds()
    await cache.connect()
    await sync_if_enabled()
    runtime.on_model_ready(_after_model_load)
    if settings.ml_enabled and settings.ml_preload:
        for key in runtime.SLOTS:  # downloads on first run (~0.23 GB), then loads from data/models
            runtime.start_background_load(key)
    log.info("%s %s ready (db=%s, cache=%s)", settings.app_name, settings.app_version, engine.dialect.name, cache.backend)
    yield
    await cache.close()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI fitness, nutrition & bio-feedback intelligence platform. See docs/API.md.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (system, profile, daily, food, workouts, quicklog, health, insights, assistant, ai, ollama):
    app.include_router(module.router, prefix="/api")

app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/", include_in_schema=False)
async def root():
    return {"name": settings.app_name, "version": settings.app_version, "docs": "/docs", "health": "/api/health"}
