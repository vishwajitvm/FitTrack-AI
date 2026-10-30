"""Typed-meal parser: "2 roti, 1 katori dal and a glass of buttermilk" → logged items, no LLM.

1. Split on commas / "and" / "+" / "with" / newlines.
2. Read quantity (digits, fractions, words like "half", "two") and unit (g, ml, katori, cup…).
3. Match the remaining words to the food library with hybrid (trigram + semantic) search.
4. Grams = quantity × unit size (or the food's typical serving when no unit is given).
Parts that don't match confidently are returned as `unparsed`, and `needs_ai` is set.
"""
import re
from fractions import Fraction

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.services.nutrition import search
from app.services.nutrition.tagging import infer_tags

MATCH_THRESHOLD = 0.55

NUMBER_WORDS = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "half": 0.5, "quarter": 0.25, "couple": 2, "few": 3, "dozen": 12, "½": 0.5, "¼": 0.25,
}

# Unit → grams (or ml ≈ g). Units that describe a single item use the food's own serving.
UNIT_GRAMS = {
    "g": 1, "gm": 1, "gms": 1, "gram": 1, "grams": 1, "kg": 1000, "ml": 1, "l": 1000, "litre": 1000, "liter": 1000,
    "katori": 150, "katoris": 150, "bowl": 250, "bowls": 250, "cup": 200, "cups": 200, "glass": 250, "glasses": 250,
    "plate": 250, "plates": 250, "tiffin": 300, "tiffins": 300, "tbsp": 15, "tablespoon": 15, "tablespoons": 15,
    "tsp": 5, "teaspoon": 5, "teaspoons": 5, "scoop": 33, "scoops": 33, "slice": 30, "slices": 30,
    "handful": 30, "ladle": 60, "mug": 250, "can": 330,
}
PIECE_UNITS = {"piece", "pieces", "pc", "pcs", "no", "nos", "x"}

# Typical single serving by library category (used when no unit is given).
CATEGORY_SERVING_G = {
    "cooked_rice": 150, "bread": 40, "pasta": 150, "curry": 150, "sabzi": 120, "dry_dish": 150, "porridge": 200,
    "protein": 100, "supplement": 33, "beverage": 200, "dairy": 150, "fruit": 120, "salad": 100, "vegetable": 150,
    "nuts": 15, "fat": 5, "sugar": 5, "condiment": 30, "snack": 80, "fast_food": 150, "dessert": 40,
    "dry_ingredient": 30, "mixed": 150,
}
# Foods counted in pieces whose single-piece weight differs from the category default.
PIECE_GRAMS = {"egg": 50, "egg white": 33, "idli": 40, "roti": 40, "chapati": 40, "phulka": 35, "paratha": 80,
               "puri": 25, "dosa": 90, "banana": 118, "apple": 180, "orange": 130, "date": 24, "samosa": 90,
               "biscuit": 7, "bread": 28, "sandwich": 100, "chilla": 80, "almond": 1.2}

_SPLIT = re.compile(r",|;|\n|\+|\band\b|\bwith\b|&", re.IGNORECASE)
_QTY = re.compile(r"^\s*(\d+(?:\.\d+)?(?:\s*/\s*\d+)?|\d+\s+\d+/\d+|[½¼])\s*", re.IGNORECASE)


def _to_number(token: str) -> float:
    token = token.strip()
    if token in NUMBER_WORDS:
        return NUMBER_WORDS[token]
    if " " in token:  # "1 1/2"
        whole, frac = token.split()
        return float(whole) + float(Fraction(frac))
    return float(Fraction(token.replace(" ", "")))


def split_parts(text: str) -> list[str]:
    return [p.strip(" .") for p in _SPLIT.split(text) if p and p.strip(" .")]


