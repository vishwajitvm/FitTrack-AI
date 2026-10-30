"""Keyword tagging of foods for the gut-health correlation engine.

Tags: lactose, gluten, refined_flour, fried, caffeine, high_sodium, legumes, spicy, late_night.
"""

TAG_KEYWORDS: dict[str, list[str]] = {
    "lactose": ["milk", "chai", "whey", "paneer", "curd", "dahi", "cheese", "lassi", "ice cream", "kheer", "yogurt", "butter", "ghee", "cream"],
    "gluten": ["wheat", "bread", "sandwich", "roti", "chapati", "paratha", "naan", "pasta", "macaroni", "maida", "biscuit", "noodle", "pizza", "burger", "samosa", "suji", "rava", "upma", "puri", "atta"],
    "refined_flour": ["maida", "white bread", "sandwich", "pasta", "macaroni", "noodle", "biscuit", "pizza", "naan", "samosa", "cake", "pav", "bun", "burger"],
    "fried": ["fried", "tadka", "pakora", "pakoda", "samosa", "puri", "poori", "chips", "fries", "bhaji", "vada", "paratha"],
    "caffeine": ["coffee", "chai", "tea", "cola", "energy drink", "pre-workout"],
    "high_sodium": ["pickle", "achar", "chips", "namkeen", "papad", "instant noodle", "maggi", "soy sauce"],
    "legumes": ["rajma", "chole", "chana", "dal", "daal", "beans", "lentil", "sprouts", "moong"],
    "spicy": ["chilli", "chili", "mirchi", "spicy", "schezwan"],
}

# Lactose-free variants that should NOT get the lactose tag.
LACTOSE_EXCEPTIONS = ["isolate", "lactose free", "lactose-free", "black coffee", "black tea", "green tea"]


def _minutes(hhmm: str | None) -> int | None:
    if not hhmm or ":" not in hhmm:
        return None
    try:
        h, m = hhmm.split(":")[:2]
        return int(h) * 60 + int(m)
    except ValueError:
        return None


def infer_tags(name: str, ingredients: list[str] | None = None, extra: list[str] | None = None) -> list[str]:
    text = " ".join([name, *(ingredients or [])]).lower()
    tags = set(extra or [])
    for tag, words in TAG_KEYWORDS.items():
        if any(w in text for w in words):
            tags.add(tag)
    if "lactose" in tags and any(x in text for x in LACTOSE_EXCEPTIONS):
        tags.discard("lactose")
    if "black coffee" in text:
        tags.discard("lactose")
    return sorted(tags)


def is_late(time: str | None, bedtime: str | None, window_min: int = 60) -> bool:
    """A meal within `window_min` minutes of bedtime (or after 21:00 if bedtime unknown)."""
    t = _minutes(time)
    if t is None:
        return False
    bed = _minutes(bedtime) or 22 * 60
    return t >= bed - window_min or t >= 21 * 60


def add_time_tags(tags: list[str], time: str | None, bedtime: str | None) -> list[str]:
    result = [t for t in tags if t != "late_night"]
    if is_late(time, bedtime):
        result.append("late_night")
    return sorted(set(result))


def minutes_of(hhmm: str | None) -> int | None:
    return _minutes(hhmm)
