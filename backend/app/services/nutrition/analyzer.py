"""Meal photo / description analyzer — ML first, LLM only when it adds value.

Pipeline
  0. On-device ML  – photo quality, duplicate-photo check (pHash), image embedding,
                     zero-shot dish guesses, your similar past meals (k-NN), portion calibration.
                     A duplicate photo or a very strong personal match is answered without any LLM.
  1. Geometry      – container volume × fill level × density × your calibration factor
  2. Vision/LLM    – identify every item (incl. hidden oil, ghee, sauces), estimate grams + ranges
                     (skipped with ml_only, and replaced by ML when no AI provider is available)
  3. Grounding     – per-100 g values (built-in library → USDA → Open Food Facts → web)
  4. Reconcile     – scale to a known weight / geometry, blend LLM and database macros,
                     compute low–high calorie ranges and confidence
"""
import base64
import io
import logging
import uuid
from pathlib import Path

from PIL import Image, ImageOps
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import FoodAnalysis
from app.services.llm import router
from app.services.llm.client import ChatMessage
from app.services.ml import calibration, food_recognition, image_features, meal_parser, runtime
from app.services.nutrition import search
from app.services.nutrition.portions import geometric_estimate
from app.services.nutrition.tagging import infer_tags
from app.services.tracker import daily

log = logging.getLogger(__name__)

MAX_IMAGE_SIDE = 1280

SYSTEM_PROMPT = """You are a registered sports dietitian and food scientist specialised in Indian and global home cooking.
You analyse a meal (photo and/or description) and estimate portion WEIGHTS precisely.

Method:
- Identify EVERY component, including hidden calories: cooking oil/ghee/butter in tadka, sauces, cheese, sugar in drinks, peanuts, cream.
- Estimate weight in grams using visual references: container type and size, plate diameter, cutlery, hand size, food depth and fill level.
  Typical bulk densities (g/ml): cooked rice 0.65-0.75, pasta 0.55-0.65, dal/curry 1.0, dry sabzi 0.55-0.65, salad 0.25-0.35, milk/chai 1.03.
- If the user gives a known weight, the item weights MUST sum to it. If a container geometry estimate is given, use it as a strong prior.
- Give a realistic low/high weight range reflecting your uncertainty.
- Macros must be for the estimated weight (not per 100 g). Calories ≈ 4P + 4C + 9F.
- `search_query` is a short generic name for a nutrition database (e.g. "vegetable fried rice", "boiled egg white").
- tags from: lactose, gluten, refined_flour, fried, caffeine, high_sodium, legumes, spicy.

Return ONLY JSON with this exact shape:
{
 "dish_summary": "string",
 "container_observed": "string",
 "items": [
  {"name": "string", "search_query": "string", "ingredients": ["string"], "cooking_method": "string",
   "estimated_weight_g": 0, "weight_low_g": 0, "weight_high_g": 0, "volume_ml": 0,
   "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fibre": 0,
   "confidence": 0.0, "tags": ["string"], "notes": "string"}
 ],
 "portion_reasoning": "string",
 "hidden_calories": ["string"],
 "warnings": ["string"],
 "coach_note": "string",
 "overall_confidence": 0.0
}"""


