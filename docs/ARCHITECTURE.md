# Architecture

Diagrams: [`diagram/system-architecture.mmd`](diagram/system-architecture.mmd), [`diagram/docker-deployment.mmd`](diagram/docker-deployment.mmd), [`diagram/database-schema.drawio`](diagram/database-schema.drawio).
Open `.mmd` files in any Mermaid viewer (GitHub, VS Code "Markdown Preview Mermaid Support", https://mermaid.live). Open `.drawio` at https://app.diagrams.net or with the VS Code Draw.io extension.

## Big picture

```
frontend/ (Next.js 14, port 3000) ──HTTP/JSON──▶ backend/ (FastAPI, port 8000) ──▶ PostgreSQL 16 + pgvector
                                                        │                        ──▶ Redis (cache, cooldowns)
                                                        ├──▶ 7 free LLM providers (OpenAI-compatible) ──▶ Ollama (last resort)
                                                        └──▶ USDA FoodData Central · Open Food Facts · Tavily
```

The browser talks only to the backend. The backend is the only component that holds secrets (API keys are encrypted in the database with a key derived from `SECRET_KEY`).

## Backend layout (`backend/`)

| Path | Responsibility |
|---|---|
| `app/main.py` | App factory. Startup = migrations → pgvector detection → catalog sync → seed → cache → file sync |
| `app/core/` | `config.py` (settings from `.env`), `crypto.py` (key encryption), `cache.py` (Redis or memory) |
| `app/db/` | `base.py` (declarative base, JSON/JSONB + vector types), `session.py`, `migrate.py`, `migrations/` (Alembic), `seed/` |
| `app/models/` | SQLAlchemy ORM models, one file per domain |
| `app/schemas/` | Pydantic request bodies |
| `app/api/routes/` | Thin HTTP layer: validation, calling services, serialization |
| `app/api/serializers.py` | ORM → JSON shapes documented in `docs/API.md` |
| `app/services/science/` | Pure formulas: BMR, MET, NEAT, TEF, BMI, Navy body-fat |
| `app/services/tracker/` | Daily totals, energy balance, alerts, profile metrics |
| `app/services/coach/` | Deterministic rules (`rules.py`) and AI coach (`advisor.py`) |
| `app/services/training/` | PPL rotation, readiness score, volume/RPE auto-regulation |
| `app/services/nutrition/` | Photo analyzer, container geometry, food library, search, tagging, embeddings |
| `app/services/health/` | Gut-health correlation engine, medical report analysis |
| `app/services/ml/` | On-device ML & statistics: embeddings runtime, photo recognition, Kalman TDEE, training load, readiness model, Bayesian triggers, MILP meal optimizer, lab parser, anomalies ([ML.md](ML.md)) |
| `app/services/quicklog/` | One-tap logging: presets (routines/meals), apply & prefill with last performance, copy day, Undo, quick picks, Today plan |
| `app/services/llm/` | Provider catalog, runtime registry, HTTP client, fallback router, JSON extraction |
| `app/services/ollama/` | Ollama status, model pulls with progress, deletes, curated library |
| `app/services/data/` | `fitness_tracker.xlsx` / `workout_tracker.csv` export, JSON backup, xlsx import |
| `scripts/` | Maintenance + smoke-test scripts (regenerate the draw.io schema, photo-ML and lab-report end-to-end checks) |
| `tests/` | Unit tests for the ML/statistics layer (`pytest tests`) |

Rule of thumb: **routes are thin, services hold the logic, `science/` has no I/O.**

## Frontend layout (`frontend/src/`)

| Path | Responsibility |
|---|---|
| `app/<route>/page.tsx` | ~5-line pages that render a feature view |
| `components/<feature>/` | Feature UI: dashboard, food, scan, workouts, tracker, checkin, medical, profile, ai, ollama, settings, layout |
| `components/ui/` | Shared primitives (button, card, input, badge, modal, table…) |
| `components/common/` | Shared blocks (date picker, alert list, …) |
| `hooks/use-*.ts` | SWR data hooks per domain |
| `lib/` | `api.ts` (fetch wrapper), `types.ts` (mirrors the API contract), `notify.ts` (SweetAlert2 + sonner), `format.ts`, `image.ts` |
| `config/` | Nav items and constants (meal types, splits, …) |

## Key design decisions

1. **Raw logs are the source of truth.** `daily_summaries` caches totals, recomputed after every change (`tracker/daily.recompute`). Computation is a pure function over pre-loaded rows, so a 30-day range costs a handful of queries.
2. **No double counting.** A lifting session's calories are computed once for the whole block (`workout_sessions`). Strength exercises inside it always have `estimated_calories = 0`; cardio rows carry their own MET calories.
3. **Deficit = TDEE − intake.** Never intake − exercise. If age or sex is missing, the deficit is `null` with status `pending` ("Pending Biometric Confirmation").
4. **AI is optional and replaceable.** Every AI feature has a non-AI fallback (rule-based coach text, correlation summaries) or fails with a clear message. The router tries providers in priority order and always keeps Ollama last.
5. **Portable storage.** JSON columns become JSONB on PostgreSQL; the embedding column is `vector(256)` when pgvector exists and JSON otherwise, so the same code runs on SQLite without Docker.
6. **ML before LLM.** Search, typed meals, repeat meals, duplicate photos, portions, TDEE, readiness, triggers, meal suggestions and most lab reports are handled by local ML/statistics; the LLM is reserved for what genuinely needs it.
7. **Migrations create the schema.** Tables are never created with `create_all`; Alembic runs on every start (idempotent).
