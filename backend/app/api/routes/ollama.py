from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models import AIModel
from app.schemas.ai import OllamaConfig, OllamaPull
from app.services import app_settings
from app.services.ollama import manager as ollama

router = APIRouter(prefix="/ollama", tags=["Ollama"])


@router.get("/status")
async def status():
    return await ollama.status(use_cache=False)


@router.put("/config")
async def config(body: OllamaConfig, db: AsyncSession = Depends(get_db)):
    await app_settings.set_value(db, "ollama_base_url", body.base_url.strip() or None)
    await ollama.forget_cached_state()
    return await ollama.status(use_cache=False)


@router.get("/models")
async def models(db: AsyncSession = Depends(get_db)):
    registered = {
        m.model_id for m in (await db.scalars(select(AIModel).where(AIModel.provider_id == "ollama", AIModel.enabled.is_(True)))).all()
    }
    return [{**m, "registered": m["name"] in registered} for m in await ollama.installed_models()]


@router.get("/running")
async def running():
    return await ollama.running_models()


@router.get("/library")
async def library():
    return ollama.LIBRARY


@router.post("/pull")
async def pull(body: OllamaPull):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Model name is required")
    if not (await ollama.status(use_cache=False))["reachable"]:
        raise HTTPException(503, "Ollama is not reachable. Start it (docker compose --profile ollama up -d) or fix the URL.")
    return ollama.start_pull(name)


@router.get("/pulls")
async def pulls():
    return ollama.list_pulls()


@router.delete("/pulls/{job_id}")
async def cancel(job_id: str):
    return {"ok": ollama.cancel_pull(job_id)}


@router.delete("/models")
async def delete(name: str):
    try:
        await ollama.delete_model(name)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Could not delete {name}: {exc}") from exc
    return {"ok": True}
