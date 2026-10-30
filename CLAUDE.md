# FitTrack AI — project memory

Self-hosted AI fitness, nutrition & bio-feedback platform for one athlete. FastAPI backend + Next.js frontend + PostgreSQL/pgvector + Redis, all runnable via Docker Compose or natively.

## Layout

- `backend/` — FastAPI (Python 3.11+; Docker uses 3.12). All server logic. Own `.env` (copy of `.env.example`, holds every setting incl. `DATABASE_URL`, `SECRET_KEY`, optional provider keys).
- `frontend/` — Next.js 14 App Router, TypeScript, Tailwind, SWR, SweetAlert2 (confirmations), sonner (toasts), Recharts. Own `.env` (`NEXT_PUBLIC_API_URL`, baked in at build time).
- `docs/` — `API.md` is the **contract between frontend and backend**; keep it in sync. `diagram/*.mmd` (Mermaid flows) and `diagram/database-schema.drawio` (generated).
- `.claude/agents`, `.claude/skills` — project agents and workflows.

## Backend conventions

- Routes (`app/api/routes/`) are thin: validate → call a service → serialize (`app/api/serializers.py`). Business logic lives in `app/services/<domain>/`. Pure formulas live in `app/services/science/` (no I/O).
- Request bodies are Pydantic models in `app/schemas/`. Use `limited(n)` / `ClockTime` from `app/schemas/common.py` so string lengths match DB columns (PostgreSQL enforces `VARCHAR(n)`; SQLite does not — always test string-length changes on Postgres).
- Python 3.14 evaluates annotations lazily: never name a parameter or field the same as its type (`date: date`). Use `day: date = Query(alias="date")` or `import datetime as dt`.
- After any change to food/workout/check-in data call `daily.recompute(db, user, date)` and schedule `sync_if_enabled` (keeps `fitness_tracker.xlsx` / `workout_tracker.csv` fresh).
- **Schema changes = Alembic migration.** Revision IDs must be ≤ 32 characters (alembic_version column). Edit the model, then `alembic revision --autogenerate -m "..."`, review it, `alembic check` must say "No new upgrade operations detected". Never use `create_all`. Never edit a migration that has been applied anywhere — add a new one (a hot-reloading dev server applies migrations as soon as the file exists). Migrations run automatically at startup. Regenerate the draw.io with `python scripts/generate_schema_diagram.py`.
- JSON columns use `JSONType` (JSONB on Postgres). The `food_library.embedding` column is `vector(256)` only when pgvector exists (`VectorState.enabled`).
- All LLM calls go through `services/llm/router.complete(db, task, messages, json_mode=...)`. Never call a provider directly. Tasks: `vision`, `reasoning`, `fast`, `medical`. Ollama is always the last resort. Every AI feature needs a non-AI fallback or a clear error (`AllProvidersFailed`).
- Provider catalog: `services/llm/catalog.py` — **free-only policy**: 7 free-forever cloud providers / 54 models (+ Ollama, LM Studio, custom). No paid, trial or card-required providers; keyless third-party relays are excluded for privacy. `sync_catalog` inserts new entries without overwriting user edits and deletes providers/built-in models dropped from the catalog. OpenRouter "Sync models" keeps only `:free` IDs.
- API keys typed in the UI are Fernet-encrypted with a key derived from `SECRET_KEY`; never return raw keys — only `preview()`.

## Domain rules (do not break)

