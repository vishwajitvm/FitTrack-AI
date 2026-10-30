"""Unit tests for the dashboard daily brief's pure parts: rule-based text, the number check and text repair.

Run:  pytest tests/test_daily_brief.py
"""
from app.services.coach import brief


def facts(**over) -> dict:
    base = {
        "day_in_progress": True,
        "is_rest_day": False,
        "profile": {"weight_kg": 94.5, "diet_type": "vegetarian", "gym_return_time": "21:10", "bedtime": "21:30"},
        "targets": {"intake_goal_today_kcal": 1796, "protein_g": {"min": 151, "target": 170, "max": 189}},
        "eaten": {"kcal": 1319, "protein_g": 73},
        "checkin": {"sleep_hours": None},
        "main_meals_not_logged": ["lunch", "dinner"],
        "app_alerts": [],
    }
    base.update(over)
    return base


def numbers(**over) -> dict:
    base = {
        "eaten_kcal": 1319, "goal_kcal": 1796, "kcal_left": 477, "protein_g": 73, "protein_target_g": 170, "protein_left_g": 97,
        "burned_kcal": 2396, "exercise_kcal": 0, "balance_kcal": 1077, "food_count": 6, "has_workout": False,
    }
    base.update(over)
    return base


def test_rules_nothing_logged_yet():
    b = brief.rules_brief(facts(), numbers(eaten_kcal=0, protein_g=0, food_count=0))
    assert b["tone"] == "start"
    assert "Nothing logged" in b["headline"]
    assert b["next"] and "paneer" in b["next"][0]  # vegetarian protein ideas
    assert "chicken" not in " ".join(b["next"])


def test_rules_mid_day():
    b = brief.rules_brief(facts(), numbers())
    assert "1319 kcal" in b["headline"] and "477 kcal" in b["headline"]
    assert any("97 g" in x for x in b["next"])
    assert any("lunch, dinner" in x for x in b["next"])
    assert any("main meal before the gym" in x for x in b["next"])
    assert set(b) == {"headline", "good", "watch", "next", "tone"}
    assert all(len(b[k]) <= brief.MAX_ITEMS for k in ("good", "watch", "next"))


def test_rules_diet_aware_foods():
    assert "chicken" in brief._protein_foods("non_vegetarian")
    assert "eggs" in brief._protein_foods("eggetarian")
    assert "tofu" in brief._protein_foods("vegan") and "whey" not in brief._protein_foods("vegan")
    assert "egg" not in brief._protein_foods("vegetarian")


def test_rules_day_over_with_warnings():
    alerts = [{"level": "critical", "title": "Crash deficit", "detail": "820 kcal is far too little."}]
    b = brief.rules_brief(facts(day_in_progress=False, app_alerts=alerts), numbers(eaten_kcal=820, protein_g=40, protein_left_g=130, kcal_left=976))
    assert b["tone"] == "off"
    assert b["watch"][0].startswith("Crash deficit")
    assert any("40 g of 170 g" in w for w in b["watch"])


def test_number_check_accepts_fact_numbers_and_simple_math():
    f, n = facts(), numbers()
    ok = "You've had 1,319 kcal, 477 kcal left of 1796 kcal, and need 97 g more protein (73 g of 170 g). Burning ~2400 kcal."
    assert brief.check_numbers(ok, f, n) == []
    assert brief.check_numbers("You still have 2 meals and 5 g of fibre to go.", f, n) == []  # small numbers are fine


def test_number_check_flags_invented_numbers():
    f, n = facts(), numbers()
    assert brief.check_numbers("You burned 3,900 kcal and ate 55 g protein.", f, n) == ["3,900 kcal", "55 g"]


def test_fix_text_repairs_mojibake():
    assert brief._fix_text("logged yet â€” if you ate") == "logged yet — if you ate"
    assert brief._fix_text("  plain text ") == "plain text"


def test_clean_shapes_model_output():
    out = brief._clean({"headline": " Good day ", "good": "one item", "watch": ["a", "", "b", "c", "d"], "next": [], "tone": "weird"})
    assert out == {"headline": "Good day", "good": ["one item"], "watch": ["a", "b", "c"], "next": [], "tone": "good"}
