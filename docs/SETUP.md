# Setup guide

Two ways to run FitTrack AI. Both use the same `.env` files.

| | Docker (recommended) | Without Docker |
|---|---|---|
| You install | Docker Desktop | Python 3.11+ and Node.js 20+ (PostgreSQL/Redis/Ollama optional) |
| Database | PostgreSQL 16 + pgvector (container) | Your PostgreSQL, or SQLite (zero setup) |
| Start | `docker compose up -d --build` | `uvicorn` + `npm run dev` |

## 1. Configure environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` and set `SECRET_KEY` to a long random value:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Everything else works with the defaults. AI keys are added later from the web UI.

## 2a. Run with Docker

```bash
docker compose up -d --build
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API + interactive docs | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 (user/password from `backend/.env`) |
| Redis | localhost:6379 |

Optional local AI (Ollama) container:

```bash
docker compose --profile ollama up -d --build
```

Already running Ollama on your computer instead? Set `OLLAMA_BASE_URL=http://host.docker.internal:11434` in your shell (or change it on the Ollama page).

Port already used? Override host ports without editing files, e.g. `BACKEND_HOST_PORT=8001 FRONTEND_HOST_PORT=3001 docker compose up -d`. If you change the backend port, also build the frontend with `PUBLIC_API_URL=http://localhost:8001`.

Useful commands:

```bash
docker compose logs -f backend      # watch backend logs (migrations, seed, AI calls)
docker compose ps                   # status of every container
docker compose down                 # stop (data is kept in volumes)
docker compose down -v              # stop AND delete all data
```

The backend container mounts `backend/app` and runs with `--reload`, so code edits apply instantly.

## 2b. Run without Docker

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt        # or: uv pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- **No PostgreSQL?** In `backend/.env` set `DATABASE_URL=sqlite+aiosqlite:///./data/fittrack.db`. Fuzzy food search then runs in Python instead of pgvector; everything else is identical.
- **No Redis?** Set `REDIS_URL=` (empty). An in-memory cache is used.
- **PostgreSQL with pgvector** is detected automatically; without the extension the embedding column falls back to JSON.

On startup the backend applies migrations (`alembic upgrade head`), seeds reference foods, the AI catalog and the baseline record (first run only).

### Frontend

```bash
cd frontend
npm install
npm run dev           # http://localhost:3000
# production: npm run build && npm start
```

`NEXT_PUBLIC_API_URL` in `frontend/.env` must point at the backend. It is baked in at build time — rebuild after changing it.

## Machine-learning models

On the first start the backend downloads two small ONNX models (~0.23 GB) into `backend/data/models` (Docker: the `backend_data` volume) in the background; the app works meanwhile and ML features switch on when they are ready (Settings → Machine learning shows progress). Offline machine? Set `ML_ENABLED=false`.

Run the ML unit tests: `cd backend && pip install -r requirements-dev.txt && pytest tests` (or in Docker: `docker compose exec backend pytest tests`).

## 3. Add at least one AI provider

Open **AI Providers** in the app, paste a key, click **Test**. Every provider below is free forever with just a key (no card, no trial):

| Provider | Free key | Best for |
|---|---|---|
| Google Gemini | https://aistudio.google.com/app/apikey | Meal photos (vision) + reasoning — add this first |
| Groq | https://console.groq.com/keys | Very fast reasoning (no vision on free plan) |
| OpenRouter | https://openrouter.ai/keys | `:free` vision & reasoning models (50 req/day) |
| Cloudflare Workers AI | https://dash.cloudflare.com/profile/api-tokens + Account ID | Extra daily capacity, vision models |
| NVIDIA NIM | https://build.nvidia.com/settings/api-keys | Large free models (may retain prompts) |
| Z.ai | https://z.ai/manage-apikey/apikey-list | GLM Flash models incl. vision |
| Mistral | https://console.mistral.ai/api-keys | Off by default (free plan trains on prompts) |

See [AI_PROVIDERS.md](AI_PROVIDERS.md) for limits and why other providers are not included.

No internet AI at all? Start Ollama and download `gemma3:4b` (vision) and `qwen2.5:7b` (text) from the **Ollama** page.

## 4. Optional integrations (Settings page)

- **USDA FoodData Central** — `DEMO_KEY` is shared and heavily rate-limited; a free personal key makes nutrition verification reliable.
- **Tavily** — web search used when a food is not in any database.

## Database migrations

```bash
cd backend
alembic upgrade head                              # apply (also done automatically on start)
alembic revision --autogenerate -m "add x"        # after changing a model
alembic downgrade -1                              # roll back one step
python -m app.db.seed                             # migrate + seed manually
python scripts/generate_schema_diagram.py         # refresh docs/diagram/database-schema.drawio
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend shows "Cannot reach the backend" | Check http://localhost:8000/api/health; check `NEXT_PUBLIC_API_URL`; check `CORS_ORIGINS` in `backend/.env` |
| "All AI providers failed or none are configured" | Add a key on AI Providers and click Test; see the Call logs tab for the exact error |
| Saved keys stopped working | `SECRET_KEY` changed — re-enter keys |
| Ollama "not reachable" | `docker compose --profile ollama up -d`, or fix the URL on the Ollama page |
| Port 5432/6379/8000/3000 in use | Use the `*_HOST_PORT` variables shown above |
