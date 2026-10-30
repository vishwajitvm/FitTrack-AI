"""Shared field helpers for request schemas."""
from typing import Annotated

from pydantic import AfterValidator, StringConstraints


def to_hhmm(value: str | None) -> str | None:
    """Accepts "HH:MM", "HH:MM:SS" or an ISO datetime and returns "HH:MM"."""
    if not value:
        return None
    if "T" in value:
        value = value.split("T", 1)[1]
    return value[:5]


# A wall-clock time stored as "HH:MM".
ClockTime = Annotated[str, AfterValidator(to_hhmm)]


def limited(max_length: int):
    """A trimmed string with a maximum length (matches the DB column size)."""
    return Annotated[str, StringConstraints(strip_whitespace=True, max_length=max_length)]
