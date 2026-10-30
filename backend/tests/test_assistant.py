"""Unit tests for the assistant's pure parts: date parsing, weight projections and offline answers.

Run:  pytest tests/test_assistant.py
"""
from datetime import date, timedelta

from app.services.assistant import dates, fallback, projection

TODAY = date(2026, 10, 28)  # a Wednesday
START = date(2026, 10, 26)


def test_relative_dates():
    assert dates.find_dates("what did I eat yesterday?", TODAY) == [date(2026, 10, 27)]
    assert dates.find_dates("day before yesterday", TODAY) == [date(2026, 10, 26)]
    assert dates.find_dates("my workout 1 week ago", TODAY) == [date(2026, 10, 21)]
    assert dates.find_dates("three days ago", TODAY) == [date(2026, 10, 25)]
    assert dates.find_dates("a week ago and today", TODAY) == [date(2026, 10, 21), TODAY]


def test_weekdays():
    assert dates.find_dates("what did I do on monday", TODAY) == [date(2026, 10, 26)]
    assert dates.find_dates("last wednesday", TODAY) == [date(2026, 10, 21)]
    assert dates.find_dates("wednesday", TODAY) == [TODAY]


def test_calendar_dates():
    assert dates.find_dates("on 2026-10-26", TODAY) == [date(2026, 10, 26)]
    assert dates.find_dates("26 oct", TODAY) == [date(2026, 10, 26)]
    assert dates.find_dates("October 27th", TODAY) == [date(2026, 10, 27)]
    assert dates.find_dates("26/10", TODAY) == [date(2026, 10, 26)]
    assert dates.find_dates("15 dec", TODAY) == [date(2025, 12, 15)]  # no year + future → last year
    assert dates.find_dates("day 2", TODAY, START) == [date(2026, 10, 27)]


def test_not_dates():
    assert dates.find_dates("is 1.6 g/kg protein enough?", TODAY) == []
    assert dates.find_dates("how much will I lose in 8 weeks", TODAY) == []
    assert dates.find_dates("tomorrow's plan", TODAY) == []


def test_window():
    assert dates.find_window("average over the last 2 weeks") == 14
    assert dates.find_window("past 10 days") == 10
    assert dates.find_window("this week") == 7
    assert dates.find_window("how am I doing") is None


def test_constant_projection_is_7700_rule():
    """770 kcal/day deficit = 0.7 kg/week; after 10 weeks the simple model is exactly 7 kg lighter."""
    p = projection.project(100.0, 2230.0, 3000.0, TODAY, [10])
    assert p.weekly_loss_kg == 0.7
    assert p.points[0]["constant"] == 93.0
    assert p.points[0]["date"] == TODAY + timedelta(weeks=10)


def test_adaptive_projection_slows_down():
    """With burn scaling with weight, loss is slower than the constant model and each month loses less."""
    p = projection.project(100.0, 2000.0, 3000.0, TODAY, [4, 8, 12], target=85.0)
    w4, w8, w12 = (pt["adaptive"] for pt in p.points)
    assert w4 > p.points[0]["constant"] - 0.01
    assert (100 - w4) > (w4 - w8) > (w8 - w12) > 0
    assert p.target_date_adaptive > p.target_date_constant


def test_projection_stops_at_target():
    p = projection.project(94.5, 1000.0, 3000.0, TODAY, [4, 26], target=80.0)
    assert p.points[-1]["constant"] == 80.0 and p.points[-1]["adaptive"] == 80.0 and p.points[-1]["at_target"]
    assert not p.points[0]["at_target"]


def test_no_loss_without_deficit():
    p = projection.project(80.0, 2600.0, 2500.0, TODAY, [4], target=75.0)
    assert p.weekly_loss_kg < 0
    assert p.target_date_constant is None and p.target_date_adaptive is None
    assert projection.rate_label(p.weekly_loss_kg, 80.0) == "not losing at this rate"


def test_rate_label():
    assert "faster" in projection.rate_label(1.5, 90)
    assert "within" in projection.rate_label(0.7, 90)
    assert "slower" in projection.rate_label(0.2, 90)


