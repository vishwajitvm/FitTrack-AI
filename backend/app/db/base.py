"""Declarative base, shared column helpers and portable column types."""
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, MetaData
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

# Stable constraint names keep Alembic migrations deterministic.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

EMBEDDING_DIM = 256  # character-trigram vectors (lexical search)
SEMANTIC_DIM = 768  # Nomic Embed text/vision vectors (semantic search, meal photos)

# JSONB on PostgreSQL, plain JSON on SQLite.
JSONType = JSON().with_variant(JSONB(), "postgresql")


class VectorState:
    """Set at startup once we know whether the pgvector extension is installed."""

    enabled = False


class EmbeddingType(TypeDecorator):
    """pgvector `vector(dim)` on PostgreSQL with pgvector, JSON list everywhere else."""

    impl = JSON
    cache_ok = True

    def __init__(self, dim: int = EMBEDDING_DIM):
        super().__init__()
        self.dim = dim

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql" and VectorState.enabled:
            from pgvector.sqlalchemy import Vector

            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(JSONType)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return [float(v) for v in value]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
