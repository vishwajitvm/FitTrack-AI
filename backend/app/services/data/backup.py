"""Full JSON backup of everything you logged, and restore from it (Settings → Your data).

The backup holds every row of the personal-data tables with their original ids: profile, days, food, workouts,
symptoms, medical reports, presets, meal photos' analyses, Ask FitTrack chats. It leaves out AI provider keys and
settings (they stay on this install, encrypted) and the uploaded photo files themselves.

Restoring replaces those tables in ONE transaction — if anything in the file is wrong, nothing changes. A copy of
the current data is written to EXPORT_DIR/backups/ first, so a restore can always be undone.

Files from the older "Full JSON backup" (profile / days / food_logs / … keys) are still accepted: their food,
workouts and symptoms are merged in (matching entries updated, new ones added, nothing deleted).
"""
import json
import logging
from datetime import date, datetime, time, timezone
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

import app.models  # noqa: F401  (registers every table)
from app.core.config import settings
from app.db.base import Base
from app.models import BioFeedback, FoodLog, WorkoutLog, WorkoutSession
from app.services.tracker import daily

log = logging.getLogger(__name__)

FORMAT = "fittrack-backup"
VERSION = 1
MAX_BYTES = 50 * 1024 * 1024
KEEP_AUTO_BACKUPS = 10
# configuration, secrets and logs stay on this install
EXCLUDED = {"ai_providers", "ai_models", "app_settings", "llm_call_logs"}


class BackupError(ValueError):
    """The file can't be restored (not a backup, damaged, or rejected by the database)."""


def _tables() -> list[sa.Table]:
    return [t for t in Base.metadata.sorted_tables if t.name not in EXCLUDED]


def _to_json(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "tolist"):  # numpy arrays (pgvector)
        return value.tolist()
    return value


def _from_json(column: sa.Column, value):
    if value is None:
        return None
    kind = column.type
    try:
        if isinstance(kind, sa.DateTime):
            out = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            return out if out.tzinfo or not getattr(kind, "timezone", False) else out.replace(tzinfo=timezone.utc)
        if isinstance(kind, sa.Date):
            return date.fromisoformat(str(value)[:10])
        if isinstance(kind, sa.Time):
            return time.fromisoformat(str(value))
        if isinstance(kind, sa.Boolean):
            if not isinstance(value, bool):
                raise ValueError
            return value
        if isinstance(kind, sa.Integer):
            if isinstance(value, bool) or (isinstance(value, float) and not value.is_integer()):
                raise ValueError
            return int(value)
        if isinstance(kind, sa.Float):
            if isinstance(value, bool):
                raise ValueError
            return float(value)
        if isinstance(kind, sa.String) and not isinstance(value, str):
            value = str(value)
        if isinstance(kind, sa.String) and kind.length and len(value) > kind.length:
            raise ValueError(f"longer than {kind.length} characters")
    except (TypeError, ValueError) as exc:
        detail = f" ({exc})" if str(exc) else ""
        raise BackupError(f"{column.table.name}.{column.name}: can't use {str(value)[:40]!r}{detail}") from None
    return value


async def build_backup(db: AsyncSession) -> dict:
    conn = await db.connection()
    revision = (await conn.execute(text("SELECT version_num FROM alembic_version"))).scalar()
    tables: dict[str, list[dict]] = {}
    for table in _tables():
        order = list(table.primary_key.columns) or list(table.columns)[:1]
        rows = (await conn.execute(select(table).order_by(*order))).mappings().all()
        tables[table.name] = [{k: _to_json(v) for k, v in row.items()} for row in rows]
    return {
        "format": FORMAT,
        "version": VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "app_version": settings.app_version,
        "schema_revision": revision,
        "counts": {k: len(v) for k, v in tables.items()},
        "tables": tables,
    }