def parse_quantity(part: str) -> tuple[float | None, str | None, str]:
    """Returns (quantity, unit, food words)."""
    rest = part.strip().lower()
    quantity = None
    match = _QTY.match(rest)
    if match:
        quantity = _to_number(match.group(1))
        rest = rest[match.end():]
    else:
        first = rest.split(" ", 1)[0]
        if first in NUMBER_WORDS:
            quantity = NUMBER_WORDS[first]
            rest = rest[len(first):].strip()
    # "200g rice", "200 g rice", "2 katori of dal"
    unit = None
    unit_match = re.match(r"^([a-z½¼]+)\b\.?\s*(?:of\s+)?", rest)
    if unit_match and (unit_match.group(1) in UNIT_GRAMS or unit_match.group(1) in PIECE_UNITS):
        unit = unit_match.group(1)
        rest = rest[unit_match.end():]
    rest = re.sub(r"^(of|a|an)\s+", "", rest).strip()
    return quantity, unit, rest


def _piece_weight(name: str, matched: str) -> float | None:
    text = f"{name} {matched}".lower()
    for word, grams in PIECE_GRAMS.items():
        if word in text:
            return grams
    return None


SUPPLEMENT_WORDS = ("scoop", "whey", "protein shake", "protein powder", "isolate")


def supplement_item(user: User | None, part: str, quantity: float | None) -> dict | None:
    """'1 scoop whey' → the protein powder saved in the user's profile (exact label values)."""
    if user is None or not user.protein_per_scoop_g or not any(w in part.lower() for w in SUPPLEMENT_WORDS):
        return None
    qty = quantity or 1
    name = user.protein_supplement_name or "Protein powder"
    tags = [] if (user.protein_supplement_type or "").endswith("isolate") or user.protein_supplement_type == "plant" else ["lactose"]
    return {
        "text": part,
        "name": f"{name} ({qty:g} scoop{'s' if qty != 1 else ''})",
        "quantity": qty,
        "unit": "scoop",
        "grams": round(qty * (user.scoop_size_g or 30)),
        "calories": round(qty * (user.calories_per_scoop or 0)),
        "protein": round(qty * user.protein_per_scoop_g, 1),
        "carbs": round(qty * (user.carbs_per_scoop_g or 0), 1),
        "fat": round(qty * (user.fat_per_scoop_g or 0), 1),
        "fibre": 0.0,
        "source": "Your protein powder (Profile)",
        "confidence": 0.97,
        "tags": tags,
    }


async def parse(db: AsyncSession, text: str, user: User | None = None) -> dict:
    items, unparsed = [], []
    for part in split_parts(text):
        quantity, unit, food_words = parse_quantity(part)
        scoop = supplement_item(user, part, quantity)
        if scoop is not None:
            items.append(scoop)
            continue
        if not food_words:
            unparsed.append(part)
            continue
        hits = await search.search_library(db, food_words, limit=1)
        if not hits or hits[0]["confidence"] < MATCH_THRESHOLD:
            unparsed.append(part)
            continue
        hit = hits[0]
        qty = quantity or 1
        if unit in UNIT_GRAMS:
            grams = qty * UNIT_GRAMS[unit]
        else:
            per_piece = _piece_weight(food_words, hit["name"]) or CATEGORY_SERVING_G.get(hit.get("category", "mixed"), 150)
            grams = qty * per_piece
        per = hit["per_100g"]
        items.append(
            {
                "text": part,
                "name": hit["name"],
                "quantity": qty,
                "unit": unit or ("piece" if _piece_weight(food_words, hit["name"]) else "serving"),
                "grams": round(grams),
                "calories": round(per["calories"] * grams / 100),
                "protein": round(per["protein"] * grams / 100, 1),
                "carbs": round(per["carbs"] * grams / 100, 1),
                "fat": round(per["fat"] * grams / 100, 1),
                "fibre": round(per["fibre"] * grams / 100, 1),
                "source": f"{hit['source']} ({hit.get('match', 'lexical')} match)",
                "confidence": round(hit["confidence"] * (0.95 if quantity else 0.85), 2),
                "tags": infer_tags(hit["name"], [food_words], hit.get("tags")),
            }
        )
    total = len(items) + len(unparsed)
    confidence = round(sum(i["confidence"] for i in items) / total, 2) if total else 0.0
    return {
        "items": items,
        "unparsed": unparsed,
        "confidence": confidence,
        "needs_ai": bool(unparsed) or not items,
        "method": "rules+embeddings",
    }
