"""Nutrition lookups: built-in library (fuzzy/vector), USDA FoodData Central, Open Food Facts, Tavily.

Every hit is normalised to `per_100g = {calories, protein, carbs, fat, fibre}`.
"""
import logging
import re

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache
from app.db.base import VectorState
from app.models import FoodLibraryItem
from app.services import app_settings
from app.services.ml import runtime
from app.services.nutrition.embedding import cosine, embed

log = logging.getLogger(__name__)

USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"
OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
TAVILY_URL = "https://api.tavily.com/search"
HTTP_HEADERS = {"User-Agent": "FitTrackAI/1.0 (self-hosted fitness tracker)"}

# USDA nutrient numbers
_USDA = {"208": "calories", "203": "protein", "205": "carbs", "204": "fat", "291": "fibre"}


def library_hit(item: FoodLibraryItem, score: float, match: str = "lexical") -> dict:
    return {
        "name": item.name,
        "source": item.source,
        "per_100g": {
            "calories": item.calories,
            "protein": item.protein,
            "carbs": item.carbs,
            "fat": item.fat,
            "fibre": item.fibre,
        },
        "serving_hint": item.serving_hint,
        "confidence": round(max(0.0, min(1.0, score)), 2),
        "url": None,
        "category": item.category,
        "tags": item.tags or [],
        "match": match,
        "library_id": item.id,
    }


async def _nearest_ids(db: AsyncSession, column: str, vec: list[float], n: int) -> list[int]:
    """IDs of the n nearest library items on a vector column (pgvector), or [] without pgvector."""
    if not VectorState.enabled:
        return []
    literal = "[" + ",".join(f"{v:.6f}" for v in vec) + "]"
    rows = await db.execute(
        text(f"SELECT id FROM food_library WHERE {column} IS NOT NULL ORDER BY {column} <=> CAST(:v AS vector) LIMIT :n"),
        {"v": literal, "n": n},
    )
    return [r.id for r in rows]


def _lexical_score(item: FoodLibraryItem, query: str, vec: list[float]) -> float:
    score = cosine(vec, item.embedding or embed(item.name))
    names = [item.name.lower(), *[a.lower() for a in (item.aliases or [])]]
    lowered = query.lower()
    if any(lowered == n for n in names):
        return max(score, 0.97)
    # Whole-word containment only ("oil" must not match "boiled").
    if any(_contains_words(lowered, n) or _contains_words(n, lowered) for n in names):
        return max(score, 0.8)
    return score


def _contains_words(text_: str, phrase: str) -> bool:
    return re.search(rf"(?<![a-z]){re.escape(phrase)}(?![a-z])", text_) is not None


def _semantic_confidence(similarity: float) -> float:
    """Maps Nomic cosine similarity (≈0.45 unrelated … ≈0.80 same dish) onto 0-1."""
    return max(0.0, min(1.0, (similarity - 0.45) / 0.35))


async def search_library(db: AsyncSession, query: str, limit: int = 5) -> list[dict]:
    """Hybrid search over the food library: character trigrams (typos) + semantic embeddings (meaning).

    Candidates come from pgvector nearest-neighbour queries when available; scoring is done here.
    The semantic part is used only when the text model is already loaded (never blocks a search).
    """
    q = query.strip()
    if not q:
        return []
    lex_vec = embed(q)
    sem_vec = await runtime.embed_text(q) if runtime.is_ready("text") else None

    candidate_ids = set(await _nearest_ids(db, "embedding", lex_vec, 15))
    if sem_vec is not None:
        candidate_ids |= set(await _nearest_ids(db, "semantic_embedding", sem_vec, 15))
    if candidate_ids:
        items = (await db.scalars(select(FoodLibraryItem).where(FoodLibraryItem.id.in_(candidate_ids)))).all()
    else:
        items = (await db.scalars(select(FoodLibraryItem))).all()

    scored = []
    for item in items:
        lexical = _lexical_score(item, q, lex_vec)
        if sem_vec is not None and item.semantic_embedding:
            semantic = _semantic_confidence(runtime.cosine(sem_vec, item.semantic_embedding))
            hybrid = 0.4 * lexical + 0.6 * semantic
            score, match = (lexical, "lexical") if lexical >= hybrid else (hybrid, "hybrid" if lexical > 0.3 else "semantic")
        else:
            score, match = lexical, "lexical"
        scored.append((item, score, match))
    scored.sort(key=lambda x: -x[1])
    return [library_hit(i, s, m) for i, s, m in scored[:limit]]


