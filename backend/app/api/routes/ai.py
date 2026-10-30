"""AI providers, API keys, models, routing, playground and call logs — all managed from the UI."""
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import encrypt
from app.db.session import get_db
from app.models import AIModel, AIProvider, LLMCallLog
from app.schemas.ai import ModelCreate, ModelUpdate, PlaygroundRequest, ProviderReorder, ProviderUpdate, Routing
from app.services import app_settings
from app.services.llm import router as llm_router
from app.services.llm.catalog import PROVIDERS_BY_ID, guess_capabilities, is_free_model_id
from app.services.llm.client import ChatMessage, LLMError
from app.services.llm.registry import runtime_for, serialize_model, serialize_provider
from app.services.ollama import manager as ollama

router = APIRouter(prefix="/ai", tags=["AI providers"])


async def _model_counts(db: AsyncSession) -> dict:
    counts: dict[str, tuple[int, int]] = {}
    for pid, enabled in await db.execute(select(AIModel.provider_id, AIModel.enabled)):
        total, on = counts.get(pid, (0, 0))
        counts[pid] = (total + 1, on + (1 if enabled else 0))
    return counts


async def _provider_or_404(db: AsyncSession, provider_id: str) -> AIProvider:
    row = await db.get(AIProvider, provider_id)
    if row is None or provider_id not in PROVIDERS_BY_ID:
        raise HTTPException(404, "Unknown provider")
    return row


@router.get("/providers")
async def list_providers(db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(AIProvider).order_by(AIProvider.priority, AIProvider.id))).all()
    counts = await _model_counts(db)
    return [await serialize_provider(db, r, counts) for r in rows if r.id in PROVIDERS_BY_ID]


@router.put("/providers/reorder")
async def reorder_providers(body: ProviderReorder, db: AsyncSession = Depends(get_db)):
    for index, pid in enumerate(body.order):
        row = await db.get(AIProvider, pid)
        if row is not None and pid != "ollama":  # Ollama always stays last
            row.priority = (index + 1) * 10
    await db.commit()
    return await list_providers(db)


@router.put("/providers/{provider_id}")
async def update_provider(provider_id: str, body: ProviderUpdate, db: AsyncSession = Depends(get_db)):
    row = await _provider_or_404(db, provider_id)
    if body.enabled is not None:
        row.enabled = body.enabled
    if body.priority is not None:
        row.priority = body.priority
    if body.base_url is not None:
        if provider_id == "ollama":
            await app_settings.set_value(db, "ollama_base_url", body.base_url or None)
            await ollama.forget_cached_state()
        else:
            row.base_url_override = body.base_url or None
    if body.api_key is not None:
        row.api_key_encrypted = encrypt(body.api_key.strip()) if body.api_key.strip() else None
        row.last_status, row.last_error = None, None
    if body.extra is not None:
        row.extra = {**(row.extra or {}), **body.extra}
    await db.commit()
    return await serialize_provider(db, row, await _model_counts(db))


@router.post("/providers/{provider_id}/test")
async def test_provider(provider_id: str, db: AsyncSession = Depends(get_db)):
    row = await _provider_or_404(db, provider_id)
    rt = await runtime_for(db, provider_id, row)
    if not rt.usable:
        return {"ok": False, "latency_ms": None, "model": None, "message": "Provider disabled, missing API key or missing required field."}
    models = (await db.scalars(
        select(AIModel).where(AIModel.provider_id == provider_id, AIModel.enabled.is_(True)).order_by(AIModel.priority)
    )).all()
    if provider_id == "ollama":
        installed = {m["name"] for m in await ollama.installed_models()}
        models = [m for m in models if m.model_id in installed]
    models.sort(key=lambda m: "fast" not in (m.capabilities or []))
    if not models:
        return {"ok": False, "latency_ms": None, "model": None, "message": "No enabled (or installed) models for this provider."}
    cand = llm_router.Candidate(rt, models[0].model_id, models[0].display_name)
    try:
        res = await llm_router.call_candidate(
            cand, [ChatMessage("user", "Reply with the single word: OK")], json_mode=False, max_tokens=8, timeout=30
        )
    except LLMError as exc:
        row.last_status, row.last_error, row.last_checked_at = exc.kind, str(exc)[:1000], datetime.now(timezone.utc)
        await db.commit()
        return {"ok": False, "latency_ms": None, "model": cand.model_id, "message": str(exc)[:500]}
    row.last_status, row.last_error, row.last_checked_at = "ok", None, datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "latency_ms": round(res.latency_ms), "model": cand.model_id, "message": res.text.strip()[:200]}


