---
name: db-migration
description: Change the FitTrack AI database schema safely with an Alembic migration and keep docs/diagram in sync.
---

# Database schema change

1. Edit the model in `backend/app/models/<domain>.py`. Use `JSONType` for JSON, `String(n)` sized for real data.
2. If a request schema writes the column, set the same limit with `limited(n)` from `app/schemas/common.py`.
3. Create the migration (DB must be at head):
   ```bash
   cd backend
   alembic upgrade head
   alembic revision --autogenerate -m "short description"
   ```
4. Review the generated file in `app/db/migrations/versions/` — fix renames (autogenerate sees drop+add), add data backfills, make `downgrade()` correct. For SQLite compatibility keep `render_as_batch` (already configured).
5. `alembic upgrade head` then `alembic check` → must print "No new upgrade operations detected". Test on PostgreSQL (`docker compose exec backend alembic check`), because SQLite ignores VARCHAR lengths.
6. `python scripts/generate_schema_diagram.py` to refresh `docs/diagram/database-schema.drawio`; update `docs/DATABASE.md`.
7. Never edit a migration that has already been applied on a real database — add a new one.