- Deficit = **TDEE − intake**, never intake − exercise. If age or sex is missing → deficit `null`, status `pending` ("Pending Biometric Confirmation").
- TDEE = BMR (Mifflin-St Jeor) + NEAT + TEF + exercise. Exercise = MET × 3.5 × kg / 200 × min.
- A lifting session's calories are counted **once** on `workout_sessions`; strength rows in `workout_logs` always have 0 kcal. Cardio rows carry their own calories.
- Sunday is the rest day. Gym return ~21:10, bedtime ~21:30 → main meal before the gym, only light protein after.
- Protein target 1.6–2.0 g/kg. Crash deficit alert < 1,000 kcal (completed days only).
- Seed data = profile + **Day 1 (2026-10-26, Pull)** and **Day 2 (2026-10-27, Push)** only (`app/db/seed/baseline.py`). Day 1 totals: 1,279 kcal / 75.1 g P / 637 kcal exercise. Day 2: 945 kcal / 65.9 g P, push duration not logged.
- Profile timezone defaults to `Asia/Kolkata`; "today" is computed in the profile timezone.
- Full-data snapshot (the user's real data, incl. Ask FitTrack chats in `assistant_messages`): `python -m app.db.seed.snapshot dump|load --replace` → `backend/app/db/seed/snapshot/`. Every new table is picked up automatically (FK order from `Base.metadata`); re-dump after the user adds data you must not lose.

## Machine learning (see docs/ML.md)

- Principle: **ML/statistics first, LLM only where it adds real value** (decomposing unseen meal photos, narrative coaching, unusual/scanned lab reports). Every ML path must also work when models are not loaded.
- `services/ml/runtime.py` owns the ONNX models (fastembed, Nomic Embed v1.5 text + vision, shared vector space). Use `runtime.is_ready()` on request paths (never block a request on a download) except explicit ML-only actions; inference runs in a worker thread.
- Modules: `energy_model` (Kalman trend + adaptive TDEE), `training_load` (sRPE, EWMA ACWR), `readiness_model` (ridge), `bayes` (N-of-1 triggers), `meal_optimizer` (SciPy MILP), `meal_parser` (typed meals, protein scoops from profile), `food_recognition` (zero-shot, personal k-NN, pHash duplicates), `calibration` (portion shrinkage), `lab_parser` (regex biomarkers), `anomalies`.
- Pure functions get unit tests in `backend/tests/test_ml_models.py` with synthetic data and known answers.
- Daily summaries carry `adaptive_tdee`/`tdee_source`; when formula TDEE is pending and adaptive confidence ≥ 0.5 the adaptive value is used.

## Quick logging (presets)

- `presets` table + `services/quicklog/`: workout routines and meal presets (`payload` shapes in docs/API.md), apply/prefill (last performance + progression), copy day, bulk delete for Undo, recency-weighted quick picks per meal slot, and the `/api/today` plan. Starter presets are seeded from the athlete's real routine when the table is empty (`app/db/seed/presets.py`).
- Every one-tap write returns created ids (`AppliedEntries`) so the UI can Undo.
- UX principle: a person with a fixed routine logs a normal day in a few taps; beginners get plain language (Simple mode), experts get details.

## Frontend conventions

- `src/app/<route>/page.tsx` stays tiny and renders `src/components/<feature>/...`. Shared primitives in `components/ui`, shared blocks in `components/common`, data hooks in `src/hooks/use-*.ts`, API client/types/notify helpers in `src/lib`, constants in `src/config`.
- `src/lib/types.ts` mirrors `docs/API.md`. Change both together.
- Confirm destructive actions with SweetAlert2; toast every mutation result with sonner.
- Themes: light / dark / system (default system). Plain-language help texts for metrics live in one glossary file and are shown via the "?" InfoTip component.

## Commands

```bash
# Docker (on this machine ports 5432/3000 are used by another project):
POSTGRES_HOST_PORT=5433 FRONTEND_HOST_PORT=3001 docker compose up -d --build
docker compose logs -f backend
docker compose exec backend alembic check

# Backend natively (SQLite quick start: DATABASE_URL=sqlite+aiosqlite:///./data/fittrack.db)
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev     # npm run lint && npm run build before committing
```

## Verification habit

Smoke-test every GET in `docs/API.md` (expect 200) and run `alembic check` after backend changes; run `npm run lint && npm run build` after frontend changes; check pages in the browser against the live backend in both themes and at phone width.
