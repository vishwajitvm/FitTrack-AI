"""Container presets and volume → weight geometry for portion estimation.

The photo analyzer combines three signals for weight: what the vision model sees,
this geometric estimate (container volume × fill level × food density), and any
known weight the user typed. A known weight always wins.
"""
import math

FILL_FRACTIONS = {"quarter": 0.25, "half": 0.5, "three_quarter": 0.75, "full": 0.95, "heaped": 1.15}

# Average food height on a flat plate (cm) used to turn plate area into volume.
PLATE_FOOD_HEIGHT_CM = 1.5

# Bulk density (g per ml) by food category, as served.
CATEGORY_DENSITY = {
    "cooked_rice": 0.70,
    "pasta": 0.60,
    "curry": 1.00,
    "porridge": 0.95,
    "sabzi": 0.60,
    "dry_dish": 0.60,
    "salad": 0.30,
    "beverage": 1.02,
    "dairy": 1.03,
    "fruit": 0.60,
    "mixed": 0.75,
}


def _plate_volume(diameter_cm: float) -> float:
    radius = diameter_cm / 2
    return round(math.pi * radius * radius * PLATE_FOOD_HEIGHT_CM)


CONTAINERS: list[dict] = [
    {"id": "tiffin_small", "label": "Steel tiffin – small", "category": "tiffin", "volume_ml": 350, "diameter_cm": 11, "description": "Single small round steel box (~350 ml)"},
    {"id": "tiffin_medium", "label": "Steel tiffin – medium", "category": "tiffin", "volume_ml": 500, "diameter_cm": 13, "description": "Standard round steel tiffin (~500 ml)"},
    {"id": "tiffin_large", "label": "Steel tiffin – large", "category": "tiffin", "volume_ml": 750, "diameter_cm": 14, "description": "Large / deep round tiffin (~750 ml)"},
    {"id": "lunchbox_500", "label": "Rectangular lunch box 500 ml", "category": "box", "volume_ml": 500, "diameter_cm": None, "description": "Plastic/glass meal-prep box"},
    {"id": "lunchbox_1000", "label": "Rectangular lunch box 1 L", "category": "box", "volume_ml": 1000, "diameter_cm": None, "description": "Large meal-prep box"},
    {"id": "plate_quarter_7in", "label": "Quarter plate (7 in / 18 cm)", "category": "plate", "volume_ml": _plate_volume(18), "diameter_cm": 18, "description": "Small side plate"},
    {"id": "plate_dinner_10in", "label": "Dinner plate (10 in / 25 cm)", "category": "plate", "volume_ml": _plate_volume(25), "diameter_cm": 25, "description": "Standard dinner plate"},
    {"id": "plate_dinner_11in", "label": "Dinner plate (11 in / 28 cm)", "category": "plate", "volume_ml": _plate_volume(28), "diameter_cm": 28, "description": "Large dinner plate"},
    {"id": "thali_12in", "label": "Steel thali (12 in / 30 cm)", "category": "plate", "volume_ml": _plate_volume(30), "diameter_cm": 30, "description": "Full thali plate"},
    {"id": "katori_small", "label": "Katori – small", "category": "bowl", "volume_ml": 100, "diameter_cm": 8, "description": "Small steel katori (~100 ml)"},
    {"id": "katori_medium", "label": "Katori – medium", "category": "bowl", "volume_ml": 150, "diameter_cm": 10, "description": "Standard katori (~150 ml)"},
    {"id": "bowl_medium", "label": "Bowl – medium", "category": "bowl", "volume_ml": 250, "diameter_cm": 12, "description": "Cereal / soup bowl (~250 ml)"},
    {"id": "bowl_large", "label": "Bowl – large", "category": "bowl", "volume_ml": 400, "diameter_cm": 15, "description": "Large bowl (~400 ml)"},
    {"id": "cup_tea", "label": "Tea cup", "category": "cup", "volume_ml": 150, "diameter_cm": 7, "description": "Chai cup (~150 ml)"},
    {"id": "mug", "label": "Mug", "category": "cup", "volume_ml": 250, "diameter_cm": 8, "description": "Coffee mug (~250 ml)"},
    {"id": "glass", "label": "Glass", "category": "glass", "volume_ml": 250, "diameter_cm": 7, "description": "Standard glass (~250 ml)"},
    {"id": "shaker", "label": "Protein shaker", "category": "glass", "volume_ml": 500, "diameter_cm": 9, "description": "Shaker bottle (~500 ml)"},
    {"id": "ladle", "label": "Ladle (karchi)", "category": "other", "volume_ml": 60, "diameter_cm": None, "description": "One serving-ladle scoop (~60 ml)"},
]

_CONTAINERS_BY_ID = {c["id"]: c for c in CONTAINERS}

_CATEGORY_KEYWORDS = [
    ("cooked_rice", ["rice", "pulao", "biryani", "khichdi", "chawal"]),
    ("pasta", ["pasta", "macaroni", "noodle", "maggi", "spaghetti"]),
    ("curry", ["dal", "curry", "gravy", "sambar", "rajma", "chole", "soup"]),
    ("porridge", ["porridge", "oats", "dalia"]),
    ("salad", ["salad", "sprouts"]),
    ("beverage", ["milk", "chai", "tea", "coffee", "shake", "juice", "lassi"]),
    ("dry_dish", ["poha", "upma"]),
    ("sabzi", ["sabzi", "bhaji", "vegetable"]),
]


def get_container(container_id: str | None) -> dict | None:
    return _CONTAINERS_BY_ID.get(container_id or "")


def guess_category(text: str) -> str:
    lowered = text.lower()
    for category, words in _CATEGORY_KEYWORDS:
        if any(w in lowered for w in words):
            return category
    return "mixed"


def geometric_estimate(
    *,
    container_id: str | None,
    container_size_ml: float | None,
    plate_diameter_cm: float | None,
    fill_level: str | None,
    food_text: str,
) -> dict | None:
    """Volume × fill × density. Returns None when there is no container information."""
    container = get_container(container_id)
    label = container["label"] if container else None
    volume = container_size_ml or (container["volume_ml"] if container else None)
    if not volume and plate_diameter_cm:
        volume = _plate_volume(plate_diameter_cm)
        label = f"Plate {plate_diameter_cm:g} cm"
    if not volume:
        return None
    label = label or f"Container {volume:g} ml"
    fill = FILL_FRACTIONS.get(fill_level or "", 0.75)
    category = guess_category(food_text)
    density = CATEGORY_DENSITY[category]
    food_volume = volume * fill
    return {
        "container_label": label,
        "container_volume_ml": round(volume),
        "fill_fraction": fill,
        "fill_assumed": fill_level is None,
        "food_category": category,
        "density_g_per_ml": density,
        "est_food_volume_ml": round(food_volume),
        "est_weight_g_from_geometry": round(food_volume * density),
    }