async def search_usda(db: AsyncSession, query: str, limit: int = 3) -> list[dict]:
    key = await app_settings.get_integration_key(db, "usda_api_key")
    if not key:
        return []
    cache_key = f"usda:{query.lower()}"
    if (cached := await cache.get(cache_key)) is not None:
        return cached
    # USDA expects one `dataType` parameter per value.
    params = [("query", query), ("pageSize", limit), ("api_key", key)]
    params += [("dataType", t) for t in ("Foundation", "SR Legacy", "Survey (FNDDS)")]
    try:
        # No custom User-Agent here: the USDA gateway rejects some UA strings with HTTP 400.
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(USDA_SEARCH_URL, params=params)
            resp.raise_for_status()
            foods = resp.json().get("foods", [])
    except Exception as exc:  # noqa: BLE001
        log.info("USDA lookup failed for %r: %s", query, exc)
        return []
    hits = []
    for food in foods[:limit]:
        per = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fibre": 0.0}
        for n in food.get("foodNutrients", []):
            field = _USDA.get(str(n.get("nutrientNumber")))
            if field and n.get("value") is not None:
                if field == "calories" and (n.get("unitName") or "").upper() != "KCAL":
                    continue
                per[field] = float(n["value"])
        if per["calories"] <= 0:
            continue
        hits.append(
            {
                "name": food.get("description", query).title(),
                "source": f"USDA FDC ({food.get('dataType', '')})",
                "per_100g": per,
                "serving_hint": None,
                "confidence": 0.7,
                "match": "lexical",
                "url": f"https://fdc.nal.usda.gov/food-details/{food.get('fdcId')}/nutrients",
            }
        )
    await cache.set(cache_key, hits, ttl=7 * 86400)
    return hits


async def search_open_food_facts(query: str, limit: int = 3) -> list[dict]:
    cache_key = f"off:{query.lower()}"
    if (cached := await cache.get(cache_key)) is not None:
        return cached
    params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": limit,
        "fields": "product_name,nutriments,code",
    }
    try:
        async with httpx.AsyncClient(timeout=8, headers=HTTP_HEADERS) as client:
            resp = await client.get(OFF_SEARCH_URL, params=params)
            resp.raise_for_status()
            products = resp.json().get("products", [])
    except Exception as exc:  # noqa: BLE001
        log.info("Open Food Facts lookup failed for %r: %s", query, exc)
        return []
    hits = []
    for p in products:
        n = p.get("nutriments") or {}
        kcal = n.get("energy-kcal_100g")
        if not kcal or not p.get("product_name"):
            continue
        hits.append(
            {
                "name": p["product_name"],
                "source": "Open Food Facts",
                "per_100g": {
                    "calories": float(kcal),
                    "protein": float(n.get("proteins_100g") or 0),
                    "carbs": float(n.get("carbohydrates_100g") or 0),
                    "fat": float(n.get("fat_100g") or 0),
                    "fibre": float(n.get("fiber_100g") or 0),
                },
                "serving_hint": None,
                "confidence": 0.5,
                "match": "lexical",
                "url": f"https://world.openfoodfacts.org/product/{p.get('code')}",
            }
        )
    await cache.set(cache_key, hits, ttl=7 * 86400)
    return hits


async def web_snippets(db: AsyncSession, query: str, limit: int = 3) -> list[dict]:
    """Tavily web search (optional). Returns [{title, url, content}]."""
    key = await app_settings.get_integration_key(db, "tavily_api_key")
    if not key:
        return []
    cache_key = f"tavily:{query.lower()}"
    if (cached := await cache.get(cache_key)) is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(TAVILY_URL, json={"api_key": key, "query": query, "max_results": limit})
            resp.raise_for_status()
            results = [
                {"title": r.get("title"), "url": r.get("url"), "content": (r.get("content") or "")[:600]}
                for r in resp.json().get("results", [])
            ]
    except Exception as exc:  # noqa: BLE001
        log.info("Tavily search failed for %r: %s", query, exc)
        return []
    await cache.set(cache_key, results, ttl=7 * 86400)
    return results


async def search_all(db: AsyncSession, query: str) -> list[dict]:
    """Combined search used by the UI autocomplete."""
    hits = await search_library(db, query, limit=6)
    if not hits or hits[0]["confidence"] < 0.8:
        hits += await search_usda(db, query)
        if len(hits) < 4:
            hits += await search_open_food_facts(query)
    return hits[:10]
