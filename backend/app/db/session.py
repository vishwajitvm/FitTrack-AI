"""Async engine + session factory and the FastAPI `get_db` dependency."""
from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import BACKEND_DIR, settings
from app.db.base import VectorState


def _prepare_sqlite_path(url: str) -> None:
    # sqlite+aiosqlite:///./data/fittrack.db -> make sure ./data exists
    if url.startswith("sqlite") and ":///" in url:
        raw = url.split(":///", 1)[1]
        if raw and raw != ":memory:":
            path = Path(raw)
            if not path.is_absolute():
                path = BACKEND_DIR / path
            path.parent.mkdir(parents=True, exist_ok=True)


_prepare_sqlite_path(settings.database_url)

engine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_pre_ping=not settings.is_sqlite,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def detect_vector_support() -> bool:
    """True when running on PostgreSQL with the pgvector extension installed."""
    if engine.dialect.name != "postgresql":
        VectorState.enabled = False
        return False
    async with engine.connect() as conn:
        row = await conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'"))
        VectorState.enabled = row.first() is not None
    return VectorState.enabled
