"""Unit tests for the ML/statistics layer, using synthetic data with a known ground truth.

Run:  pytest tests            (or: python -m tests.test_ml_models)
"""
import random
from datetime import date, timedelta

from app.services.ml import bayes, energy_model, lab_parser, readiness_model, training_load
from app.services.ml.image_features import hamming


def test_kalman_learns_true_expenditure():
    """30 days eating 2,000 kcal with a true burn of 2,600 → the filter should find ~2,600."""
    rnd = random.Random(7)
    true_tdee, intake, weight = 2600.0, 2000.0, 94.5
    days = []
    for i in range(42):
        days.append(energy_model.DayInput(date(2026, 1, 1) + timedelta(days=i), intake, weight + rnd.gauss(0, 0.5)))
        weight += (intake - true_tdee) / energy_model.KCAL_PER_KG
    estimates = energy_model.run_filter(days, prior_expenditure=2100, start_weight=94.5)
    final = estimates[-1]
    assert abs(final.expenditure - true_tdee) < 200, final.expenditure
    assert final.confidence > 0.5
    assert abs(final.trend - weight) < 0.6  # trend tracks the true weight despite ±0.5 kg noise


def test_kalman_gates_weigh_in_typo():
    days = [energy_model.DayInput(date(2026, 1, 1) + timedelta(days=i), 2200, 90.0) for i in range(10)]
    days[6] = energy_model.DayInput(days[6].day, 2200, 9.0)  # typo: 9.0 instead of 90.0
    estimates = energy_model.run_filter(days, 2200, 90.0)
    assert estimates[6].outlier
    assert abs(estimates[-1].trend - 90.0) < 0.5


def test_rate_status_and_forecast():
    points = [(date(2026, 1, 1) + timedelta(days=i), 94.5 - 0.1 * i) for i in range(14)]
    rate = energy_model.regression_rate(points)
    assert abs(rate - (-0.7)) < 0.01
    assert energy_model.rate_status(rate, 94.0, weigh_ins=14) == "on_track"
    assert energy_model.rate_status(-1.2, 94.0, weigh_ins=14) == "too_fast"
    fc = energy_model.forecast(93.2, rate, 85.0, date(2026, 1, 15))
    assert fc and 75 <= fc["days_remaining"] <= 90


def test_acwr_spike_detected():
    start = date(2026, 1, 1)
    loads = {start + timedelta(days=i): 420.0 for i in range(0, 35, 2)}  # steady: 60 min × RPE 7 every other day
    for i in range(35, 42):
        loads[start + timedelta(days=i)] = 840.0  # one week of doubled daily load
    result = training_load.analyse_loads(loads, start, start + timedelta(days=41))
    assert result["acwr"] is not None and result["acwr"] > 1.5
    assert result["acwr_zone"] == "very_high"
    assert result["monotony"] is None  # identical daily load → SD 0 → undefined


def test_readiness_model_recovers_sleep_effect():
    rnd = random.Random(3)
    days = []
    for i in range(40):
        sleep = rnd.uniform(5, 9)
        energy = max(1, min(10, round(2 + 0.9 * sleep + rnd.gauss(0, 0.4))))
        days.append({"date": (date(2026, 1, 1) + timedelta(days=i)).isoformat(), "energy_level": energy, "sleep_hours": sleep,
                     "sleep_quality": None, "bloating_status": None, "soreness_muscles": [], "food_count": 0,
                     "total_calories": 0, "protein_per_kg": None, "estimated_tdee": None, "adaptive_tdee": None})
    result = readiness_model.fit(readiness_model.build_rows(days, {}, {}))
    assert result["mode"] == "personal_model"
    assert result["coefficients"][0]["feature"] == "sleep_hours"
    assert result["r2"] > 0.6


def test_bayesian_trigger_comparison():
    strong = bayes.compare_rates(s_with=7, n_with=8, s_without=1, n_without=8)
    assert strong["posterior_prob"] > 0.99 and strong["p_value"] < 0.01
    assert bayes.strength(strong["posterior_prob"], 7 / 8 - 1 / 8, 8, 8) == "strong"
    none = bayes.compare_rates(s_with=2, n_with=6, s_without=2, n_without=6)
    assert bayes.strength(none["posterior_prob"], 0, 6, 6) is None
    assert bayes.strength(0.99, 0.5, 2, 8) == "insufficient_data"


def test_lab_parser_prefers_specific_alias():
    markers = {m["key"]: m for m in lab_parser.parse("HbA1c (Glycated Haemoglobin) 5.9 % 4.0 - 5.6\nHemoglobin 14.2 g/dL 13 - 17")}
    assert markers["hba1c"]["value"] == 5.9 and markers["hba1c"]["status"] == "high"
    assert markers["hemoglobin"]["value"] == 14.2 and markers["hemoglobin"]["status"] == "normal"


def test_phash_distance():
    assert hamming("ffff0000ffff0000", "ffff0000ffff0001") == 1


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("PASS", name)
