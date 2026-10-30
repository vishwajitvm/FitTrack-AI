# Database

- Diagram (all tables, columns, relations): [`diagram/database-schema.drawio`](diagram/database-schema.drawio) — regenerate with `python backend/scripts/generate_schema_diagram.py`.
- Migrations: `backend/app/db/migrations/versions/` (Alembic). They run automatically on backend start.
- Engines: PostgreSQL 16 (+ pgvector) in Docker; SQLite supported for no-Docker setups.

## Tables

| Table | Purpose | Key relations |
|---|---|---|
| `users` | Athlete profile (basic + advanced fields). Single row, id = 1 | — |
| `daily_summaries` | One row per day: day number, morning weight, cached totals, TDEE, deficit, check-in, coach advice | `user_id → users`, unique `(user_id, date)` |
| `food_logs` | Each food eaten: meal, time, grams, macros, kcal range, confidence, source, tags, photo | `daily_summary_id → daily_summaries`, `analysis_id → food_analyses` |
| `food_analyses` | Raw photo/description analysis results awaiting review | — |
| `food_library` | Reference foods per 100 g with `embedding vector(256)` | — |
| `workout_sessions` | Lifting block (split, duration, MET, kcal) | `daily_summary_id → daily_summaries` |
| `workout_logs` | Cardio bouts (with kcal) and strength exercises (sets, reps, kg, RPE; 0 kcal) | `daily_summary_id`, `session_id → workout_sessions` |
| `bio_feedback` | Symptoms with severity 0–3 and suspected trigger | `user_id → users` |
| `medical_reports` | Uploaded lab reports, AI summary, implications, flags | `user_id → users` |
| `biomarkers` | Values parsed from reports (value, unit, reference range, status) | `report_id → medical_reports` |
| `ai_providers` | UI-managed provider state: enabled, priority, encrypted key, base URL, last status | — |
| `ai_models` | Models per provider with capabilities, enabled, priority | `provider_id → ai_providers` |
| `llm_call_logs` | Every LLM attempt (success / rate_limited / auth / error / timeout, latency) | — |
| `meal_memories` | Your confirmed meal photos: image embedding (`vector(768)`), items and calories — powers "your usual meal" recognition | `analysis_id → food_analyses` |
| `portion_calibrations` | Running mean of your weight corrections per container × food type | — |
| `presets` | Saved workout routines and meals (`kind`, `payload`, usage count) for one-tap logging | — |
| `app_settings` | Key/value JSON: routing, Ollama URL, encrypted integration keys | — |

JSON columns (`ingredients_json`, `tags`, `capabilities`, …) are **JSONB** on PostgreSQL.

Migrations: `0001_initial_schema` (core tables) → `0002_machine_learning` (semantic/image embeddings, pHash, session RPE, meal memories, portion calibrations) → `0003_protein_powder_lab_method` (profile protein-powder fields, lab-report extraction method) → `0004_presets` (routines & meal presets). Vector columns: `food_library.embedding` (trigram, 256-d), `food_library.semantic_embedding`, `food_analyses.image_embedding`, `meal_memories.image_embedding` (Nomic, 768-d).

## Seeded data (first start only)

- Profile: 173 cm, 94.5 kg start, goal, Sunday rest, gym return 21:10, bedtime 21:30, timezone Asia/Kolkata. Age and sex are left empty on purpose (pending confirmation).
- **Day 1 — 26 Oct 2026 (Pull)**: 6 food entries (1,279 kcal · 75.1 g P · 168.2 g C · 35.3 g F · 11.1 g fibre), treadmill 20 min, cycling 10 min, one 60-min pull session with 8 exercises (637 kcal exercise).
- **Day 2 — 27 Oct 2026 (Push)**: 5 food entries (945 kcal · 65.9 g P · 107.5 g C · 27.3 g F · 5.3 g fibre), push session with duration not logged.
- 86 reference foods, 10 providers (7 free cloud + Ollama, LM Studio, custom), 62 models.

Set `SEED_BASELINE=false` to start with an empty profile instead.

## Common operations

```bash
cd backend
alembic current                      # which revision is applied
alembic upgrade head                 # apply migrations
alembic revision --autogenerate -m "describe change"
alembic check                        # verify models and migrations match
```

Backups: `GET /api/export/json` (full JSON), `GET /api/export/xlsx`, or `docker compose exec db pg_dump -U fittrack fittrack > backup.sql`.
