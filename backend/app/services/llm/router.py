"""Multi-provider LLM router with automatic fallback.

Order of attempts for a task:
  1. models pinned for the task in Routing settings
  2. cloud providers by priority (enabled + key present), best-matching models first —
     up to two models per provider in the first pass, the rest afterwards
  3. Ollama (local) — always LAST, only if enabled and reachable

A model that returns HTTP 429 is put on cooldown; a provider that rejects the key (401/403)
is skipped for the rest of the request. Every attempt is written to `llm_call_logs`.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache
from app.core.config import settings
from app.db.session import SessionLocal
from app.models import AIModel, AIProvider, LLMCallLog
from app.services import app_settings
from app.services.llm.client import ChatMessage, LLMError, ollama_chat, openai_chat
from app.services.llm.json_utils import extract_json, strip_think
from app.services.llm.registry import ProviderRuntime, runtime_for
from app.services.ollama import manager as ollama

log = logging.getLogger(__name__)

TASKS = ("vision", "reasoning", "fast", "medical")
OLLAMA_MAX_MODELS = 2
FIRST_PASS_PER_PROVIDER = 2


class AllProvidersFailed(Exception):
    def __init__(self, attempts: list[dict]):
        self.attempts = attempts
        summary = "; ".join(f"{a['provider']}/{a['model']}: {a['status']}" for a in attempts[-5:]) or "no providers configured"
        super().__init__(
            "All AI providers failed or none are configured. Add an API key in AI Providers "
            f"or install an Ollama model. Last attempts: {summary}"
        )


@dataclass
class Candidate:
    provider: ProviderRuntime
    model_id: str
    display_name: str


@dataclass
class RouterResult:
    text: str
    provider: str
    model: str
    attempts: list[dict] = field(default_factory=list)
    data: dict | None = None


def _sort_key(model: AIModel, preferred: str) -> tuple:
    return (preferred not in (model.capabilities or []), model.priority, model.id)


async def build_chain(db: AsyncSession, task: str, needs_vision: bool = False) -> list[Candidate]:
    routing = await app_settings.get_routing(db)
    task_cfg = routing["tasks"].get(task, {"capability": "chat", "pinned": []})
    preferred = task_cfg.get("capability", "chat")
    required = "vision" if needs_vision or task == "vision" else "chat"
    max_attempts = int(routing.get("max_attempts") or settings.llm_max_attempts)

    provider_rows = {p.id: p for p in (await db.scalars(select(AIProvider))).all()}
    models = (await db.scalars(select(AIModel).where(AIModel.enabled.is_(True)))).all()
    by_provider: dict[str, list[AIModel]] = {}
    for mdl in models:
        if required in (mdl.capabilities or []):
            by_provider.setdefault(mdl.provider_id, []).append(mdl)

    runtimes: dict[str, ProviderRuntime] = {}
    for pid, row in provider_rows.items():
        try:
            runtimes[pid] = await runtime_for(db, pid, row)
        except KeyError:  # provider removed from catalog
            continue

    chain: list[Candidate] = []
    seen: set[tuple[str, str]] = set()

    def push(rt: ProviderRuntime, mdl: AIModel) -> None:
        key = (rt.id, mdl.model_id)
        if key not in seen:
            seen.add(key)
            chain.append(Candidate(rt, mdl.model_id, mdl.display_name))

    # 1. pinned
    for pin in task_cfg.get("pinned", []):
        rt = runtimes.get(pin.get("provider_id"))
        mdl = next((m for m in by_provider.get(pin.get("provider_id"), []) if m.model_id == pin.get("model_id")), None)
        if rt and mdl and rt.usable and rt.kind != "ollama":
            push(rt, mdl)

    # 2. cloud providers by priority, breadth-first
    cloud = sorted(
        (rt for rt in runtimes.values() if rt.usable and rt.kind != "ollama"),
        key=lambda r: (r.priority, r.id),
    )
    ranked = {rt.id: sorted(by_provider.get(rt.id, []), key=lambda m: _sort_key(m, preferred)) for rt in cloud}
    for rt in cloud:
        for mdl in ranked[rt.id][:FIRST_PASS_PER_PROVIDER]:
            push(rt, mdl)
    for rt in cloud:
        for mdl in ranked[rt.id][FIRST_PASS_PER_PROVIDER:]:
            push(rt, mdl)
    chain = chain[:max_attempts]

    # 3. Ollama last resort
    ollama_rt = runtimes.get("ollama")
    if routing.get("ollama_last_resort", True) and ollama_rt and ollama_rt.enabled:
        installed = {m["name"]: m for m in await ollama.installed_models(use_cache=True)}
        candidates = [m for m in ranked_ollama(by_provider.get("ollama", []), preferred) if m.model_id in installed]
        if not candidates:
            # Installed but not registered yet: infer capabilities from the name.
            for name, info in installed.items():
                caps = ollama.ollama_capabilities(name, info.get("families"))
                if required in caps:
                    candidates.append(AIModel(provider_id="ollama", model_id=name, display_name=name, capabilities=caps, priority=50, id=0))
        for mdl in candidates[:OLLAMA_MAX_MODELS]:
            push(ollama_rt, mdl)
    return chain


def ranked_ollama(models: list[AIModel], preferred: str) -> list[AIModel]:
    return sorted(models, key=lambda m: _sort_key(m, preferred))


async def _record(task: str, cand: Candidate, status: str, latency: float | None, error: str | None) -> None:
    async with SessionLocal() as db:
        db.add(
            LLMCallLog(
                task=task,
                provider_id=cand.provider.id,
                model_id=cand.model_id,
                status=status,
                latency_ms=latency,
                error=(error or "")[:2000] or None,
            )
        )
        row = await db.get(AIProvider, cand.provider.id)
        if row is not None:
            row.last_status = "ok" if status == "success" else status
            row.last_error = None if status == "success" else (error or "")[:1000]
            row.last_checked_at = datetime.now(timezone.utc)
        await db.commit()


async def call_candidate(cand: Candidate, messages: list[ChatMessage], *, json_mode: bool, max_tokens: int, timeout: float):
    if cand.provider.kind == "ollama":
        return await ollama_chat(
            base_url=cand.provider.base_url, model=cand.model_id, messages=messages, timeout=timeout, json_mode=json_mode
        )
    return await openai_chat(
        base_url=cand.provider.base_url,
        api_key=cand.provider.api_key,
        model=cand.model_id,
        messages=messages,
        timeout=timeout,
        max_tokens=max_tokens,
        headers=cand.provider.headers,
    )


async def complete(
    db: AsyncSession,
    task: str,
    messages: list[ChatMessage],
    *,
    json_mode: bool = False,
    max_tokens: int = 2048,
    timeout: float | None = None,
) -> RouterResult:
    """Run `messages` through the fallback chain until one model succeeds.

    `timeout` caps the per-model timeout from Routing settings (for interactive calls that should move on sooner)."""
    needs_vision = any(m.images_b64 for m in messages)
    routing = await app_settings.get_routing(db)
    configured = float(routing.get("timeout_seconds") or settings.llm_timeout_seconds)
    timeout = min(configured, timeout) if timeout else configured
    chain = await build_chain(db, task, needs_vision=needs_vision)
    attempts: list[dict] = []
    dead_providers: set[str] = set()

    for cand in chain:
        label = {"provider": cand.provider.id, "model": cand.model_id}
        if cand.provider.id in dead_providers:
            continue
        cooldown_key = f"cooldown:{cand.provider.id}:{cand.model_id}"
        if await cache.get(cooldown_key):
            attempts.append({**label, "status": "skipped", "error": "rate-limit cooldown", "latency_ms": None})
            continue
        try:
            result = await call_candidate(cand, messages, json_mode=json_mode, max_tokens=max_tokens, timeout=timeout)
            data = extract_json(result.text) if json_mode else None
        except LLMError as exc:
            attempts.append({**label, "status": exc.kind, "error": str(exc)[:300], "latency_ms": None})
            await _record(task, cand, exc.kind, None, str(exc))
            if exc.kind == "rate_limited":
                await cache.set(cooldown_key, True, ttl=int(exc.retry_after or settings.llm_rate_limit_cooldown_seconds))
            elif exc.kind == "auth":
                dead_providers.add(cand.provider.id)
            continue
        except ValueError as exc:  # model answered but not with valid JSON
            attempts.append({**label, "status": "error", "error": f"invalid JSON: {exc}", "latency_ms": None})
            await _record(task, cand, "error", None, f"invalid JSON output: {exc}")
            continue

        attempts.append({**label, "status": "success", "error": None, "latency_ms": round(result.latency_ms)})
        await _record(task, cand, "success", result.latency_ms, None)
        return RouterResult(
            text=strip_think(result.text), provider=cand.provider.id, model=cand.model_id, attempts=attempts, data=data
        )

    raise AllProvidersFailed(attempts)


async def has_any_provider(db: AsyncSession, needs_vision: bool = False) -> bool:
    return bool(await build_chain(db, "vision" if needs_vision else "fast", needs_vision=needs_vision))
