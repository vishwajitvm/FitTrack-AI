"""On-device embedding models (ONNX via fastembed), loaded lazily and shared process-wide.

Two models that share one vector space (see docs/ML.md):
  text   – food names, typed meals, zero-shot dish labels
  vision – meal photos

Inference is CPU-bound, so it runs in a worker thread. Every caller must handle `None`
(ML disabled, model still downloading, or failed) and fall back to non-ML behaviour.
"""
import asyncio
import io
import logging
import math
import threading
from dataclasses import dataclass, field

from PIL import Image

from app.core.config import settings

log = logging.getLogger(__name__)

# Nomic Embed uses task prefixes; harmless for other models.
QUERY_PREFIX = "search_query: "
DOCUMENT_PREFIX = "search_document: "


@dataclass
class ModelSlot:
    key: str
    name: str
    model_id: str
    purpose: str
    size_mb: int
    kind: str  # "text" | "image"
    state: str = "not_downloaded"
    error: str | None = None
    model: object | None = None
    lock: threading.Lock = field(default_factory=threading.Lock)


SLOTS: dict[str, ModelSlot] = {
    "text": ModelSlot("text", "Text embeddings", settings.ml_text_model,
                      "Semantic food search, typed-meal parsing, dish names for photo recognition", 130, "text"),
    "vision": ModelSlot("vision", "Image embeddings", settings.ml_vision_model,
                        "Meal photo recognition and your personal meal memory", 100, "image"),
}

_load_listeners: list = []


def on_model_ready(callback) -> None:
    """Register an async callback(key) run after a model finishes loading (e.g. backfills)."""
    _load_listeners.append(callback)


def _load_sync(slot: ModelSlot) -> None:
    from fastembed import ImageEmbedding, TextEmbedding

    cls = TextEmbedding if slot.kind == "text" else ImageEmbedding
    slot.model = cls(model_name=slot.model_id, cache_dir=str(settings.model_dir))


async def ensure_loaded(key: str) -> bool:
    """Load (downloading on first use) the model; returns True when ready."""
    slot = SLOTS[key]
    if not settings.ml_enabled:
        slot.state = "disabled"
        return False
    if slot.state == "ready":
        return True
    if slot.state == "loading":
        while slot.state == "loading":
            await asyncio.sleep(0.5)
        return slot.state == "ready"
    slot.state, slot.error = "loading", None
    try:
        await asyncio.to_thread(_load_sync, slot)
        slot.state = "ready"
        log.info("ML model ready: %s (%s)", slot.key, slot.model_id)
    except Exception as exc:  # noqa: BLE001  (no internet, unsupported platform, …)
        slot.state, slot.error, slot.model = "error", str(exc)[:500], None
        log.warning("ML model %s failed to load: %s", slot.model_id, exc)
        return False
    for callback in _load_listeners:
        try:
            await callback(key)
        except Exception as exc:  # noqa: BLE001
            log.warning("ML post-load hook failed: %s", exc)
    return True


def start_background_load(key: str) -> None:
    if SLOTS[key].state not in ("ready", "loading"):
        asyncio.get_running_loop().create_task(ensure_loaded(key))


def is_ready(key: str) -> bool:
    return SLOTS[key].state == "ready"


def _normalise(vec) -> list[float]:
    values = [float(v) for v in vec]
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


async def embed_texts(texts: list[str], *, document: bool = False) -> list[list[float]] | None:
    """Embeds texts (queries by default). Returns None when the model isn't available."""
    if not texts or not await ensure_loaded("text"):
        return None
    slot = SLOTS["text"]
    prefix = DOCUMENT_PREFIX if document else QUERY_PREFIX

    def run():
        with slot.lock:
            return [_normalise(v) for v in slot.model.embed([prefix + t for t in texts])]

    return await asyncio.to_thread(run)


async def embed_text(text: str, *, document: bool = False) -> list[float] | None:
    vectors = await embed_texts([text], document=document)
    return vectors[0] if vectors else None


async def embed_image(image_bytes: bytes) -> list[float] | None:
    if not await ensure_loaded("vision"):
        return None
    slot = SLOTS["vision"]

    def run():
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        with slot.lock:
            return _normalise(next(iter(slot.model.embed([img]))))

    return await asyncio.to_thread(run)


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def status() -> list[dict]:
    if not settings.ml_enabled:
        for slot in SLOTS.values():
            slot.state = "disabled"
    return [
        {"key": s.key, "name": s.name, "model_id": s.model_id, "purpose": s.purpose, "size_mb": s.size_mb,
         "state": s.state, "error": s.error}
        for s in SLOTS.values()
    ]

