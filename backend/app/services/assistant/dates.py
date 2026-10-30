"""Finds the days a question is about: "yesterday", "1 week ago", "last monday", "20 oct", "2026-10-26", "day 2".

Pure (no I/O) so it can be unit-tested; `today` is the profile's "today".
"""
import re
from datetime import date, timedelta

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
NUMBER_WORDS = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}

_NUM = r"(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)"
_MONTH = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*"


def _num(token: str) -> int:
    return int(token) if token.isdigit() else NUMBER_WORDS[token]


def _safe(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _calendar(day: int, month: int, today: date) -> date | None:
    """A day/month without a year: this year, or last year if that would be in the future."""
    d = _safe(today.year, month, day)
    if d and d > today:
        d = _safe(today.year - 1, month, day)
    return d


def find_dates(text: str, today: date, start_date: date | None = None) -> list[date]:
    """Every day mentioned in `text`, in order of appearance, without duplicates."""
    t = text.lower()
    found: list[tuple[int, date]] = []

    def add(pos: int, d: date | None):
        if d is not None:
            found.append((pos, d))

    for m in re.finditer(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", t):
        add(m.start(), _safe(int(m.group(1)), int(m.group(2)), int(m.group(3))))
    # day/month[/year]; with dots only when the year is there, so "1.6 g/kg" is not a date
    for m in re.finditer(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b|\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b", t):
        g = m.groups()
        day, month, year = (g[0], g[1], g[2]) if g[0] else (g[3], g[4], g[5])
        year = int(year) if year else None
        if year is not None and year < 100:
            year += 2000
        d = _safe(year, int(month), int(day)) if year else _calendar(int(day), int(month), today)
        add(m.start(), d)  # day/month order (as used in India and the UK)
    for m in re.finditer(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?(?:\s+of)?\s+{_MONTH}\b", t):
        add(m.start(), _calendar(int(m.group(1)), MONTHS[m.group(2)[:3]], today))
    for m in re.finditer(rf"\b{_MONTH}\s+(\d{{1,2}})(?:st|nd|rd|th)?\b", t):
        add(m.start(), _calendar(int(m.group(2)), MONTHS[m.group(1)[:3]], today))

    for m in re.finditer(r"\bday before yesterday\b", t):
        add(m.start(), today - timedelta(days=2))
    for m in re.finditer(r"(?<!before )\byesterday\b", t):
        add(m.start(), today - timedelta(days=1))
    for m in re.finditer(r"\btoday\b", t):
        add(m.start(), today)
    for m in re.finditer(rf"\b{_NUM}\s+(day|days|week|weeks)\s+(ago|back|before)\b", t):
        n = _num(m.group(1))
        add(m.start(), today - timedelta(days=n * (7 if m.group(2).startswith("week") else 1)))
    for m in re.finditer(r"\b(?:(last|previous)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", t):
        target = WEEKDAYS.index(m.group(2))
        back = (today.weekday() - target) % 7
        if m.group(1) in ("last", "previous") and back == 0:
            back = 7
        add(m.start(2), today - timedelta(days=back))
    if start_date:
        for m in re.finditer(r"\bday\s+(\d{1,3})\b", t):
            add(m.start(), start_date + timedelta(days=int(m.group(1)) - 1))

    out: list[date] = []
    for _, d in sorted(found, key=lambda x: x[0]):
        if d <= today and d not in out:
            out.append(d)
    return out


def find_window(text: str) -> int | None:
    """A look-back window like "last 2 weeks" / "past 10 days" / "this month", in days."""
    t = text.lower()
    m = re.search(rf"\b(?:last|past|previous)\s+{_NUM}\s+(day|days|week|weeks|month|months)\b", t)
    if m:
        unit = m.group(2)
        return _num(m.group(1)) * (30 if unit.startswith("month") else 7 if unit.startswith("week") else 1)
    if re.search(r"\b(this|last|past) week\b", t):
        return 7
    if re.search(r"\b(this|last|past) month\b", t):
        return 30
    return None