def _num(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def prepare_image(raw: bytes) -> tuple[str, bytes]:
    """Auto-rotate, downscale and re-encode as JPEG. Returns (base64, jpeg_bytes)."""
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    data = buf.getvalue()
    return base64.b64encode(data).decode(), data


def save_upload(data: bytes, folder: str, suffix: str) -> str:
    """Saves bytes under UPLOAD_DIR/folder and returns the public `/uploads/...` URL."""
    target = Path(settings.upload_dir) / folder
    target.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{suffix}"
    (target / name).write_bytes(data)
    return f"/uploads/{folder}/{name}"


def _user_context(inp: dict, geometry: dict | None) -> str:
    lines = ["Analyse this meal."]
    labels = {
        "description": "User description",
        "ingredients": "Ingredients (user-provided)",
        "cooking_method": "Cooking method",
        "oil_used": "Oil/fat used",
        "known_weight_g": "KNOWN total weight (g)",
        "servings": "Servings in the photo/description",
        "portion_eaten": "Fraction actually eaten",
        "meal_type": "Meal",
    }
    for key, label in labels.items():
        if inp.get(key) not in (None, ""):
            lines.append(f"- {label}: {inp[key]}")
    if geometry:
        lines.append(
            f"- Container: {geometry['container_label']} ≈ {geometry['container_volume_ml']} ml, fill ≈ {int(geometry['fill_fraction'] * 100)}%"
            f"{' (assumed)' if geometry['fill_assumed'] else ''}. Geometry estimate ≈ {geometry['est_food_volume_ml']} ml "
            f"≈ {geometry['est_weight_g_from_geometry']} g of food ({geometry['food_category']}, {geometry['density_g_per_ml']} g/ml)."
        )
    if inp.get("plate_diameter_cm"):
        lines.append(f"- Plate diameter: {inp['plate_diameter_cm']} cm")
    lines.append("Estimate for ONE serving as shown (servings/portion scaling is applied afterwards).")
    return "\n".join(lines)


async def _ground_item(db: AsyncSession, item: dict) -> tuple[dict | None, list[dict]]:
    """Find per-100 g reference values for an item. Returns (hit, sources)."""
    query = item.get("search_query") or item.get("name") or ""
    lib = await search.search_library(db, query, limit=1)
    if lib and lib[0]["confidence"] >= 0.6:
        return lib[0], [{"name": f"{lib[0]['source']}: {lib[0]['name']}", "url": None}]
    usda = await search.search_usda(db, query, limit=1)
    if usda:
        return usda[0], [{"name": f"{usda[0]['source']}: {usda[0]['name']}", "url": usda[0]["url"]}]
    off = await search.search_open_food_facts(query, limit=1)
    if off:
        return off[0], [{"name": f"Open Food Facts: {off[0]['name']}", "url": off[0]["url"]}]
    snippets = await search.web_snippets(db, f"{query} nutrition per 100g calories protein")
    return None, [{"name": s["title"], "url": s["url"]} for s in snippets]


def _reconcile_weights(items: list[dict], inp: dict, geometry: dict | None, warnings: list[str]) -> None:
    total = sum(i["estimated_weight_g"] for i in items) or 0
    known = _num(inp.get("known_weight_g"), 0)
    if known > 0 and total > 0:
        factor = known / total
        for i in items:
            i["estimated_weight_g"] *= factor
            i["weight_low_g"] = i["estimated_weight_g"] * 0.95
            i["weight_high_g"] = i["estimated_weight_g"] * 1.05
        return
    if geometry and total > 0 and len(items) <= 3:
        geo = geometry["est_weight_g_from_geometry"]
        if abs(total - geo) / geo > 0.4:
            factor = ((total + geo) / 2) / total
            warnings.append(
                f"Vision weight ({total:.0f} g) and container geometry ({geo} g) disagreed; used the average. "
                "Enter a known weight for best accuracy."
            )
            for i in items:
                for key in ("estimated_weight_g", "weight_low_g", "weight_high_g"):
                    i[key] *= factor


def _ml_hints(ml: dict) -> str:
    lines = []
    if ml["predictions"]:
        guesses = ", ".join(f"{p['label']} ({round(p['score'] * 100)}%)" for p in ml["predictions"][:3])
        lines.append(f"- On-device image recognizer guesses (can be wrong, verify visually): {guesses}")
    for m in ml["similar_meals"][:2]:
        lines.append(f"- Looks similar ({round(m['similarity'] * 100)}%) to a meal the user logged before: "
                     f"'{m['name']}' ≈ {m['calories']} kcal")
    if ml["calibration"]:
        lines.append(f"- The user's real portions in this container are typically ×{ml['calibration']['factor']} "
                     "the geometric estimate (already applied above).")
    return "\n".join(lines)


def _library_item(name: str, grams: float, per: dict, *, ingredients: list[str], source: str, confidence: float,
                  tags: list[str], notes: str = "", spread: float = 0.25) -> dict:
    kcal = per["calories"] * grams / 100
    return {
        "name": name,
        "ingredients": ingredients,
        "cooking_method": None,
        "estimated_weight_g": round(grams),
        "weight_low_g": round(grams * (1 - spread)),
        "weight_high_g": round(grams * (1 + spread)),
        "volume_ml": None,
        "calories": round(kcal),
        "calories_low": round(kcal * (1 - spread)),
        "calories_high": round(kcal * (1 + spread)),
        "protein": round(per["protein"] * grams / 100, 1),
        "carbs": round(per["carbs"] * grams / 100, 1),
        "fat": round(per["fat"] * grams / 100, 1),
        "fibre": round(per["fibre"] * grams / 100, 1),
        "per_100g": {k: round(per[k], 1) for k in ("calories", "protein", "carbs", "fat", "fibre")},
        "source": source,
        "confidence": round(confidence, 2),
        "tags": tags,
        "notes": notes,
    }


def _rescale(items: list[dict], factor: float) -> None:
    for item in items:
        for key in ("estimated_weight_g", "weight_low_g", "weight_high_g", "calories", "calories_low", "calories_high"):
            item[key] = round(item[key] * factor)
        for key in ("protein", "carbs", "fat", "fibre"):
            item[key] = round(item[key] * factor, 1)


async def _ml_only_items(db: AsyncSession, inp: dict, geometry: dict | None, ml: dict, warnings: list[str]) -> list[dict]:
    """Builds items without any LLM: typed description → parser, otherwise your similar meal or the best image guess."""
    text = " ".join(str(inp.get(k) or "") for k in ("description", "ingredients")).strip()
    known = _num(inp.get("known_weight_g"), 0)
    if text:
        parsed = await meal_parser.parse(db, text, await daily.get_user(db))
        items = [
            _library_item(p["name"], p["grams"], {k: p[k] * 100 / p["grams"] for k in ("calories", "protein", "carbs", "fat", "fibre")},
                          ingredients=[p["text"]], source=p["source"], confidence=p["confidence"], tags=p["tags"])
            for p in parsed["items"] if p["grams"]
        ]
        if parsed["unparsed"]:
            warnings.append("Not recognised without AI: " + ", ".join(parsed["unparsed"]))
        if items:
            if known > 0:
                _rescale(items, known / sum(i["estimated_weight_g"] for i in items))
            elif geometry and len(items) == 1:
                _rescale(items, geometry["est_weight_g_from_geometry"] / items[0]["estimated_weight_g"])
            return items
    match = ml["similar_meals"][0] if ml["similar_meals"] else None
    if match and match["similarity"] >= 0.85 and match["items"]:
        return [dict(i, source=f"Your meal from {match['date']}", confidence=round(min(0.8, match["similarity"] - 0.1), 2))
                for i in match["items"]]
    if ml["predictions"]:
        top = ml["predictions"][0]
        hits = await search.search_library(db, top["label"], limit=1)
        if hits:
            grams = known or (geometry["est_weight_g_from_geometry"] if geometry else None) or 250
            warnings.append(f"Recognised on-device as '{top['label']}' ({round(top['score'] * 100)}% likely) — "
                            "please check the item name and weight.")
            return [_library_item(top["label"], grams, hits[0]["per_100g"], ingredients=[],
                                  source="On-device image recognition + built-in library",
                                  confidence=min(0.5, top["score"]), tags=hits[0].get("tags", []), spread=0.35)]
    return []


async def _llm_items(db: AsyncSession, raw: dict, inp: dict, geometry: dict | None, warnings: list[str]) -> tuple[list[dict], list[dict]]:
    """Post-processes LLM items: reconcile weights, ground in nutrition databases, blend macros."""
    servings = _num(inp.get("servings"), 1) or 1
    eaten = min(1.0, max(0.05, _num(inp.get("portion_eaten"), 1) or 1))
    items: list[dict] = []
    for it in raw.get("items") or []:
        w = max(1.0, _num(it.get("estimated_weight_g"), 100))
        items.append(
            {
                "name": str(it.get("name") or "Unknown item"),
                "search_query": it.get("search_query"),
                "ingredients": [str(x) for x in it.get("ingredients") or []],
                "cooking_method": it.get("cooking_method"),
                "estimated_weight_g": w,
                "weight_low_g": _num(it.get("weight_low_g"), w * 0.8) or w * 0.8,
                "weight_high_g": _num(it.get("weight_high_g"), w * 1.2) or w * 1.2,
                "volume_ml": _num(it.get("volume_ml"), 0) or None,
                # The model's own macros, valid for the weight it estimated (llm_weight_g).
                "llm": {k: _num(it.get(k)) for k in ("calories", "protein", "carbs", "fat", "fibre")},
                "llm_weight_g": w,
                "confidence": min(1.0, max(0.0, _num(it.get("confidence"), 0.5))),
                "tags": [str(t) for t in it.get("tags") or []],
                "notes": it.get("notes") or "",
            }
        )
    if not items:
        warnings.append("The AI could not identify any food items. Try a clearer photo or add a description.")

    _reconcile_weights(items, inp, geometry, warnings)

    sources: list[dict] = []
    final_items = []
    scale = servings * eaten
    for it in items:
        for key in ("estimated_weight_g", "weight_low_g", "weight_high_g"):
            it[key] *= scale
        w = it["estimated_weight_g"]
        # Rescale the model's macros to the final (reconciled, serving-adjusted) weight.
        llm_scaled = {k: v * w / it["llm_weight_g"] for k, v in it["llm"].items()}
        hit, item_sources = await _ground_item(db, it)
        sources.extend(item_sources)

        if hit:
            per = hit["per_100g"]
            db_vals = {k: per[k] * w / 100 for k in ("calories", "protein", "carbs", "fat", "fibre")}
            weight_db = 0.7 if hit["confidence"] >= 0.8 else 0.5
            macros = {k: weight_db * db_vals[k] + (1 - weight_db) * llm_scaled[k] for k in db_vals}
            if not llm_scaled["calories"]:
                macros = db_vals
            source = hit["source"]
            confidence = min(1.0, (it["confidence"] + hit["confidence"]) / 2 + 0.05)
        else:
            macros = llm_scaled
            per = {k: (v * 100 / w if w else 0) for k, v in macros.items()}
            source = "AI estimate (not verified)"
            confidence = it["confidence"] * 0.85

        kcal_per_g = macros["calories"] / w if w else 0
        hidden_fat_allowance = 45 if ("fried" in it["tags"] and not inp.get("oil_used")) else 0
        final_items.append(
            {
                "name": it["name"],
                "ingredients": it["ingredients"],
                "cooking_method": it["cooking_method"],
                "estimated_weight_g": round(w),
                "weight_low_g": round(it["weight_low_g"]),
                "weight_high_g": round(it["weight_high_g"]),
                "volume_ml": round(it["volume_ml"] * scale) if it["volume_ml"] else None,
                "calories": round(macros["calories"]),
                "calories_low": round(it["weight_low_g"] * kcal_per_g * 0.95),
                "calories_high": round(it["weight_high_g"] * kcal_per_g * 1.05 + hidden_fat_allowance),
                "protein": round(macros["protein"], 1),
                "carbs": round(macros["carbs"], 1),
                "fat": round(macros["fat"], 1),
                "fibre": round(macros["fibre"], 1),
                "per_100g": {k: round(v, 1) for k, v in per.items()},
                "source": source,
                "confidence": round(confidence, 2),
                "tags": infer_tags(it["name"], it["ingredients"], it["tags"]),
                "notes": it["notes"],
            }
        )
    if scale != 1:
        warnings.append(f"Scaled for {servings:g} serving(s) x {int(eaten * 100)}% eaten.")
    return final_items, sources


def _totals(items: list[dict]) -> dict:
    keys = ("calories", "calories_low", "calories_high", "protein", "carbs", "fat", "fibre")
    totals = {k: round(sum(i[k] for i in items), 1) for k in keys}
    totals["weight_grams"] = round(sum(i["estimated_weight_g"] for i in items))
    return totals


async def _image_ml(db: AsyncSession, jpeg: bytes, ml_only: bool) -> tuple[list[float] | None, dict]:
    """Embedding-based recognition. Waits for models only in ML-only mode (otherwise uses them if ready)."""
    found = {"predictions": [], "similar_meals": []}
    if not (ml_only or runtime.is_ready("vision")):
        return None, found
    image_vec = await runtime.embed_image(jpeg)
    if image_vec is None:
        return None, found
    if ml_only or runtime.is_ready("text"):
        found["predictions"] = await food_recognition.zero_shot(db, image_vec)
    found["similar_meals"] = await food_recognition.similar_meals(db, image_vec)
    return image_vec, found


async def _fail(db: AsyncSession, record: FoodAnalysis, error: str, result_json: dict) -> FoodAnalysis:
    record.status, record.error, record.result_json = "failed", error, result_json
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def analyze(db: AsyncSession, inp: dict, image_bytes: bytes | None, *, ml_only: bool = False,
                  force_ai: bool = False) -> FoodAnalysis:
    warnings: list[str] = []
    ml: dict = {"image_quality": None, "duplicate_of": None, "predictions": [], "similar_meals": [], "calibration": None}
    image_url = image_b64 = photo_hash = image_vec = None
    record = FoodAnalysis(input_json=inp, result_json={}, status="completed", saved=False)

    if image_bytes:
        image_b64, jpeg = prepare_image(image_bytes)
        image_url = save_upload(jpeg, "food", ".jpg")
        ml["image_quality"] = image_features.quality(jpeg)
        if ml["image_quality"]["message"]:
            warnings.append(ml["image_quality"]["message"])
        photo_hash = image_features.phash(jpeg)

        # Same photo analysed before → reuse it (no AI call, identical answer).
        duplicate = None if force_ai else await food_recognition.find_duplicate(db, photo_hash)
        if duplicate is not None:
            previous = duplicate.result_json or {}
            record.image_path, record.phash, record.image_embedding = image_url, photo_hash, duplicate.image_embedding
            ml["duplicate_of"] = duplicate.id
            record.result_json = {
                **previous,
                "method": "duplicate",
                "ml": {**(previous.get("ml") or {}), "image_quality": ml["image_quality"], "duplicate_of": duplicate.id},
                "warnings": [f"Same photo as analysis #{duplicate.id} — reused its result (no AI call)."],
                "providers_used": [],
                "attempts": [],
            }
            db.add(record)
            await db.commit()
            await db.refresh(record)
            return record

        image_vec, found = await _image_ml(db, jpeg, ml_only)
        ml.update(found)

    record.image_path, record.phash, record.image_embedding = image_url, photo_hash, image_vec
    food_text = " ".join(str(inp.get(k) or "") for k in ("description", "ingredients")).strip()
    guess = ml["predictions"][0]["label"] if ml["predictions"] else ""
    geometry = geometric_estimate(
        container_id=inp.get("container_id"),
        container_size_ml=_num(inp.get("container_size_ml"), 0) or None,
        plate_diameter_cm=_num(inp.get("plate_diameter_cm"), 0) or None,
        fill_level=inp.get("fill_level"),
        food_text=food_text or guess,
    )
    if geometry:
        ml["calibration"] = await calibration.factor_for(db, inp.get("container_id"), geometry["food_category"])
        if ml["calibration"]:
            factor = ml["calibration"]["factor"]
            geometry["est_weight_g_from_geometry"] = round(geometry["est_weight_g_from_geometry"] * factor)
            geometry["calibration_factor"] = factor

    # Very strong match with one of YOUR saved meals (and no description to say otherwise) → reuse, no AI.
    best = ml["similar_meals"][0] if ml["similar_meals"] else None
    if (best and not force_ai and not food_text and best["items"]
            and best["similarity"] >= food_recognition.PERSONAL_MATCH_SIMILARITY):
        items = [dict(i) for i in best["items"]]
        known = _num(inp.get("known_weight_g"), 0)
        if known > 0:
            _rescale(items, known / max(1, sum(i["estimated_weight_g"] for i in items)))
        warnings.append(f"Recognised as your usual '{best['name']}' ({round(best['similarity'] * 100)}% match) — "
                        "reused your saved portions. Use 'Analyze with AI anyway' if this is different.")
        return await _store(db, record, items, [], geometry, warnings, ml, "personal_match")

    if not ml_only:
        hints = _ml_hints(ml)
        context = _user_context(inp, geometry) + (f"\n{hints}" if hints else "")
        messages = [ChatMessage("system", SYSTEM_PROMPT), ChatMessage("user", context, images_b64=[image_b64] if image_b64 else None)]
        try:
            result = await router.complete(db, "vision" if image_b64 else "reasoning", messages, json_mode=True, max_tokens=3000)
        except router.AllProvidersFailed as exc:
            warnings.append("No AI provider answered — estimated with on-device ML instead (lower confidence).")
            items = await _ml_only_items(db, inp, geometry, ml, warnings)
            if not items:
                return await _fail(db, record, str(exc), {"attempts": exc.attempts, "geometry": geometry, "ml": _public_ml(ml),
                                                         "method": "ml_only", "warnings": warnings})
            return await _store(db, record, items, [], geometry, warnings, ml, "ml_only")
        raw = result.data or {}
        warnings.extend(str(w) for w in raw.get("warnings") or [])
        items, sources = await _llm_items(db, raw, inp, geometry, warnings)
        return await _store(db, record, items, sources, geometry, warnings, ml, "ai+ml", raw=raw, result=result)

    items = await _ml_only_items(db, inp, geometry, ml, warnings)
    if not items:
        return await _fail(db, record, "On-device ML could not recognise this meal. Add a short description, or allow AI.",
                           {"geometry": geometry, "ml": _public_ml(ml), "method": "ml_only", "warnings": warnings})
    return await _store(db, record, items, [], geometry, warnings, ml, "ml_only")


def _public_ml(ml: dict) -> dict:
    """Drops bulky per-item data from similar meals before storing/returning."""
    return {**ml, "similar_meals": [{k: v for k, v in m.items() if k != "items"} for m in ml["similar_meals"]]}


async def _store(db: AsyncSession, record: FoodAnalysis, items: list[dict], sources: list[dict], geometry: dict | None,
                 warnings: list[str], ml: dict, method: str, *, raw: dict | None = None, result=None) -> FoodAnalysis:
    raw = raw or {}
    record.result_json = {
        "method": method,
        "dish_summary": raw.get("dish_summary") or (", ".join(i["name"] for i in items) if items else None),
        "container_observed": raw.get("container_observed"),
        "items": items,
        "totals": _totals(items),
        "geometry": geometry,
        "portion_reasoning": raw.get("portion_reasoning") or "",
        "hidden_calories": [str(h) for h in raw.get("hidden_calories") or []],
        "warnings": warnings,
        "coach_note": raw.get("coach_note") or "",
        "overall_confidence": round(sum(i["confidence"] for i in items) / len(items), 2) if items else 0,
        "providers_used": [{"task": "vision" if record.image_path else "reasoning", "provider": result.provider,
                            "model": result.model}] if result else [],
        "attempts": result.attempts if result else [],
        "sources": list({s["name"]: s for s in sources}.values()),
        "ml": _public_ml(ml),
    }
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


def serialize(rec: FoodAnalysis) -> dict:
    res = rec.result_json or {}
    return {
        "id": rec.id,
        "created_at": rec.created_at,
        "image_url": rec.image_path,
        "status": rec.status,
        "error": rec.error,
        "input": rec.input_json or {},
        "items": res.get("items", []),
        "totals": res.get("totals", {"calories": 0, "calories_low": 0, "calories_high": 0, "protein": 0, "carbs": 0, "fat": 0, "fibre": 0, "weight_grams": 0}),
        "geometry": res.get("geometry"),
        "dish_summary": res.get("dish_summary"),
        "portion_reasoning": res.get("portion_reasoning", ""),
        "hidden_calories": res.get("hidden_calories", []),
        "warnings": res.get("warnings", []),
        "coach_note": res.get("coach_note", ""),
        "overall_confidence": res.get("overall_confidence", 0),
        "providers_used": res.get("providers_used", []),
        "attempts": res.get("attempts", []),
        "sources": res.get("sources", []),
        "method": res.get("method", "ai+ml"),
        "ml": res.get("ml") or {"image_quality": None, "duplicate_of": None, "predictions": [], "similar_meals": [], "calibration": None},
        "saved": rec.saved,
    }
