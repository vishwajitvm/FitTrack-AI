# AI providers, models & fallback routing

Diagram: [`diagram/llm-fallback-routing.mmd`](diagram/llm-fallback-routing.mmd)

## Free-only policy

FitTrack AI only ships providers whose models are **free for good with nothing but an API key** — no credit card, no trial credits that expire, no paid models. Every listed model is capable enough for the app's jobs: reading meal photos (vision) and reasoning about nutrition, training and lab reports.

Catalog: **7 free cloud providers, 54 cloud models** (33 can read images, 34 are reasoning-capable), plus local Ollama, LM Studio and a custom OpenAI-compatible slot. Source: `backend/app/services/llm/catalog.py`. Checked against provider docs and live model lists in **October 2026**.

Free tiers change often. When a model disappears, disable it or use **Sync models**. When a free tier ends, remove the provider from the catalog: startup then deletes its built-in models automatically.

## Providers

| Order | Provider | Get a free key | Free limits (approx.) | Reads photos? | Notes |
|---|---|---|---|---|---|
| 1 | **Google Gemini** | https://aistudio.google.com/app/apikey | Per-model daily caps | ✅ all models | Best free vision. Gemini 3.8/3.6/3 Flash, 2.5 Pro/Flash, Flash-Lite, Gemma 4. Not offered in EU/UK/CH. |
| 2 | **Groq** | https://console.groq.com/keys | ~30 req/min, ~1,000 req/day per model | ❌ | Fastest reasoning: GPT-OSS 120B/20B, Qwen 3.8 27B, Compound (built-in web search). |
| 3 | **OpenRouter** (`:free` only) | https://openrouter.ai/keys | 20 req/min, 50 req/day (1,000/day after a one-off $10 top-up) | ✅ most | Gemma 4 31B, Nemotron 3.5 Super VL, Inkling, Nemotron 3 Ultra 550B… The list rotates. |
| 4 | **Cloudflare Workers AI** | https://dash.cloudflare.com/profile/api-tokens (+ Account ID) | 10,000 neurons/day | ✅ many | Kimi K2.6, Qwen 3.8, Llama 4 Scout, GLM 5.3 Flash, GPT-OSS 120B, QwQ 32B. |
| 5 | **NVIDIA NIM** | https://build.nvidia.com/settings/api-keys | ~40 req/min | ✅ several | Free for prototyping. NVIDIA may retain prompts. Skip it if that matters to you. |
| 6 | **Mistral** (free plan) | https://console.mistral.ai/api-keys | Per-model caps | ✅ Medium/Large/Ministral | **Starts disabled**: the free plan allows training on your prompts. |
| 7 | **Z.ai** | https://z.ai/manage-apikey/apikey-list | Unpublished | ✅ GLM-4.6V-Flash | GLM-4.7/4.5-Flash and GLM-4.6V-Flash are free. |
| last | **Ollama** (local) | — | Your hardware | ✅ Gemma 3, Qwen2.5-VL, Llama 3.2 Vision | Slow on most PCs, so it is **only** tried after every cloud model fails. |

**Recommended setup:** Gemini + Groq + OpenRouter covers almost everything. Add Cloudflare for more daily headroom.

### Deliberately excluded

| Provider | Why |
|---|---|
| Cerebras | Free tier ended July 2026; now a 30-day trial that needs a card |
| GitHub Models | Retired July 2026 |
| Together AI, SambaNova, Fireworks, Scaleway, Hyperbolic, Novita, Nebius, Alibaba DashScope, AI21 | Paid, or one-time trial credits |
| Cohere | Only a "trial" key (1,000 calls/month, non-commercial) |
| Hugging Face | Just $0.10/month of credits |
| OpenAI, Anthropic, xAI, Perplexity, DeepSeek, Moonshot, Featherless, Chutes | Paid APIs |
| Keyless relays (Pollinations, LLM7, free "routers") | Your meals and blood reports would pass through unknown third parties |

## Where keys live

1. Keys typed in the UI are **encrypted** (Fernet, key derived from `SECRET_KEY`) in `ai_providers.api_key_encrypted`. The browser only ever sees a masked preview like `gsk_…a1b2`.
2. If there is no UI key, the backend uses the matching variable in `backend/.env` (e.g. `GROQ_API_KEY`).
3. Saving an empty key in the UI removes the stored key.

## Tasks & capabilities

| Task | Used by | Required capability | Preferred |
|---|---|---|---|
| `vision` | Meal photo analysis | vision | vision |
| `reasoning` | Text-only meal analysis, AI coach, gut insights | chat | reasoning |
| `fast` | Provider tests, playground | chat | fast |
| `medical` | Lab reports (vision if the report is an image) | chat / vision | reasoning |

## Fallback algorithm (`services/llm/router.py`)

1. **Pinned** models for the task (Routing tab).
2. **Cloud providers by priority** that are enabled and have a key: the best 2 matching models from each, breadth-first, then the remaining models. Capped at `max_attempts` (default 12).
3. **Ollama** installed models matching the capability (max 2), only if *Ollama last resort* is on.

Per attempt:

| Response | Action |
|---|---|
| 200 + valid output | Return. Logged as `success`. |
| 429 (free quota used up) | Model put on cooldown (Retry-After or 60 s, stored in Redis), next candidate |
| 401 / 403 | Whole provider skipped for this request (bad key) |
| Timeout / 5xx / invalid JSON | Next candidate |

Every attempt is written to `llm_call_logs` (Call logs tab).
If everything fails, the API returns a clear error; the coach and gut insights fall back to rule-based text.

**Sync models** adds models from a provider's `/models` endpoint. For OpenRouter it only adds `:free` models. Synced models start disabled, so you choose which join the chain.

## Ollama management

The **Ollama** page can check status and version, change the URL, list installed and running models, download from a curated library (or any tag) with live progress, cancel downloads, and delete models. Finished downloads are registered as router models automatically, with vision detected for Gemma 3, Llama 3.2 Vision, LLaVA, Qwen2.5-VL, Moondream and others.
