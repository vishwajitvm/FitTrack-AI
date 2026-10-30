"""Checks that every number in an AI answer comes from the facts it was given (allowing rounding).

A fast model sometimes slips a digit ("3,015 kcal" for 3,002); an answer with such a number is re-asked on a
stronger model. Pure (text in, list out).
"""
import re

_NUMBER = re.compile(r"(?<![\w.])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])\d+(?:\.\d+)?")
SMALL_FREE = 31  # day-of-month, weeks, counts, "1–2 weeks"… are not checked
YEARS = range(2020, 2041)


def _value(token: str) -> float:
    return float(token.replace(",", ""))


def _forms(v: float) -> set[float]:
    """The ways a number can legitimately appear after rounding (to 0, 1 or 2 decimals, or the nearest 10/100)."""
    out = {round(v, 2), round(v, 1), float(round(v))}
    if abs(v) >= 100:
        out |= {float(round(v, -1)), float(round(v, -2))}
    return out


def allowed_numbers(*sources: str) -> set[float]:
    allowed: set[float] = set()
    for text in sources:
        for token in _NUMBER.findall(text):
            v = _value(token)
            allowed |= _forms(v) | _forms(-v)
    return allowed


def ungrounded(answer: str, allowed: set[float]) -> list[str]:
    """Numbers in `answer` that cannot be traced to `allowed` (small integers and years are skipped)."""
    bad = []
    for token in _NUMBER.findall(answer):
        v = _value(token)
        if v.is_integer() and (v <= SMALL_FREE or int(v) in YEARS):
            continue
        if round(v, 2) not in allowed:  # the number as written must be a rounding of a known number
            bad.append(token)
    return bad
