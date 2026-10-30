---
name: add-llm-provider
description: Add a new AI provider or models to FitTrack AI's LLM catalog so they appear in the AI Providers page and the fallback router.
---

# Add an LLM provider / models

**Free-only policy:** add a provider/model only if it is free forever with just an API key — no credit card, no expiring trial credits, no paid tier — and it is capable (vision for meal photos or solid reasoning). Verify on the provider's own pricing/limits page or live `/models` list (OpenRouter: `https://openrouter.ai/api/v1/models`, price 0). Record the check date in the catalog docstring. Do not add keyless third-party relays (privacy of health data).

1. Open `backend/app/services/llm/catalog.py`.
2. If the provider speaks the OpenAI `/chat/completions` protocol (most do), append an entry to `PROVIDERS`:
   ```python
   {
       "id": "slug", "name": "Display Name", "base_url": "https://api.example.com/v1",
       "website": "...", "key_url": "...", "env_key": "EXAMPLE_API_KEY",
       "free_tier": True, "free_tier_note": "...", "priority": 150,
       # optional: "headers": {...}, "extra_fields": [{"key": "account_id", "label": "Account ID", "env": "EXAMPLE_ACCOUNT_ID"}],
       # base_url may contain {account_id} placeholders filled from extra fields
       "models": [m("model-id", "Nice name", [C, V, R, F], 128000, free=True)],
   }
   ```
   Capabilities: `C` chat, `V` vision, `R` reasoning, `F` fast, `L` long context. Vision models must really accept `image_url` content parts.
3. Keep Ollama last (`priority` 1000). Local providers set `"requires_key": False, "is_local": True` and usually `"default_enabled": False`.
4. Add the env var (empty) to `backend/.env.example` under "Provider API keys".
5. Restart the backend: `sync_catalog` inserts new providers/models without touching user edits.
6. Verify: `GET /api/ai/providers` lists it; save a key in the UI; **Test**; check `GET /api/ai/routing/preview?task=vision`.
7. Update the provider table in `docs/AI_PROVIDERS.md` and the counts in `README.md` / `CLAUDE.md`.

A provider with a non-OpenAI protocol needs a new function in `services/llm/client.py` and a branch in `router.call_candidate` (see `ollama_chat`).
