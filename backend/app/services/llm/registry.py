"""Resolves provider runtime config (keys, URLs) and keeps the DB in sync with the catalog."""
import os
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt, preview
from app.models import AIModel, AIProvider
from app.services import app_settings
from app.services.llm.catalog import PROVIDERS, PROVIDERS_BY_ID


@dataclass
class ProviderRuntime:
    id: str
    name: str
    kind: str
    base_url: str
    api_key: str | None
    enabled: bool
    priority: int
    requires_key: bool
    is_local: bool
    headers: dict = field(default_factory=dict)

    @property
    def usable(self) -> bool:
        if not self.enabled or "{" in self.base_url:
            return False
        return bool(self.api_key) or not self.requires_key


async def sync_catalog(db: AsyncSession) -> None:
    """Align the DB with the catalog.

    Inserts new providers/models without overwriting user edits, and removes providers and
    built-in models that were dropped from the catalog (e.g. a free tier that ended).
    Models the user added or synced themselves (`custom=True`) are kept.
    """
    catalog_models = {(p["id"], mdl["model_id"]) for p in PROVIDERS for mdl in p["models"]}
    for row in (await db.scalars(select(AIProvider))).all():
        if row.id not in PROVIDERS_BY_ID:
            await db.delete(row)  # cascades to its models
    for row in (await db.scalars(select(AIModel).where(AIModel.custom.is_(False)))).all():
        if (row.provider_id, row.model_id) not in catalog_models:
            await db.delete(row)
    await db.flush()

    existing_providers = {p.id for p in (await db.scalars(select(AIProvider))).all()}
    existing_models = {(m.provider_id, m.model_id) for m in (await db.scalars(select(AIModel))).all()}
    for spec in PROVIDERS:
        if spec["id"] not in existing_providers:
            db.add(
                AIProvider(
                    id=spec["id"],
                    enabled=spec.get("default_enabled", True),
                    priority=spec.get("priority", 100),
                    extra={},
                )
            )
    await db.flush()
    for spec in PROVIDERS:
        for index, model in enumerate(spec["models"]):
            if (spec["id"], model["model_id"]) in existing_models:
                continue
            db.add(
                AIModel(
                    provider_id=spec["id"],
                    model_id=model["model_id"],
                    display_name=model["display_name"],
                    capabilities=model["capabilities"],
                    context_window=model["context_window"],
                    free=model["free"],
                    enabled=True,
                    priority=(index + 1) * 10,
                    custom=False,
                )
            )
    await db.commit()


def _env_key(spec: dict) -> str | None:
    env = spec.get("env_key")
    return os.environ.get(env) or None if env else None


def resolve_api_key(spec: dict, row: AIProvider | None) -> tuple[str | None, str | None]:
    """Returns (key, source). Keys saved from the UI win over .env keys."""
    if row is not None and row.api_key_encrypted:
        key = decrypt(row.api_key_encrypted)
        if key:
            return key, "db"
    env = _env_key(spec)
    return (env, "env") if env else (None, None)


def resolve_extra(spec: dict, row: AIProvider | None) -> dict:
    extra = dict(row.extra or {}) if row else {}
    for f in spec.get("extra_fields", []):
        if not extra.get(f["key"]) and f.get("env"):
            env_val = os.environ.get(f["env"])
            if env_val:
                extra[f["key"]] = env_val
    return extra


async def runtime_for(db: AsyncSession, provider_id: str, row: AIProvider | None = None) -> ProviderRuntime:
    spec = PROVIDERS_BY_ID[provider_id]
    if row is None:
        row = await db.get(AIProvider, provider_id)
    key, _ = resolve_api_key(spec, row)
    extra = resolve_extra(spec, row)
    base_url = (row.base_url_override if row and row.base_url_override else spec["base_url"])
    if provider_id == "ollama":
        base_url = await app_settings.get_ollama_url(db)
    for k, v in extra.items():
        base_url = base_url.replace("{" + k + "}", str(v))
    return ProviderRuntime(
        id=provider_id,
        name=spec["name"],
        kind=spec.get("kind", "openai_compatible"),
        base_url=base_url,
        api_key=key,
        enabled=row.enabled if row else spec.get("default_enabled", True),
        priority=row.priority if row else spec.get("priority", 100),
        requires_key=spec.get("requires_key", True),
        is_local=spec.get("is_local", False),
        headers=spec.get("headers", {}),
    )


async def serialize_provider(db: AsyncSession, row: AIProvider, model_counts: dict) -> dict:
    spec = PROVIDERS_BY_ID[row.id]
    key, source = resolve_api_key(spec, row)
    runtime = await runtime_for(db, row.id, row)
    total, enabled = model_counts.get(row.id, (0, 0))
    return {
        "id": row.id,
        "name": spec["name"],
        "kind": spec.get("kind", "openai_compatible"),
        "base_url": runtime.base_url,
        "default_base_url": spec["base_url"],
        "website": spec.get("website"),
        "key_url": spec.get("key_url"),
        "env_key": spec.get("env_key"),
        "free_tier": spec.get("free_tier", False),
        "free_tier_note": spec.get("free_tier_note"),
        "requires_key": spec.get("requires_key", True),
        "has_key": bool(key),
        "key_preview": preview(key),
        "key_source": source,
        "extra_fields": [{"key": f["key"], "label": f["label"]} for f in spec.get("extra_fields", [])],
        "extra": resolve_extra(spec, row),
        "enabled": row.enabled,
        "priority": row.priority,
        "is_local": spec.get("is_local", False),
        "usable": runtime.usable,
        "last_status": row.last_status,
        "last_error": row.last_error,
        "last_checked_at": row.last_checked_at,
        "models_count": total,
        "enabled_models_count": enabled,
    }


def serialize_model(row: AIModel) -> dict:
    return {
        "id": row.id,
        "provider_id": row.provider_id,
        "model_id": row.model_id,
        "display_name": row.display_name,
        "capabilities": row.capabilities or [],
        "context_window": row.context_window,
        "free": row.free,
        "enabled": row.enabled,
        "priority": row.priority,
        "custom": row.custom,
    }
