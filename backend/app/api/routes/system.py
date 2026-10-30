"""Health check, dashboard, settings and data import/export."""
import json
import logging
import re
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache
from app.core.config import settings
from app.db.base import VectorState
from app.db.session import get_db
from app.schemas.ai import SettingsUpdate
from app.services import app_settings
from app.services.coach import brief
from app.services.data import backup, exporter, importer
from app.services.llm.router import build_chain
from app.services.ollama import manager as ollama
from app.services.tracker import daily
from app.services.tracker.metrics import profile_metrics
from app.services.training.autoregulation import recommend

router = APIRouter(tags=["System"])
log = logging.getLogger(__name__)


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001
        db_status = f"error: {exc}"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "db_engine": db.bind.dialect.name if db.bind else None,
        "pgvector": VectorState.enabled,
        "redis": "ok" if await cache.ping() else ("not configured" if not settings.redis_url else "unreachable (using memory cache)"),
        "version": settings.app_version,
    }


@router.get("/brief")
async def daily_brief(day: date | None = Query(None, alias="date"), refresh: bool = False, db: AsyncSession = Depends(get_db)):
    """The dashboard's "your day so far" note. Stored per day and only rewritten when that day's logs change."""
    return await brief.get_brief(db, day, force=refresh)


@router.get("/dashboard")
async def dashboard(days: int = 7, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    today = daily.today_for(user)
    week = await daily.compute_range(db, user, today - timedelta(days=max(1, min(days, 90)) - 1), today)
    trend_days = await daily.compute_range(db, user, max(user.start_date, today - timedelta(days=29)), today)
    chain = await build_chain(db, "reasoning")
    return {
        "profile_metrics": await profile_metrics(db, user),
        "today": daily.public(week[-1]),
        "week": [daily.public(d) for d in week],
        "weight_trend": [{"date": d["date"], "weight": d["morning_weight"]} for d in trend_days if d["morning_weight"]],
        "alerts": week[-1]["alerts"],
        "recommendation": await recommend(db, user, today),
        "ai_status": {
            "configured_providers": len({c.provider.id for c in chain if c.provider.id != "ollama"}),
            "enabled_models": len(chain),
            "ollama_reachable": (await ollama.status())["reachable"],
        },
    }


@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    return {
        "integrations": await app_settings.integrations_status(db),
        "app": {
            "auto_sync_files": settings.auto_sync_files,
            "ollama_base_url": await app_settings.get_ollama_url(db),
            "max_upload_mb": settings.max_upload_mb,
            "environment": settings.app_env,
            "version": settings.app_version,
        },
        "paths": {"export_dir": str(settings.export_dir), "upload_dir": str(settings.upload_dir)},
    }


@router.put("/settings")
async def put_settings(body: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    for name, value in (body.integrations or {}).items():
        if name not in app_settings.INTEGRATIONS:
            raise HTTPException(400, f"Unknown integration: {name}")
        await app_settings.set_integration_key(db, name, value.strip())
    if body.app and "ollama_base_url" in body.app:
        await app_settings.set_value(db, "ollama_base_url", body.app["ollama_base_url"] or None)
        await ollama.forget_cached_state()
    return await get_settings(db)


XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/export/xlsx")
async def export_xlsx(db: AsyncSession = Depends(get_db)):
    return Response(
        await exporter.build_workbook(db),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": 'attachment; filename="fitness_tracker.xlsx"'},
    )


@router.get("/export/workouts.csv")
async def export_csv(db: AsyncSession = Depends(get_db)):
    return Response(
        await exporter.build_workout_csv(db),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="workout_tracker.csv"'},
    )


@router.get("/export/json")
async def export_json(db: AsyncSession = Depends(get_db)):
    data = await backup.build_backup(db)
    name = f"fittrack-backup-{daily.today_for(await daily.get_user(db)).isoformat()}.json"
    return Response(
        json.dumps(data, ensure_ascii=False, indent=1),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.post("/export/sync")
async def export_sync():
    return {"files": await exporter.sync_files()}


async def _read_upload(file: UploadFile, limit: int) -> bytes:
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"The file is larger than {limit // (1024 * 1024)} MB.")
    return data


@router.post("/import/xlsx")
async def import_xlsx(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    name = (file.filename or "").lower()
    if name.endswith(".json"):
        raise HTTPException(400, "That's a JSON backup — use “Restore from JSON backup” instead.")
    if not name.endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "Please choose an Excel workbook (.xlsx or .xlsm) exported from FitTrack AI.")
    data = await _read_upload(file, importer.MAX_BYTES)
    try:
        result = await importer.import_workbook(db, data)
    except importer.ImportError_ as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        log.exception("Excel import failed")
        raise HTTPException(500, f"The import failed and nothing was changed ({type(exc).__name__}).") from exc
    await exporter.sync_if_enabled()
    return result


async def _backup_payload(file: UploadFile) -> dict:
    if (file.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "That's an Excel workbook — use “Import Excel” instead.")
    try:
        return backup.parse(await _read_upload(file, backup.MAX_BYTES))
    except backup.BackupError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/import/json/preview")
async def preview_json(file: UploadFile = File(...)):
    return backup.preview(await _backup_payload(file))


@router.post("/import/json")
async def import_json(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    payload = await _backup_payload(file)
    try:
        result = await backup.restore(db, payload)
    except backup.BackupError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        log.exception("JSON restore failed")
        raise HTTPException(500, f"The restore failed and nothing was changed ({type(exc).__name__}).") from exc
    await exporter.sync_if_enabled()
    return result


@router.get("/backups")
async def list_backups():
    folder = settings.export_dir / "backups"
    files = sorted(folder.glob("fittrack-*.json"), reverse=True) if folder.exists() else []
    return [{"name": p.name, "size": p.stat().st_size, "created_at": p.stat().st_mtime} for p in files]


@router.get("/backups/{name}")
async def download_backup(name: str):
    if not re.fullmatch(r"fittrack-[a-z-]+-\d{8}-\d{6}\.json", name):
        raise HTTPException(404, "Backup not found")
    path = settings.export_dir / "backups" / name
    if not path.is_file():
        raise HTTPException(404, "Backup not found")
    return FileResponse(path, media_type="application/json", filename=name)