def parse(data: bytes) -> dict:
    if not data:
        raise BackupError("The file is empty.")
    if len(data) > MAX_BYTES:
        raise BackupError("The file is larger than 50 MB — that isn't a FitTrack backup.")
    try:
        payload = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BackupError(f"That isn't a valid JSON file ({type(exc).__name__}).") from None
    if not isinstance(payload, dict):
        raise BackupError("That JSON isn't a FitTrack backup.")
    if payload.get("format") == FORMAT:
        if not isinstance(payload.get("version"), int) or payload["version"] > VERSION:
            raise BackupError("This backup was made by a newer FitTrack version — update the app first.")
        if not isinstance(payload.get("tables"), dict):
            raise BackupError("The backup has no tables.")
        for name, rows in payload["tables"].items():
            if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
                raise BackupError(f"Table {name!r} in the backup is damaged.")
        if not payload["tables"].get("users"):
            raise BackupError("The backup has no profile (users table is empty).")
        return payload
    if any(k in payload for k in ("food_logs", "workout_logs", "workout_sessions")) and "profile" in payload:
        payload["format"] = "legacy"
        return payload
    raise BackupError("That JSON isn't a FitTrack backup (export one from Settings → Your data).")


def preview(payload: dict) -> dict:
    """What a restore would do, shown before the user confirms."""
    if payload["format"] == "legacy":
        counts = {k: len(payload.get(k) or []) for k in ("food_logs", "workout_sessions", "workout_logs", "bio_feedback")}
        return {"kind": "legacy", "mode": "merge", "created_at": None, "counts": counts, "total": sum(counts.values())}
    known = {t.name for t in _tables()}
    counts = {k: len(v) for k, v in payload["tables"].items() if k in known}
    return {
        "kind": "full",
        "mode": "replace",
        "created_at": payload.get("created_at"),
        "schema_revision": payload.get("schema_revision"),
        "counts": counts,
        "total": sum(counts.values()),
        "ignored_tables": sorted(k for k in payload["tables"] if k not in known),
    }


def _rows_for(table: sa.Table, raw: list[dict]) -> list[dict]:
    columns = {c.name: c for c in table.columns}
    out = []
    for i, r in enumerate(raw, start=1):
        row = {k: _from_json(columns[k], v) for k, v in r.items() if k in columns}
        for name, col in columns.items():
            if name in row:
                continue
            default = col.default.arg if col.default is not None and not callable(col.default.arg) else None
            if default is None and col.default is not None and callable(col.default.arg):
                try:
                    default = col.default.arg(None)
                except TypeError:
                    default = col.default.arg()
            if default is None and not col.nullable and not col.primary_key and col.server_default is None:
                raise BackupError(f"{table.name} row {i}: {name} is missing")
            row[name] = default
        out.append(row)
    return out


async def _reset_sequences(conn, tables: list[sa.Table]) -> None:
    if conn.dialect.name != "postgresql":
        return
    for table in tables:
        pk = list(table.primary_key.columns)
        if len(pk) != 1 or not isinstance(pk[0].type, sa.Integer):
            continue
        col = pk[0].name
        await conn.execute(text(
            f"SELECT setval(pg_get_serial_sequence('\"{table.name}\"', '{col}'), "
            f"COALESCE((SELECT MAX(\"{col}\") FROM \"{table.name}\"), 1), "
            f"(SELECT COUNT(*) FROM \"{table.name}\") > 0)"
        ))


async def save_auto_backup(db: AsyncSession, reason: str) -> str | None:
    """Writes the current data to EXPORT_DIR/backups/ (kept: the newest 10). Never raises."""
    try:
        folder = settings.export_dir / "backups"
        folder.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        path = folder / f"fittrack-{reason}-{stamp}.json"
        path.write_text(json.dumps(await build_backup(db), ensure_ascii=False), encoding="utf-8")
        for old in sorted(folder.glob(f"fittrack-{reason}-*.json"))[:-KEEP_AUTO_BACKUPS]:
            old.unlink(missing_ok=True)
        return path.name
    except Exception as exc:  # noqa: BLE001
        log.warning("Automatic backup failed: %s", exc)
        return None


