"""Deterministic character-trigram hashing embeddings (256-d, L2-normalised).

They power fuzzy food search ("fried rce" → "Vegetable fried rice") on pgvector without
needing an embedding API. This is lexical similarity, not deep semantics.
"""
import hashlib
import math
import re

from app.db.base import EMBEDDING_DIM


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    grams: list[str] = []
    for w in words:
        padded = f"#{w}#"
        grams.extend(padded[i : i + 3] for i in range(max(1, len(padded) - 2)))
        grams.append(f"w:{w}")
    return grams


def embed(text: str) -> list[float]:
    vec = [0.0] * EMBEDDING_DIM
    for gram in _tokens(text):
        h = int(hashlib.md5(gram.encode()).hexdigest(), 16)
        vec[h % EMBEDDING_DIM] += 1.0 if (h >> 8) & 1 else -1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))
