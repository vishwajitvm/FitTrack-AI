import asyncio
import logging

from app.db.migrate import upgrade_to_head
from app.db.seed import run_all

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    upgrade_to_head()
    asyncio.run(run_all())