async def restore(db: AsyncSession, payload: dict) -> dict:
    if payload["format"] == "legacy":
        return await _merge_legacy(db, payload)
    tables = _tables()
    prepared = {t.name: _rows_for(t, payload["tables"].get(t.name) or []) for t in tables}  # validate before touching data
    safety = await save_auto_backup(db, "before-restore")
    if safety is None:
        raise BackupError("Couldn't save a safety copy of your current data, so nothing was restored.")
    conn = await db.connection()
    try:
        for table in reversed(tables):
            await conn.execute(table.delete())
        for table in tables:
            rows = prepared[table.name]
            for i in range(0, len(rows), 500):
                await conn.execute(table.insert(), rows[i : i + 500])
        await _reset_sequences(conn, tables)
        await db.commit()
    except BackupError:
        await db.rollback()
        raise
    except sa.exc.DBAPIError as exc:
        await db.rollback()
        reason = str(getattr(exc, "orig", exc)).splitlines()[0][:200]
        raise BackupError(f"The database rejected the backup, nothing was changed: {reason}") from None
    except Exception:
        await db.rollback()
        raise
    db.expunge_all()
    return {"mode": "replace", "restored": {k: len(v) for k, v in prepared.items()}, "total": sum(len(v) for v in prepared.values()), "safety_backup": safety}


def _pick(model, item: dict, rename: dict[str, str] | None = None) -> dict:
    columns = {c.name: c for c in model.__table__.columns}
    out = {}
    for k, v in item.items():
        k = (rename or {}).get(k, k)
        if k in columns and k not in ("id", "daily_summary_id", "user_id", "created_at", "updated_at"):
            out[k] = _from_json(columns[k], v)
    return out


async def _merge_legacy(db: AsyncSession, payload: dict) -> dict:
    user = await daily.get_user(db)
    touched: set[date] = set()
    counts = {"food": 0, "workouts": 0, "symptoms": 0}
    session_ids: dict[int, int] = {}

    async def upsert(model, item: dict, key: str | None, rename=None):
        values = _pick(model, item, rename)
        d = values.get("date")
        if not isinstance(d, date):
            raise BackupError(f"{model.__tablename__}: an entry has no date")
        old = await db.get(model, item["id"]) if isinstance(item.get("id"), int) else None
        if old is not None and key and old.date != d and getattr(old, key, None) != values.get(key):
            old = None  # same id, different entry (backup from another install)
        row = old or model()
        for k, v in values.items():
            setattr(row, k, v)
        if hasattr(model, "daily_summary_id"):
            row.daily_summary_id = (await daily.ensure_summary(db, user, d)).id
        if hasattr(model, "user_id"):
            row.user_id = user.id
        db.add(row)
        await db.flush()
        touched.add(d)
        return row

    try:
        for item in payload.get("workout_sessions") or []:
            row = await upsert(WorkoutSession, item, "split")
            if isinstance(item.get("id"), int):
                session_ids[item["id"]] = row.id
            counts["workouts"] += 1
        for item in payload.get("workout_logs") or []:
            item = {**item, "session_id": session_ids.get(item.get("session_id"))}
            await upsert(WorkoutLog, item, "exercise_name")
            counts["workouts"] += 1
        for item in payload.get("food_logs") or []:
            await upsert(FoodLog, {**item, "analysis_id": None}, "food_name", {"ingredients": "ingredients_json"})
            counts["food"] += 1
        for item in payload.get("bio_feedback") or []:
            await upsert(BioFeedback, item, "symptom_type")
            counts["symptoms"] += 1
        await db.commit()
    except BackupError:
        await db.rollback()
        raise
    except sa.exc.DBAPIError as exc:
        await db.rollback()
        raise BackupError(f"The database rejected an entry, nothing was changed: {str(getattr(exc, 'orig', exc)).splitlines()[0][:200]}") from None
    for d in sorted(touched):
        await daily.recompute(db, user, d)
    return {"mode": "merge", "restored": counts, "total": sum(counts.values()), "dates": [d.isoformat() for d in sorted(touched)]}