def _facts(**over):
    day = {
        "date": "2026-10-27", "weekday": "Tuesday", "day_number": 2, "complete": True, "is_rest_day": False, "morning_weight_kg": 94.5,
        "intake": {"calories": 945.0, "protein": 65.9, "carbs": 107.5, "fat": 27.3, "fibre": 5.0}, "protein_g_per_kg": 0.7,
        "energy": {"bmr": 1900, "neat": 400, "tef": 100, "exercise": 637, "tdee": 3003, "tdee_source": "formula", "deficit": 2058, "deficit_status": "ok"},
        "foods": [{"time": "07:00", "meal": "breakfast", "food": "Poha", "quantity": 1, "unit": "plate", "grams": None, "kcal": 410, "protein": 9.0, "carbs": 70, "fat": 10}],
        "training_sessions": [{"split": "push", "minutes": 60, "kcal": 397, "session_rpe": 7, "started_at": "18:00"}],
        "exercises": [{"exercise": "Bench press", "type": "strength", "muscle": "chest", "sets": 3, "reps": "10", "weight_kg": 40, "minutes": None, "kcal": None}],
        "check_in": {"sleep_hours": 7, "energy_level": 6}, "symptoms": [], "alerts": ["CRITICAL: Crash deficit (<1,000 kcal)"],
    }
    p = projection.project(94.5, 1000.0, 3000.0, TODAY, [1, 4, 8], 80.0)
    base = {
        "intake_kcal": 1000, "burn_kcal": 3000, "deficit_kcal": 2000, "weekly_loss_kg_now": p.weekly_loss_kg,
        "verdict": projection.rate_label(p.weekly_loss_kg, 94.5), "weeks": p.points, "target_weight_kg": 80.0,
        "target_date_constant": p.target_date_constant, "target_date_adaptive": p.target_date_adaptive,
    }
    facts = {
        "today": TODAY, "profile": {"days_since_start": 3, "protein_target_g": {"min": 151, "max": 189, "target": 170}},
        "asked_dates": [], "day_details": [day],
        "weight": {"latest_weigh_in": {"date": "2026-10-28", "kg": 94.5}, "starting_weight_kg": 94.5, "change_since_start_kg": 0.0,
                   "trend_weight_kg": 94.5, "observed_rate_kg_per_week": None, "rate_status": "insufficient_data", "weigh_ins": 3, "target_weight_kg": 80.0},
        "averages": {"last_7_complete_days": {"days": 3, "from": "2026-10-26", "to": "2026-10-28", "intake_kcal": 1031, "tdee_kcal": 3002,
                                              "deficit_kcal": 1971, "exercise_kcal": 612, "protein_g": 68.0, "protein_g_per_kg": 0.72}},
        "projections": {"basis_days": 3, "from_logged_average": base, "scenario": None, "method": "7,700 kcal ≈ 1 kg."},
    }
    return facts | over


def test_offline_projection_answer_uses_the_numbers():
    text = fallback.answer("how much weight will I lose in 8 weeks?", _facts())
    assert text.startswith("**At your current rate you'd lose about 1.82 kg a week**")
    assert "| 8 weeks |" in text and "Only 3 day(s) of data" in text


def test_offline_day_answer():
    text = fallback.answer("what did I eat yesterday?", _facts(asked_dates=[date(2026, 10, 27)]))
    assert "Tue 27 Oct" in text and "Poha" in text and "Bench press" not in text  # food only
    full = fallback.answer("what did I eat and train yesterday?", _facts(asked_dates=[date(2026, 10, 27)]))
    assert "Poha" in full and "Bench press 3 × 10 @ 40 kg" in full
    missing = fallback.answer("what did I eat on 1 oct?", _facts(asked_dates=[date(2026, 10, 1)]))
    assert "Nothing is logged for Thu 01 Oct" in missing


def test_offline_protein_answer():
    text = fallback.answer("am I hitting my protein?", _facts())
    assert "102 g short" in text


def test_grounding_flags_a_slipped_digit():
    from app.services.assistant import grounding
    allowed = grounding.allowed_numbers('{"burn_kcal":3002,"weekly_loss_kg_now":1.09,"weeks":[{"adaptive":93.4}],"protein_g":68.0}')
    ok = "Burn **3,002 kcal** (about 3,000), 1.09 kg a week → 93.4 kg; protein 68 g; in 2 weeks, by 2027."
    assert grounding.ungrounded(ok, allowed) == []
    assert grounding.ungrounded("an estimated daily burn of 3,015 kcal", allowed) == ["3,015"]
    assert grounding.ungrounded("you'll weigh 91.7 kg", allowed) == ["91.7"]
