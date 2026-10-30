from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.serializers import profile_out
from app.db.session import get_db
from app.schemas.profile import ProfileUpdate
from app.services.tracker import daily
from app.services.tracker.metrics import profile_metrics

router = APIRouter(prefix="/profile", tags=["Profile"])

FIELD_MAP = {"starting_weight_kg": "starting_weight", "current_weight_kg": "current_weight"}


@router.get("")
async def get_profile(db: AsyncSession = Depends(get_db)):
    return profile_out(await daily.get_user(db))


@router.put("")
async def update_profile(body: ProfileUpdate, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(user, FIELD_MAP.get(key, key), value)
    await db.commit()
    await db.refresh(user)
    return profile_out(user)


@router.get("/metrics")
async def get_metrics(db: AsyncSession = Depends(get_db)):
    return await profile_metrics(db, await daily.get_user(db))
