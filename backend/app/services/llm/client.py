"""Low-level HTTP calls to LLM providers (OpenAI-compatible and Ollama native)."""
import time
from dataclasses import dataclass

import httpx


class LLMError(Exception):
    """Raised for any provider failure. `kind` drives the router's fallback decision."""

    def __init__(self, kind: str, message: str, retry_after: float | None = None):
        super().__init__(message)
        self.kind = kind  # rate_limited | auth | bad_request | timeout | error
        self.retry_after = retry_after


@dataclass
class ChatMessage:
    role: str
    text: str
    images_b64: list[str] | None = None  # base64 JPEG/PNG (no data: prefix)
    mime: str = "image/jpeg"


@dataclass
class LLMResult:
    text: str
    latency_ms: float


def _openai_messages(messages: list[ChatMessage]) -> list[dict]:
    out = []
    for msg in messages:
        if msg.images_b64:
            parts: list[dict] = [{"type": "text", "text": msg.text}]
            parts += [
                {"type": "image_url", "image_url": {"url": f"data:{msg.mime};base64,{img}"}} for img in msg.images_b64
            ]
            out.append({"role": msg.role, "content": parts})
        else:
            out.append({"role": msg.role, "content": msg.text})
    return out


def _raise_for_status(resp: httpx.Response) -> None:
    if resp.status_code < 400:
        return
    body = resp.text[:400]
    if resp.status_code == 429:
        retry = resp.headers.get("retry-after")
        try:
            retry_after = float(retry) if retry else None
        except ValueError:
            retry_after = None
        raise LLMError("rate_limited", f"429 rate limited: {body}", retry_after)
    if resp.status_code in (401, 403):
        raise LLMError("auth", f"{resp.status_code} unauthorized: {body}")
    if resp.status_code in (400, 404, 422):
        raise LLMError("bad_request", f"{resp.status_code}: {body}")
    raise LLMError("error", f"{resp.status_code}: {body}")


async def openai_chat(
    *,
    base_url: str,
    api_key: str | None,
    model: str,
    messages: list[ChatMessage],
    timeout: float,
    max_tokens: int = 2048,
    temperature: float = 0.2,
    headers: dict | None = None,
) -> LLMResult:
    url = base_url.rstrip("/") + "/chat/completions"
    hdrs = {"Content-Type": "application/json", **(headers or {})}
    if api_key:
        hdrs["Authorization"] = f"Bearer {api_key}"
    payload = {
        "model": model,
        "messages": _openai_messages(messages),
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=hdrs)
    except httpx.TimeoutException as exc:
        raise LLMError("timeout", f"timed out after {timeout}s") from exc
    except httpx.HTTPError as exc:
        raise LLMError("error", f"connection error: {exc}") from exc
    _raise_for_status(resp)
    try:
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise LLMError("error", f"unexpected response: {resp.text[:300]}") from exc
    if isinstance(content, list):  # some providers return content parts
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    if not content:
        raise LLMError("error", "empty response")
    return LLMResult(text=content, latency_ms=(time.perf_counter() - start) * 1000)


async def ollama_chat(
    *,
    base_url: str,
    model: str,
    messages: list[ChatMessage],
    timeout: float,
    json_mode: bool = False,
) -> LLMResult:
    payload: dict = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": msg.role, "content": msg.text, **({"images": msg.images_b64} if msg.images_b64 else {})}
            for msg in messages
        ],
        "options": {"temperature": 0.2},
    }
    if json_mode:
        payload["format"] = "json"
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=max(timeout, 180)) as client:
            resp = await client.post(base_url.rstrip("/") + "/api/chat", json=payload)
    except httpx.TimeoutException as exc:
        raise LLMError("timeout", "Ollama timed out") from exc
    except httpx.HTTPError as exc:
        raise LLMError("error", f"Ollama unreachable: {exc}") from exc
    _raise_for_status(resp)
    content = (resp.json().get("message") or {}).get("content", "")
    if not content:
        raise LLMError("error", "empty response")
    return LLMResult(text=content, latency_ms=(time.perf_counter() - start) * 1000)
