"""Robust extraction of a JSON object from LLM output (code fences, <think> blocks, prose)."""
import json
import re

_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def extract_json(text: str) -> dict:
    cleaned = _THINK.sub("", text).strip()
    candidates = [m.group(1) for m in _FENCE.finditer(cleaned)] + [cleaned]
    for candidate in candidates:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start == -1 or end <= start:
            continue
        chunk = candidate[start : end + 1]
        for attempt in (chunk, re.sub(r",\s*([}\]])", r"\1", chunk)):  # tolerate trailing commas
            try:
                value = json.loads(attempt)
                if isinstance(value, dict):
                    return value
            except json.JSONDecodeError:
                continue
    raise ValueError("No JSON object found in model output")


def strip_think(text: str) -> str:
    return _THINK.sub("", text).strip()
