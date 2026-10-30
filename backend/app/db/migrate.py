"""Runs Alembic migrations programmatically (used at app startup and by `python -m app.db.migrate`)."""
import asyncio
import logging

from alembic import command
from alembic.config import Config

from app.core.config import BACKEND_DIR

log = logging.getLogger(__name__)


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.attributes["configure_logger"] = False  # keep uvicorn's logging setup
    return cfg


def upgrade_to_head() -> None:
    command.upgrade(_alembic_config(), "head")


async def run_migrations() -> None:
    # env.py calls asyncio.run(), so run Alembic in a worker thread with its own event loop.
    log.info("Applying database migrations…")
    await asyncio.to_thread(upgrade_to_head)
    log.info("Database schema is up to date.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    upgrade_to_head()
