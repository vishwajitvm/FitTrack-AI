"""Full-data seeder: dump every table (and every uploaded file) to a folder, and load it back anywhere.

    python -m app.db.seed.snapshot dump                 # writes app/db/seed/snapshot/
    python -m app.db.seed.snapshot load --replace       # migrates, then restores everything into this database

The snapshot holds one JSON file per table (rows in primary-key order, original ids kept), a copy of
`data/uploads/` (meal photos, lab reports) and `manifest.json` (counts, schema revision, when it was taken).
Restoring keeps ids, resets the id sequences and copies the uploads back, so the app continues exactly where
it left off — including Ask FitTrack chats. API keys stay encrypted with SECRET_KEY: use the same SECRET_KEY
(backend/.env) on the new system or re-enter the keys in AI providers.
"""
import argparse
import asyncio
import hashlib
import json
import logging
import shutil
import sys
from datetime import date, datetime, time, timezone
from decimal import Decimal
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy import func, select, text

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.core.config import settings
from app.db.base import Base
from app.db.migrate import upgrade_to_head
from app.db.session import detect_vector_support, engine

log = logging.getLogger("snapshot")

DEFAULT_DIR = Path(__file__).resolve().parent / "snapshot"
CHUNK = 500


def _tables() -> list[sa.Table]:
    """Every table, parents before children (foreign-key order)."""
    return list(Base.metadata.sorted_tables)


def _key_fingerprint() -> str:
    return hashlib.sha256(settings.secret_key.encode()).hexdigest()[:12]


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
    if isinstance(kind, sa.DateTime):
        return datetime.fromisoformat(value)
    if isinstance(kind, sa.Date):
        return date.fromisoformat(value)
    if isinstance(kind, sa.Time):
        return time.fromisoformat(value)
    return value


async def dump(folder: Path, with_uploads: bool = True) -> dict:
    await detect_vector_support()
    data_dir = folder / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    for old in data_dir.glob("*.json"):
        old.unlink()
    counts: dict[str, int] = {}
    async with engine.connect() as conn:
        revision = (await conn.execute(text("SELECT version_num FROM alembic_version"))).scalar()
        for table in _tables():
            order = [c for c in table.primary_key.columns] or list(table.columns)[:1]
            rows = (await conn.execute(select(table).order_by(*order))).mappings().all()
            counts[table.name] = len(rows)
            lines = [json.dumps({k: _to_json(v) for k, v in row.items()}, ensure_ascii=False, separators=(",", ":")) for row in rows]
            (data_dir / f"{table.name}.json").write_text("[\n" + ",\n".join(lines) + ("\n" if lines else "") + "]\n", encoding="utf-8")

    uploads = 0
    if with_uploads:
        target = folder / "uploads"
        if target.exists():
            shutil.rmtree(target)
        if settings.upload_dir.exists():
            shutil.copytree(settings.upload_dir, target)
            uploads = sum(1 for p in target.rglob("*") if p.is_file())

    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "app_version": settings.app_version,
        "schema_revision": revision,
        "database": engine.dialect.name,
        "secret_key_fingerprint": _key_fingerprint(),
        "tables": counts,
        "total_rows": sum(counts.values()),
        "uploaded_files": uploads,
        "note": "Restore with: python -m app.db.seed.snapshot load --replace",
    }
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


async def _has_data(conn) -> list[str]:
    filled = []
    for table in _tables():
        if await conn.scalar(select(func.count()).select_from(table)):
            filled.append(table.name)
    return filled


async def _clear(conn) -> None:
    tables = _tables()
    if engine.dialect.name == "postgresql":
        names = ", ".join(f'"{t.name}"' for t in tables)
        await conn.execute(text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE"))
    else:
        for table in reversed(tables):
            await conn.execute(table.delete())


async def _reset_sequences(conn) -> None:
    if engine.dialect.name != "postgresql":
        return
    for table in _tables():
        pk = list(table.primary_key.columns)
        if len(pk) != 1 or not isinstance(pk[0].type, sa.Integer):
            continue
        col = pk[0].name
        await conn.execute(text(
            f"SELECT setval(pg_get_serial_sequence('\"{table.name}\"', '{col}'), "
            f"COALESCE((SELECT MAX(\"{col}\") FROM \"{table.name}\"), 1), "
            f"(SELECT COUNT(*) FROM \"{table.name}\") > 0)"
        ))


async def load(folder: Path, replace: bool = False, with_uploads: bool = True) -> dict:
    manifest_path = folder / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"No snapshot found in {folder} (manifest.json missing). Run the dump first.")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    await detect_vector_support()
    counts: dict[str, int] = {}
    async with engine.begin() as conn:
        filled = await _has_data(conn)
        if filled and not replace:
            raise SystemExit(
                "This database already has data (" + ", ".join(filled[:6]) + ("…" if len(filled) > 6 else "") + ").\n"
                "Run again with --replace to wipe it and restore the snapshot."
            )
        await _clear(conn)
        for table in _tables():
            path = folder / "data" / f"{table.name}.json"
            if not path.exists():
                log.warning("No data file for table %s (new table since the snapshot?) — left empty", table.name)
                continue
            raw = json.loads(path.read_text(encoding="utf-8"))
            columns = {c.name: c for c in table.columns}
            rows = [{k: _from_json(columns[k], v) for k, v in r.items() if k in columns} for r in raw]
            for i in range(0, len(rows), CHUNK):
                await conn.execute(table.insert(), rows[i : i + CHUNK])
            counts[table.name] = len(rows)
        await _reset_sequences(conn)

    uploads = 0
    source = folder / "uploads"
    if with_uploads and source.exists():
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, settings.upload_dir, dirs_exist_ok=True)
        uploads = sum(1 for p in source.rglob("*") if p.is_file())

    if manifest.get("secret_key_fingerprint") and manifest["secret_key_fingerprint"] != _key_fingerprint():
        log.warning(
            "SECRET_KEY differs from the system the snapshot was taken on: saved API keys cannot be decrypted. "
            "Copy SECRET_KEY from the old backend/.env, or re-enter your keys in AI providers & keys."
        )
    return {"restored_rows": sum(counts.values()), "tables": counts, "uploaded_files": uploads, "snapshot_taken": manifest.get("created_at")}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.db.seed.snapshot", description="Dump or restore ALL FitTrack data.")
    parser.add_argument("command", choices=["dump", "load"])
    parser.add_argument("--dir", type=Path, default=DEFAULT_DIR, help=f"snapshot folder (default: {DEFAULT_DIR})")
    parser.add_argument("--replace", action="store_true", help="load: wipe the existing data first")
    parser.add_argument("--no-uploads", action="store_true", help="skip copying data/uploads")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    if args.command == "dump":
        result = asyncio.run(dump(args.dir, not args.no_uploads))
        print(f"Snapshot written to {args.dir}: {result['total_rows']} rows in {len(result['tables'])} tables, "
              f"{result['uploaded_files']} uploaded files (schema {result['schema_revision']}).")
    else:
        upgrade_to_head()  # create / update the schema first
        result = asyncio.run(load(args.dir, args.replace, not args.no_uploads))
        print(f"Restored {result['restored_rows']} rows in {len(result['tables'])} tables and {result['uploaded_files']} uploaded files "
              f"(snapshot taken {result['snapshot_taken']}).")


if __name__ == "__main__":
    main(sys.argv[1:])
