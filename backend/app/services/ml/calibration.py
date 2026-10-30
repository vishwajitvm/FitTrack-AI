"""Personal portion calibration: learns how your real portions differ from geometric estimates.

For each (container, food category) we keep a running mean of log(corrected ÷ estimated)
weight. The applied factor uses Bayesian shrinkage toward 1.0: exp(mean · n / (n + K)),
so one correction nudges the estimate and many corrections converge on your habit.
"""
import math

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PortionCalibration

SHRINKAGE_K = 3
MIN_RATIO, MAX_RATIO = 0.3, 3.0  # ignore implausible corrections (typos, wrong container)


async def factor_for(db: AsyncSession, container_id: str | None, category: str | None) -> dict | None:
    if not container_id or not category:
        return None
    row = await db.scalar(
        select(PortionCalibration).where(
            PortionCalibration.container_id == container_id, PortionCalibration.food_category == category
        )
    )
    if row is None or row.samples == 0:
        return None
    shrunk = row.mean_log_ratio * row.samples / (row.samples + SHRINKAGE_K)
    return {"container_id": container_id, "food_category": category, "factor": round(math.exp(shrunk), 3), "samples": row.samples}


async def learn(db: AsyncSession, container_id: str | None, category: str | None, estimated_g: float, corrected_g: float) -> None:
    if not container_id or not category or estimated_g <= 0 or corrected_g <= 0:
        return
    ratio = corrected_g / estimated_g
    if not MIN_RATIO <= ratio <= MAX_RATIO or abs(ratio - 1) < 0.02:
        return
    row = await db.scalar(
        select(PortionCalibration).where(
            PortionCalibration.container_id == container_id, PortionCalibration.food_category == category
        )
    )
    if row is None:
        row = PortionCalibration(container_id=container_id, food_category=category, samples=0, mean_log_ratio=0.0)
        db.add(row)
    row.samples += 1
    row.mean_log_ratio += (math.log(ratio) - row.mean_log_ratio) / row.samples  # running mean
