"""Meal photo recognition without an LLM.

1. Duplicate photo   – pHash Hamming distance against recent analyses.
2. Personal memory   – k-nearest-neighbour over image embeddings of meals YOU saved.
3. Zero-shot dishes  – image embedding vs text embeddings of food-library names
                       (both models share one vector space).

Published zero-shot accuracy on Indian dishes is modest, so (3) is a hint; (2) becomes
reliable as you save meals because it compares against your own plates and containers.
"""
import math
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import VectorState
from app.models import FoodAnalysis, FoodLibraryItem, MealMemory
from app.services.ml import runtime
from app.services.ml.image_features import DUPLICATE_MAX_DISTANCE, hamming

ZERO_SHOT_TEMPERATURE = 100.0  # softmax sharpness over cosine similarities (CLIP-style logit scale)
PERSONAL_MATCH_SIMILARITY = 0.93  # "this is your usual meal" threshold
SIMILAR_MEAL_MIN = 0.75
DUPLICATE_WINDOW_DAYS = 60

_labels: dict = {"ids": [], "names": [], "categories": [], "vectors": None}


def _vector_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in vec) + "]"


async def _label_vectors(db: AsyncSession) -> dict | None:
    if _labels["vectors"] is not None:
        return _labels
    items = (await db.scalars(select(FoodLibraryItem).order_by(FoodLibraryItem.id))).all()
    vectors = await runtime.embed_texts([f"a photo of {i.name}, a dish of food" for i in items])
    if vectors is None:
        return None
    _labels.update(ids=[i.id for i in items], names=[i.name for i in items], categories=[i.category for i in items], vectors=vectors)
    return _labels


def reset_label_cache() -> None:
    _labels["vectors"] = None


async def zero_shot(db: AsyncSession, image_vec: list[float], top: int = 5) -> list[dict]:
    labels = await _label_vectors(db)
    if not labels:
        return []
    sims = [runtime.cosine(image_vec, v) for v in labels["vectors"]]
    peak = max(sims)
    weights = [math.exp((s - peak) * ZERO_SHOT_TEMPERATURE) for s in sims]
    total = sum(weights)
    ranked = sorted(range(len(sims)), key=lambda i: -sims[i])[:top]
    return [
        {"label": labels["names"][i], "score": round(weights[i] / total, 3), "similarity": round(sims[i], 3),
         "library_id": labels["ids"][i], "category": labels["categories"][i]}
        for i in ranked
    ]


async def similar_meals(db: AsyncSession, image_vec: list[float], limit: int = 3) -> list[dict]:
    if VectorState.enabled:
        rows = await db.execute(
            text(
                "SELECT id, 1 - (image_embedding <=> CAST(:v AS vector)) AS sim FROM meal_memories "
                "ORDER BY image_embedding <=> CAST(:v AS vector) LIMIT :n"
            ),
            {"v": _vector_literal(image_vec), "n": limit},
        )
        scored = [(r.id, float(r.sim)) for r in rows]
        memories = {m.id: m for m in (await db.scalars(select(MealMemory).where(MealMemory.id.in_([s[0] for s in scored])))).all()}
        pairs = [(memories[i], s) for i, s in scored if i in memories]
    else:
        memories = (await db.scalars(select(MealMemory))).all()
        pairs = sorted(((m, runtime.cosine(image_vec, m.image_embedding)) for m in memories), key=lambda x: -x[1])[:limit]
    return [
        {"memory_id": m.id, "analysis_id": m.analysis_id, "name": m.label, "date": m.date.isoformat(), "similarity": round(sim, 3),
         "calories": round(m.calories), "image_url": m.image_url, "items": m.items_json, "container_id": m.container_id}
        for m, sim in pairs
        if sim >= SIMILAR_MEAL_MIN
    ]


async def find_duplicate(db: AsyncSession, photo_hash: str) -> FoodAnalysis | None:
    since = datetime.now(timezone.utc) - timedelta(days=DUPLICATE_WINDOW_DAYS)
    rows = (await db.scalars(
        select(FoodAnalysis)
        .where(FoodAnalysis.phash.is_not(None), FoodAnalysis.status == "completed", FoodAnalysis.created_at >= since)
        .order_by(FoodAnalysis.id.desc())
        .limit(500)
    )).all()
    best = min(rows, key=lambda r: hamming(photo_hash, r.phash), default=None)
    if best is not None and hamming(photo_hash, best.phash) <= DUPLICATE_MAX_DISTANCE:
        return best
    return None


async def remember_meal(db: AsyncSession, analysis: FoodAnalysis, items: list[dict], day: date, label: str) -> None:
    """Store a user-confirmed photo meal so future photos of it are recognised (personal k-NN)."""
    if not analysis.image_embedding:
        return
    existing = await db.scalar(select(MealMemory).where(MealMemory.analysis_id == analysis.id))
    if existing is not None:
        await db.delete(existing)
    db.add(
        MealMemory(
            analysis_id=analysis.id,
            date=day,
            label=label[:200],
            image_url=analysis.image_path,
            container_id=(analysis.input_json or {}).get("container_id"),
            items_json=items,
            calories=sum(float(i.get("calories") or 0) for i in items),
            weight_grams=sum(float(i.get("estimated_weight_g") or 0) for i in items) or None,
            image_embedding=analysis.image_embedding,
        )
    )


async def backfill_library_embeddings(db: AsyncSession) -> int:
    """Gives every food-library item a semantic (Nomic text) embedding for hybrid search."""
    missing = (await db.scalars(select(FoodLibraryItem).where(FoodLibraryItem.semantic_embedding.is_(None)))).all()
    if not missing:
        return 0
    vectors = await runtime.embed_texts([", ".join([i.name, *(i.aliases or [])]) for i in missing], document=True)
    if vectors is None:
        return 0
    for item, vec in zip(missing, vectors):
        item.semantic_embedding = vec
    await db.commit()
    reset_label_cache()
    return len(missing)
