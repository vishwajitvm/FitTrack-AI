"""UI-managed settings stored in the `app_settings` table (with .env values as defaults)."""
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt, encrypt, preview
from app.models import AppSetting

INTEGRATIONS = {
    "usda_api_key": {
        "label": "USDA FoodData Central",
        "env": settings.usda_api_key,
        "help_url": "https://fdc.nal.usda.gov/api-key-signup",
    },
    "tavily_api_key": {
        "label": "Tavily web search",
        "env": settings.tavily_api_key,
        "help_url": "https://app.tavily.com",
    },
    "serper_api_key": {
        "label": "Serper (Google search)",
        "env": settings.serper_api_key,
        "help_url": "https://serper.dev",
    },
}

DEFAULT_ROUTING: dict[str, Any] = {
    "tasks": {
        "vision": {"capability": "vision", "pinned": []},
        "reasoning": {"capability": "reasoning", "pinned": []},
        "fast": {"capability": "fast", "pinned": []},
        "medical": {"capability": "reasoning", "pinned": []},
    },
    "ollama_last_resort": True,
    "timeout_seconds": settings.llm_timeout_seconds,
    "max_attempts": settings.llm_max_attempts,
}


async def get_value(db: AsyncSession, key: str, default: Any = None) -> Any:
    row = await db.get(AppSetting, key)
    if row is None:
        return default
    return row.value.get("v", default)


async def set_value(db: AsyncSession, key: str, value: Any) -> None:
    row = await db.get(AppSetting, key)
    if row is None:
        db.add(AppSetting(key=key, value={"v": value}))
    else:
        row.value = {"v": value}
    await db.commit()


async def get_routing(db: AsyncSession) -> dict:
    stored = await get_value(db, "routing", {}) or {}
    merged = {**DEFAULT_ROUTING, **stored}
    merged["tasks"] = {**DEFAULT_ROUTING["tasks"], **(stored.get("tasks") or {})}
    return merged


async def get_ollama_url(db: AsyncSession) -> str:
    return (await get_value(db, "ollama_base_url")) or settings.ollama_base_url


async def get_integration_key(db: AsyncSession, name: str) -> str | None:
    stored = await get_value(db, f"integration:{name}")
    if stored:
        return decrypt(stored)
    return INTEGRATIONS.get(name, {}).get("env") or None


async def set_integration_key(db: AsyncSession, name: str, value: str) -> None:
    await set_value(db, f"integration:{name}", encrypt(value) if value else None)


async def integrations_status(db: AsyncSession) -> dict:
    out = {}
    for name, meta in INTEGRATIONS.items():
        stored = await get_value(db, f"integration:{name}")
        key = decrypt(stored) if stored else (meta["env"] or None)
        out[name] = {
            "label": meta["label"],
            "has_key": bool(key),
            "preview": preview(key),
            "source": "db" if stored else ("env" if meta["env"] else None),
            "help_url": meta["help_url"],
        }
    return out
