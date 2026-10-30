---
name: run-and-verify
description: Start FitTrack AI (Docker or native) and run the standard smoke test of API, migrations and UI.
---

# Run & verify FitTrack AI

## Docker
```bash
POSTGRES_HOST_PORT=5433 FRONTEND_HOST_PORT=3001 docker compose up -d --build   # ports 5432/3000 are busy on this machine
docker compose ps
curl -s localhost:8000/api/health        # {"status":"ok","db_engine":"postgresql","pgvector":true,"redis":"ok"}
docker compose exec backend alembic check
```
Frontend: http://localhost:3001 (or 3000 when free). API docs: http://localhost:8000/docs.
If the frontend port differs from 3000/3001, add it to `CORS_ORIGINS` in `backend/.env` and `docker compose up -d backend`.

## Native (no Docker)
```bash
cd backend && DATABASE_URL=sqlite+aiosqlite:///./data/fittrack.db REDIS_URL= uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```

## Smoke test
Loop over every GET in `docs/API.md` with curl and expect 200. Spot-check the baseline:
`GET /api/daily?start=2026-10-26&end=2026-10-27` → Day 1 1279 kcal / 75.1 g P / 637 exercise; Day 2 945 kcal / 65.9 g P.

## Reset to the seeded baseline
`docker compose down -v && docker compose up -d` (deletes ALL data — ask the user first).
