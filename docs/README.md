# FitTrack AI documentation

| Document | Read it when you want to… |
|---|---|
| [SETUP.md](SETUP.md) | Install and run (Docker or not), configure `.env`, migrations, troubleshooting |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Understand how the code is organised and the key design decisions |
| [API.md](API.md) | Call the backend — every endpoint and JSON shape (the frontend ↔ backend contract) |
| [CALCULATIONS.md](CALCULATIONS.md) | Check the formulas: BMR, MET, NEAT, TEF, TDEE, alerts, readiness, gut correlations |
| [FOOD_PHOTO_ANALYSIS.md](FOOD_PHOTO_ANALYSIS.md) | Know how a photo becomes grams and macros |
| [AI_PROVIDERS.md](AI_PROVIDERS.md) | Manage the free AI providers, fallback routing and Ollama |
| [ML.md](ML.md) | Understand the on-device machine learning and statistics |
| [DATABASE.md](DATABASE.md) | See the tables, migrations and seed data |

## Diagrams (`diagram/`)

| File | Shows |
|---|---|
| `system-architecture.mmd` | Frontend, backend services, infrastructure and external services |
| `docker-deployment.mmd` | Containers, ports, volumes and env files |
| `food-photo-analysis.mmd` | Sequence from photo upload to saved food log |
| `llm-fallback-routing.mmd` | How the AI router picks providers and falls back to Ollama |
| `daily-energy-balance.mmd` | How a day's intake, TDEE, deficit and alerts are computed |
| `ml-pipeline.mmd` | Where on-device ML replaces or assists the LLM |
| `database-schema.drawio` | Every table, column and relation (generated from the models) |

`.mmd` files render on GitHub, in VS Code (Mermaid preview extensions) or at https://mermaid.live.
`.drawio` opens at https://app.diagrams.net or with the VS Code "Draw.io Integration" extension.
