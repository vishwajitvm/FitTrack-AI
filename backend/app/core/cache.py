"""Tiny async cache: Redis when REDIS_URL is set and reachable, in-memory otherwise.

Used for nutrition lookups, provider rate-limit cooldowns and Ollama model lists.
"""
import json
import logging
import time
from typing import Any

from app.core.config import settings

log = logging.getLogger(__name__)


class Cache:
    def __init__(self) -> None:
        self._redis = None
        self._mem: dict[str, tuple[float, str]] = {}
        self.backend = "memory"

    async def connect(self) -> None:
        if not settings.redis_url:
            return
        try:
            import redis.asyncio as aioredis

            client = aioredis.from_url(settings.redis_url, decode_responses=True)
            await client.ping()
            self._redis = client
            self.backend = "redis"
            log.info("Cache: connected to Redis")
        except Exception as exc:  # noqa: BLE001
            log.warning("Cache: Redis unavailable (%s); using in-memory cache", exc)

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()

    async def ping(self) -> bool:
        if self._redis is None:
            return False
        try:
            return bool(await self._redis.ping())
        except Exception:  # noqa: BLE001
            return False

    async def get(self, key: str) -> Any:
        if self._redis is not None:
            try:
                raw = await self._redis.get(key)
                return json.loads(raw) if raw is not None else None
            except Exception:  # noqa: BLE001
                pass
        item = self._mem.get(key)
        if not item:
            return None
        expires, raw = item
        if expires and expires < time.time():
            self._mem.pop(key, None)
            return None
        return json.loads(raw)

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        raw = json.dumps(value, default=str)
        if self._redis is not None:
            try:
                await self._redis.set(key, raw, ex=ttl)
                return
            except Exception:  # noqa: BLE001
                pass
        self._mem[key] = (time.time() + ttl if ttl else 0, raw)

    async def delete(self, key: str) -> None:
        if self._redis is not None:
            try:
                await self._redis.delete(key)
            except Exception:  # noqa: BLE001
                pass
        self._mem.pop(key, None)


cache = Cache()