@router.post("/providers/{provider_id}/sync-models")
async def sync_models(provider_id: str, db: AsyncSession = Depends(get_db)):
    row = await _provider_or_404(db, provider_id)
    rt = await runtime_for(db, provider_id, row)
    if provider_id == "ollama":
        names = [(m["name"], m.get("families")) for m in await ollama.installed_models()]
    else:
        if not rt.usable:
            raise HTTPException(400, "Add an API key (and required fields) before syncing models.")
        headers = {**rt.headers, **({"Authorization": f"Bearer {rt.api_key}"} if rt.api_key else {})}
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(rt.base_url.rstrip("/") + "/models", headers=headers)
                resp.raise_for_status()
                payload = resp.json()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(502, f"Could not list models: {exc}") from exc
        items = payload.get("data", payload if isinstance(payload, list) else [])
        names = [(str(m.get("id") or m.get("name")), None) for m in items if isinstance(m, dict) and (m.get("id") or m.get("name"))]
        names = [(n, f) for n, f in names if is_free_model_id(provider_id, n)]  # free-only policy

    existing = {m.model_id for m in (await db.scalars(select(AIModel).where(AIModel.provider_id == provider_id))).all()}
    added = 0
    for name, families in names:
        if name in existing:
            continue
        caps = ollama.ollama_capabilities(name, families) if provider_id == "ollama" else guess_capabilities(name)
        db.add(AIModel(
            provider_id=provider_id, model_id=name, display_name=name, capabilities=caps,
            free=True,
            # Synced cloud models start disabled so the routing chain stays curated.
            enabled=provider_id == "ollama", priority=500, custom=True,
        ))
        added += 1
    await db.commit()
    return {"added": added, "total": len(existing) + added}


@router.get("/models")
async def list_models(provider: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(AIModel).order_by(AIModel.provider_id, AIModel.priority, AIModel.id)
    if provider:
        query = query.where(AIModel.provider_id == provider)
    return [serialize_model(m) for m in (await db.scalars(query)).all()]


@router.post("/models")
async def add_model(body: ModelCreate, db: AsyncSession = Depends(get_db)):
    await _provider_or_404(db, body.provider_id)
    exists = await db.scalar(select(AIModel).where(AIModel.provider_id == body.provider_id, AIModel.model_id == body.model_id))
    if exists:
        raise HTTPException(409, "Model already exists for this provider")
    row = AIModel(
        provider_id=body.provider_id, model_id=body.model_id, display_name=body.display_name or body.model_id,
        capabilities=list(body.capabilities), context_window=body.context_window, free=False, enabled=True, priority=50, custom=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return serialize_model(row)


@router.put("/models/{model_pk}")
async def update_model(model_pk: int, body: ModelUpdate, db: AsyncSession = Depends(get_db)):
    row = await db.get(AIModel, model_pk)
    if row is None:
        raise HTTPException(404, "Model not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, list(value) if key == "capabilities" else value)
    await db.commit()
    return serialize_model(row)


@router.delete("/models/{model_pk}")
async def delete_model(model_pk: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(AIModel, model_pk)
    if row is None:
        raise HTTPException(404, "Model not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


@router.get("/routing")
async def get_routing(db: AsyncSession = Depends(get_db)):
    return await app_settings.get_routing(db)


@router.put("/routing")
async def put_routing(body: Routing, db: AsyncSession = Depends(get_db)):
    await app_settings.set_value(db, "routing", body.model_dump())
    return await app_settings.get_routing(db)


@router.get("/routing/preview")
async def routing_preview(task: str = "reasoning", db: AsyncSession = Depends(get_db)):
    if task not in llm_router.TASKS:
        raise HTTPException(400, f"task must be one of {llm_router.TASKS}")
    chain = await llm_router.build_chain(db, task, needs_vision=task == "vision")
    return [
        {"provider_id": c.provider.id, "provider_name": c.provider.name, "model_id": c.model_id, "display_name": c.display_name}
        for c in chain
    ]


@router.post("/playground")
async def playground(body: PlaygroundRequest, db: AsyncSession = Depends(get_db)):
    try:
        res = await llm_router.complete(db, body.task, [ChatMessage("user", body.prompt)], max_tokens=1024)
    except llm_router.AllProvidersFailed as exc:
        raise HTTPException(503, {"message": str(exc), "attempts": exc.attempts}) from exc
    return {"text": res.text, "provider": res.provider, "model": res.model, "attempts": res.attempts}


@router.get("/logs")
async def call_logs(limit: int = 100, db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(LLMCallLog).order_by(LLMCallLog.id.desc()).limit(min(limit, 500)))).all()
    return [
        {"id": r.id, "created_at": r.created_at, "task": r.task, "provider_id": r.provider_id, "model_id": r.model_id,
         "status": r.status, "latency_ms": r.latency_ms, "error": r.error}
        for r in rows
    ]


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db)):
    providers = (await db.scalars(select(AIProvider))).all()
    configured = 0
    for p in providers:
        if p.id in PROVIDERS_BY_ID and p.id != "ollama" and (await runtime_for(db, p.id, p)).usable:
            configured += 1
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    logs = (await db.scalars(select(LLMCallLog.status).where(LLMCallLog.created_at >= since))).all()
    return {
        "providers_total": len([p for p in providers if p.id in PROVIDERS_BY_ID]),
        "providers_configured": configured,
        "models_total": await db.scalar(select(func.count()).select_from(AIModel)),
        "models_enabled": await db.scalar(select(func.count()).select_from(AIModel).where(AIModel.enabled.is_(True))),
        "calls_24h": len(logs),
        "success_rate_24h": round(sum(1 for s in logs if s == "success") / len(logs), 2) if logs else None,
    }
