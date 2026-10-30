"""Ollama management: status, installed/running models, background pulls with progress, deletes."""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from app.core.cache import cache
from app.db.session import SessionLocal
from app.models import AIModel
from app.services import app_settings
from app.services.llm.catalog import guess_capabilities

log = logging.getLogger(__name__)

LIBRARY = [
    {"name": "llama3.2:3b", "description": "Meta Llama 3.2 3B — small, quick general model", "size_human": "2.0 GB", "capabilities": ["chat", "fast"], "recommended_for": "Coach advice & quick text tasks on CPU"},
    {"name": "llama3.2:1b", "description": "Llama 3.2 1B — tiny, runs anywhere", "size_human": "1.3 GB", "capabilities": ["chat", "fast"], "recommended_for": "Very low-RAM machines"},
    {"name": "gemma3:4b", "description": "Google Gemma 3 4B — multimodal (reads food photos)", "size_human": "3.3 GB", "capabilities": ["chat", "vision", "fast"], "recommended_for": "Best small local vision model for meal photos"},
    {"name": "gemma3:12b", "description": "Gemma 3 12B — stronger multimodal", "size_human": "8.1 GB", "capabilities": ["chat", "vision", "reasoning"], "recommended_for": "Meal photos with a GPU / 16 GB+ RAM"},
    {"name": "llama3.2-vision:11b", "description": "Llama 3.2 Vision 11B", "size_human": "7.8 GB", "capabilities": ["chat", "vision"], "recommended_for": "Food photo analysis"},
    {"name": "qwen2.5vl:7b", "description": "Qwen2.5-VL 7B — strong OCR & vision", "size_human": "6.0 GB", "capabilities": ["chat", "vision"], "recommended_for": "Lab report images and meal photos"},
    {"name": "llava:7b", "description": "LLaVA 7B — classic vision model", "size_human": "4.7 GB", "capabilities": ["chat", "vision"], "recommended_for": "Basic photo descriptions"},
    {"name": "moondream", "description": "Moondream 2 — tiny vision model", "size_human": "1.7 GB", "capabilities": ["chat", "vision", "fast"], "recommended_for": "Low-RAM vision fallback"},
    {"name": "qwen2.5:7b", "description": "Qwen2.5 7B — good structured JSON output", "size_human": "4.7 GB", "capabilities": ["chat", "reasoning"], "recommended_for": "Nutrition reasoning & report parsing"},
    {"name": "qwen3:8b", "description": "Qwen3 8B — hybrid thinking model", "size_human": "5.2 GB", "capabilities": ["chat", "reasoning"], "recommended_for": "Deeper coach analysis"},
    {"name": "deepseek-r1:7b", "description": "DeepSeek R1 distill 7B — reasoning", "size_human": "4.7 GB", "capabilities": ["chat", "reasoning"], "recommended_for": "Step-by-step analysis (slower)"},
    {"name": "mistral:7b", "description": "Mistral 7B Instruct", "size_human": "4.1 GB", "capabilities": ["chat"], "recommended_for": "General text"},
    {"name": "phi4-mini", "description": "Microsoft Phi-4 mini 3.8B", "size_human": "2.5 GB", "capabilities": ["chat", "fast"], "recommended_for": "Fast text on CPU"},
    {"name": "gpt-oss:20b", "description": "OpenAI GPT-OSS 20B open-weight", "size_human": "14 GB", "capabilities": ["chat", "reasoning"], "recommended_for": "High-quality local reasoning (GPU)"},
    {"name": "nomic-embed-text", "description": "Text embeddings (not a chat model)", "size_human": "274 MB", "capabilities": ["embedding"], "recommended_for": "Future semantic search"},
]

_jobs: dict[str, dict] = {}
_tasks: dict[str, asyncio.Task] = {}


def human_size(num: float | None) -> str:
    if not num:
        return "–"
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if num < 1024:
            return f"{num:.1f} {unit}"
        num /= 1024
    return f"{num:.1f} PB"


async def base_url() -> str:
    async with SessionLocal() as db:
        return await app_settings.get_ollama_url(db)


# Short connect timeout: an Ollama that is not running should not slow down the dashboard.
PROBE_TIMEOUT = httpx.Timeout(4.0, connect=1.5)
STATUS_TTL_SECONDS = 10
UNREACHABLE_TTL_SECONDS = 30  # re-check a stopped Ollama less often


async def status(use_cache: bool = True) -> dict:
    if use_cache and (cached := await cache.get("ollama:status")) is not None:
        return cached
    url = await base_url()
    try:
        async with httpx.AsyncClient(timeout=PROBE_TIMEOUT) as client:
            resp = await client.get(f"{url.rstrip('/')}/api/version")
            resp.raise_for_status()
            result = {"reachable": True, "base_url": url, "version": resp.json().get("version"), "error": None}
    except Exception as exc:  # noqa: BLE001
        result = {"reachable": False, "base_url": url, "version": None, "error": str(exc) or exc.__class__.__name__}
    await cache.set("ollama:status", result, ttl=STATUS_TTL_SECONDS if result["reachable"] else UNREACHABLE_TTL_SECONDS)
    return result


async def forget_cached_state() -> None:
    """Call after the Ollama URL changes or models are added/removed."""
    for key in ("ollama:status", "ollama:tags"):
        await cache.delete(key)


