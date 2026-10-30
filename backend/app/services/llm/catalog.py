"""Built-in catalog of FREE LLM providers and models.

Policy: only providers whose models are free for good with nothing but an API key — no credit
card, no trial credits that expire, no paid models. Every listed model must be capable enough
for the app's jobs (meal-photo vision, nutrition and lab-report reasoning). Verified against
provider docs and live model lists in October 2026. Free tiers change: re-check before adding
models (see the `add-llm-provider` skill), and use "Sync models" in the UI for rotating lists.

Almost every provider speaks the OpenAI `/chat/completions` protocol, so one client handles
them all; Ollama uses its native API.

Capabilities: chat, vision, reasoning, fast, long_context.
"""

C = "chat"
V = "vision"
R = "reasoning"
F = "fast"
L = "long_context"


def m(model_id: str, name: str, caps: list[str], ctx: int | None = None, free: bool = True) -> dict:
    return {"model_id": model_id, "display_name": name, "capabilities": caps, "context_window": ctx, "free": free}


PROVIDERS: list[dict] = [
    {
        "id": "gemini", "name": "Google Gemini (AI Studio)", "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "website": "https://ai.google.dev", "key_url": "https://aistudio.google.com/app/apikey", "env_key": "GEMINI_API_KEY",
        "free_tier": True, "priority": 5,
        "free_tier_note": "Free forever via AI Studio, no card (per-model daily limits; not offered in the EU/UK/CH). Best free vision for meal photos.",
        "models": [
            m("gemini-3.8-flash", "Gemini 3.8 Flash", [C, V, R, L], 1048576),
            m("gemini-3.6-flash", "Gemini 3.6 Flash", [C, V, R, L], 1048576),
            m("gemini-2.5-flash", "Gemini 2.5 Flash", [C, V, R, L], 1048576),
            m("gemini-3-flash-preview", "Gemini 3 Flash (preview)", [C, V, R, L], 1048576),
            m("gemini-2.5-pro", "Gemini 2.5 Pro (low daily limit)", [C, V, R, L], 1048576),
            m("gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite", [C, V, F, L], 1048576),
            m("gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite", [C, V, F, L], 1048576),
            m("gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite", [C, V, F, L], 1048576),
            m("gemma-4-31b-it", "Gemma 4 31B", [C, V, R], 262144),
            m("gemma-4-26b-a4b-it", "Gemma 4 26B A4B", [C, V, F], 262144),
        ],
    },
    {
        "id": "groq", "name": "Groq", "base_url": "https://api.groq.com/openai/v1",
        "website": "https://groq.com", "key_url": "https://console.groq.com/keys", "env_key": "GROQ_API_KEY",
        "free_tier": True, "priority": 10,
        "free_tier_note": "Free plan, no card (~30 req/min, ~1,000 req/day per model). Extremely fast text & reasoning; no vision on the free plan.",
        "models": [
            m("openai/gpt-oss-120b", "GPT-OSS 120B", [C, R], 131072),
            m("qwen/qwen3.8-27b", "Qwen 3.8 27B", [C, R], 131072),
            m("groq/compound", "Groq Compound (with web search)", [C, R], 131072),
            m("openai/gpt-oss-20b", "GPT-OSS 20B", [C, R, F], 131072),
            m("groq/compound-mini", "Groq Compound Mini", [C, F], 131072),
        ],
    },
    {
        "id": "openrouter", "name": "OpenRouter (free models only)", "base_url": "https://openrouter.ai/api/v1",
        "website": "https://openrouter.ai", "key_url": "https://openrouter.ai/keys", "env_key": "OPENROUTER_API_KEY",
        "free_tier": True, "priority": 15, "headers": {"HTTP-Referer": "http://localhost:3000", "X-Title": "FitTrack AI"},
        "free_tier_note": "Only `:free` models (~20 req/min, 50 req/day without buying credit). The free line-up rotates; use Sync models.",
        "models": [
            m("google/gemma-4-31b-it:free", "Gemma 4 31B (free)", [C, V, R], 262144),
            m("nvidia/nemotron-3.5-super-vl:free", "Nemotron 3.5 Super VL (free)", [C, V, R, L], 1000000),
            m("thinkingmachines/inkling:free", "Inkling (free)", [C, V, R, L], 1048576),
            m("nvidia/nemotron-3-ultra-550b-a55b:free", "Nemotron 3 Ultra 550B (free)", [C, R, L], 1000000),
            m("nvidia/nemotron-3-super-120b-a12b:free", "Nemotron 3 Super 120B (free)", [C, R], 262144),
            m("dots-studio/dots-3-note-preview:free", "dots.3 note (free preview)", [C, V, R], 512000),
            m("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "Nemotron 3 Nano Omni 30B (free)", [C, V, R, F], 256000),
            m("google/gemma-4-26b-a4b-it:free", "Gemma 4 26B A4B (free)", [C, V, F], 262144),
            m("thinkingmachines/inkling-small:free", "Inkling Small (free)", [C, V, F, L], 1048576),
            m("nvidia/nemotron-3.5-lightning:free", "Nemotron 3.5 Lightning (free)", [C, F, L], 1000000),
            m("openrouter/free", "OpenRouter auto-pick (free)", [C, V], 200000),
        ],
    },
    {
        "id": "cloudflare", "name": "Cloudflare Workers AI",
        "base_url": "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
        "website": "https://developers.cloudflare.com/workers-ai", "key_url": "https://dash.cloudflare.com/profile/api-tokens",
        "env_key": "CLOUDFLARE_API_TOKEN", "extra_fields": [{"key": "account_id", "label": "Account ID", "env": "CLOUDFLARE_ACCOUNT_ID"}],
        "free_tier": True, "priority": 20,
        "free_tier_note": "10,000 free neurons every day on every account, no card. Needs your Account ID as well as an API token.",
        "models": [
            m("@cf/moonshotai/kimi-k2.6", "Kimi K2.6 (vision)", [C, V, R, L], 262144),
            m("@cf/qwen/qwen3.8-27b", "Qwen 3.8 27B (vision)", [C, V, R], 131072),
            m("@cf/meta/llama-4-scout-17b-16e-instruct", "Llama 4 Scout (vision)", [C, V, F], 131000),
            m("@cf/zai-org/glm-5.3-flash", "GLM 5.3 Flash (vision)", [C, V, F], 131072),
            m("@cf/google/gemma-4-26b-a4b-it", "Gemma 4 26B A4B", [C, V, F], 131072),
            m("@cf/mistralai/mistral-small-3.1-24b-instruct", "Mistral Small 3.1 (vision)", [C, V, F], 128000),
            m("@cf/openai/gpt-oss-120b", "GPT-OSS 120B", [C, R], 128000),
            m("@cf/qwen/qwq-32b", "QwQ 32B (reasoning)", [C, R], 32768),
            m("@cf/meta/llama-3.3-70b-instruct-fp8-fast", "Llama 3.3 70B fast", [C, R, F], 24000),
            m("@cf/zai-org/glm-4.7-flash", "GLM 4.7 Flash", [C, F], 131072),
        ],
    },
    {
        "id": "nvidia", "name": "NVIDIA NIM (build.nvidia.com)", "base_url": "https://integrate.api.nvidia.com/v1",
        "website": "https://build.nvidia.com", "key_url": "https://build.nvidia.com/settings/api-keys", "env_key": "NVIDIA_API_KEY",
        "free_tier": True, "priority": 25,
        "free_tier_note": "Free endpoints for development/prototyping (~40 req/min), no card. NVIDIA may retain prompts; skip it if privacy matters.",
        "models": [
            m("nvidia/nemotron-3.5-super-vl-120b-a12b", "Nemotron 3.5 Super VL 120B", [C, V, R], 1000000),
            m("google/gemma-4-31b-it", "Gemma 4 31B", [C, V, R], 262144),
            m("moonshotai/kimi-k2.6", "Kimi K2.6", [C, V, R, L], 262144),
            m("z-ai/glm-5.3", "GLM 5.3", [C, R], 131072),
            m("deepseek-ai/deepseek-v4.1-flash", "DeepSeek V4.1 Flash", [C, R, F], 131072),
            m("nvidia/nemotron-3-ultra-550b-a55b", "Nemotron 3 Ultra 550B", [C, R, L], 1000000),
            m("z-ai/glm-5.3-flash", "GLM 5.3 Flash (vision)", [C, V, F], 131072),
            m("minimaxai/minimax-m3.1-flash", "MiniMax M3.1 Flash", [C, R, F], 196608),
            m("meta/llama-3.2-90b-vision-instruct", "Llama 3.2 90B Vision", [C, V], 128000),
            m("nvidia/nemotron-3.5-lightning-30b-a3b", "Nemotron 3.5 Lightning 30B", [C, F], 1000000),
            m("openai/gpt-oss-20b", "GPT-OSS 20B", [C, R, F], 131072),
        ],
    },
    {
        "id": "mistral", "name": "Mistral AI (free plan)", "base_url": "https://api.mistral.ai/v1",
        "website": "https://mistral.ai", "key_url": "https://console.mistral.ai/api-keys", "env_key": "MISTRAL_API_KEY",
        "free_tier": True, "priority": 30, "default_enabled": False,
        "free_tier_note": "Free plan, no card (phone verification). The free plan lets Mistral train on your prompts, so it starts disabled.",
        "models": [
            m("mistral-medium-latest", "Mistral Medium (vision)", [C, V, R], 131072),
            m("mistral-large-latest", "Mistral Large (vision)", [C, V, R], 262144),
            m("mistral-small-latest", "Mistral Small (reasoning)", [C, R, F], 131072),
            m("ministral-8b-latest", "Ministral 8B (vision)", [C, V, F], 131072),
        ],
    },
    {
        "id": "zai", "name": "Z.ai (GLM Flash, free)", "base_url": "https://api.z.ai/api/paas/v4",
        "website": "https://z.ai", "key_url": "https://z.ai/manage-apikey/apikey-list", "env_key": "ZAI_API_KEY",
        "free_tier": True, "priority": 35,
        "free_tier_note": "GLM-4.7-Flash, GLM-4.5-Flash and GLM-4.6V-Flash are free; limits are not published.",
        "models": [
            m("glm-4.6v-flash", "GLM-4.6V Flash (vision)", [C, V], 131072),
            m("glm-4.7-flash", "GLM-4.7 Flash", [C, R, F], 131072),
            m("glm-4.5-flash", "GLM-4.5 Flash", [C, F], 131072),
        ],
    },
    {
        "id": "lmstudio", "name": "LM Studio (local)", "base_url": "http://localhost:1234/v1",
        "website": "https://lmstudio.ai", "key_url": None, "env_key": None, "requires_key": False, "is_local": True,
        "free_tier": True, "free_tier_note": "Runs on your machine. Disabled by default.",
        "priority": 900, "default_enabled": False,
        "models": [m("local-model", "Currently loaded LM Studio model", [C], None)],
    },
    {
        "id": "custom", "name": "Custom OpenAI-compatible", "base_url": "http://localhost:8080/v1",
        "website": None, "key_url": None, "env_key": "CUSTOM_LLM_API_KEY", "requires_key": False,
        "free_tier": True, "free_tier_note": "Any self-hosted server that implements /v1/chat/completions (vLLM, LocalAI, llama.cpp…).",
        "priority": 910, "default_enabled": False,
        "models": [],
    },
    {
        "id": "ollama", "name": "Ollama (local, last resort)", "kind": "ollama", "base_url": "http://localhost:11434",
        "website": "https://ollama.com", "key_url": None, "env_key": None, "requires_key": False, "is_local": True,
        "free_tier": True, "free_tier_note": "Runs locally and is slow on most PCs, so it is only tried after every cloud model fails.",
        "priority": 1000,
        "models": [
            m("gemma3:4b", "Gemma 3 4B (vision)", [C, V, F], 131072),
            m("qwen2.5vl:7b", "Qwen2.5-VL 7B (vision)", [C, V], 32768),
            m("llama3.2-vision:11b", "Llama 3.2 Vision 11B", [C, V], 131072),
            m("qwen2.5:7b", "Qwen2.5 7B", [C, R], 32768),
            m("qwen3:8b", "Qwen3 8B", [C, R], 40960),
            m("llama3.2:3b", "Llama 3.2 3B", [C, F], 131072),
            m("phi4-mini", "Phi-4 mini", [C, F], 131072),
        ],
    },
]

PROVIDERS_BY_ID = {p["id"]: p for p in PROVIDERS}

# Name fragments used to guess capabilities for models discovered via "Sync models".
_VISION_HINTS = ["vision", "-vl", "vl-", "vl:", "omni", "pixtral", "llava", "gemini", "gemma-3", "gemma3", "gemma-4", "gemma4",
                 "llama-4", "llama4", "scout", "maverick", "moondream", "minicpm-v", "qwen2.5vl", "4.6v", "4.5v", "inkling",
                 "kimi-k2.6", "glm-5.3-flash"]
_REASONING_HINTS = ["r1", "reasoner", "reasoning", "qwq", "thinking", "magistral", "gpt-oss", "70b", "72b", "120b", "235b", "550b",
                    "large", "pro", "ultra", "super", "compound", "glm-5", "kimi", "deepseek"]
_FAST_HINTS = ["8b", "7b", "3b", "4b", "a3b", "a4b", "mini", "flash", "lite", "instant", "nano", "small", "lightning", "turbo"]


def guess_capabilities(model_id: str) -> list[str]:
    lowered = model_id.lower()
    caps = [C]
    if any(h in lowered for h in _VISION_HINTS):
        caps.append(V)
    if any(h in lowered for h in _REASONING_HINTS):
        caps.append(R)
    if any(h in lowered for h in _FAST_HINTS):
        caps.append(F)
    return caps


def is_free_model_id(provider_id: str, model_id: str) -> bool:
    """For "Sync models": OpenRouter mixes paid and free models; only `:free` ones are free."""
    if provider_id == "openrouter":
        return model_id.endswith(":free") or model_id == "openrouter/free"
    return True


def total_models() -> int:
    return sum(len(p["models"]) for p in PROVIDERS)