async def installed_models(use_cache: bool = False) -> list[dict]:
    if use_cache and (cached := await cache.get("ollama:tags")) is not None:
        return cached
    url = await base_url()
    try:
        async with httpx.AsyncClient(timeout=PROBE_TIMEOUT) as client:
            resp = await client.get(f"{url.rstrip('/')}/api/tags")
            resp.raise_for_status()
            models = resp.json().get("models", [])
    except Exception:  # noqa: BLE001
        await cache.set("ollama:tags", [], ttl=UNREACHABLE_TTL_SECONDS)
        return []
    out = [
        {
            "name": mdl.get("name"),
            "size": mdl.get("size"),
            "size_human": human_size(mdl.get("size")),
            "modified_at": mdl.get("modified_at"),
            "family": (mdl.get("details") or {}).get("family"),
            "families": (mdl.get("details") or {}).get("families") or [],
            "parameter_size": (mdl.get("details") or {}).get("parameter_size"),
            "quantization": (mdl.get("details") or {}).get("quantization_level"),
        }
        for mdl in models
    ]
    await cache.set("ollama:tags", out, ttl=30)
    return out


async def running_models() -> list[dict]:
    url = await base_url()
    try:
        async with httpx.AsyncClient(timeout=PROBE_TIMEOUT) as client:
            resp = await client.get(f"{url.rstrip('/')}/api/ps")
            resp.raise_for_status()
            return [
                {"name": mdl.get("name"), "size_human": human_size(mdl.get("size")), "expires_at": mdl.get("expires_at")}
                for mdl in resp.json().get("models", [])
            ]
    except Exception:  # noqa: BLE001
        return []


def ollama_capabilities(name: str, families: list[str] | None = None) -> list[str]:
    caps = guess_capabilities(name)
    if families and any(f in ("clip", "mllama") for f in families) and "vision" not in caps:
        caps.append("vision")
    if "embed" in name:
        return ["embedding"]
    return caps


async def register_model(name: str, families: list[str] | None = None) -> None:
    """Make an installed Ollama model available to the router."""
    async with SessionLocal() as db:
        exists = await db.scalar(select(AIModel).where(AIModel.provider_id == "ollama", AIModel.model_id == name))
        if exists:
            exists.enabled = True
        else:
            db.add(
                AIModel(
                    provider_id="ollama",
                    model_id=name,
                    display_name=name,
                    capabilities=ollama_capabilities(name, families),
                    free=True,
                    enabled=True,
                    priority=50,
                    custom=True,
                )
            )
        await db.commit()


async def _run_pull(job_id: str) -> None:
    job = _jobs[job_id]
    url = await base_url()
    job["status"] = "pulling"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10)) as client:
            async with client.stream("POST", f"{url.rstrip('/')}/api/pull", json={"model": job["name"], "stream": True}) as resp:
                if resp.status_code >= 400:
                    raise RuntimeError((await resp.aread()).decode()[:300])
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    event = json.loads(line)
                    if event.get("error"):
                        raise RuntimeError(event["error"])
                    job["detail"] = event.get("status", "")
                    if event.get("total"):
                        job["total"] = event["total"]
                        job["completed"] = event.get("completed", 0)
                        job["percent"] = round(100 * job["completed"] / job["total"], 1)
                    if event.get("status") == "success":
                        job["percent"] = 100.0
        job["status"] = "completed"
        await cache.delete("ollama:tags")
        families = next((m["families"] for m in await installed_models() if m["name"] == job["name"]), None)
        await register_model(job["name"], families)
    except asyncio.CancelledError:
        job["status"] = "cancelled"
        raise
    except Exception as exc:  # noqa: BLE001
        log.warning("Ollama pull %s failed: %s", job["name"], exc)
        job["status"] = "failed"
        job["error"] = str(exc)
    finally:
        job["finished_at"] = datetime.now(timezone.utc).isoformat()
        _tasks.pop(job_id, None)


def start_pull(name: str) -> dict:
    for job in _jobs.values():
        if job["name"] == name and job["status"] in ("queued", "pulling"):
            return job
    job_id = uuid.uuid4().hex[:12]
    _jobs[job_id] = {
        "job_id": job_id,
        "name": name,
        "status": "queued",
        "detail": "",
        "completed": 0,
        "total": 0,
        "percent": 0.0,
        "error": None,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
    }
    _tasks[job_id] = asyncio.create_task(_run_pull(job_id))
    return _jobs[job_id]


def list_pulls() -> list[dict]:
    return sorted(_jobs.values(), key=lambda j: j["started_at"], reverse=True)


def cancel_pull(job_id: str) -> bool:
    task = _tasks.get(job_id)
    if task:
        task.cancel()
        return True
    return False


async def delete_model(name: str) -> None:
    url = await base_url()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request("DELETE", f"{url.rstrip('/')}/api/delete", json={"model": name})
        if resp.status_code >= 400:
            raise RuntimeError(resp.text[:300])
    await cache.delete("ollama:tags")
    async with SessionLocal() as db:
        row = await db.scalar(select(AIModel).where(AIModel.provider_id == "ollama", AIModel.model_id == name))
        if row is not None:
            row.enabled = False
            await db.commit()
