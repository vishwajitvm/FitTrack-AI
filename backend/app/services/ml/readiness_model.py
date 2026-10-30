"""Personal readiness model: learns what drives YOUR morning energy (ridge regression).

Each training example is one day with a check-in energy score (1-10). Features describe the
night before and the previous day. Ridge regression (standardised features, closed form) is
small-data friendly; leave-one-out R² tells you whether it has learned anything real.
Until MIN_SAMPLES labelled days exist, readiness uses the rule-based score only.
"""
from datetime import date, timedelta

import numpy as np

MIN_SAMPLES = 14
RIDGE_LAMBDA = 1.0
MIN_USEFUL_R2 = 0.05

FEATURES = [
    ("sleep_hours", "Sleep hours"),
    ("sleep_quality", "Sleep quality"),
    ("intake_ratio", "Yesterday's intake vs burn"),
    ("protein_per_kg", "Yesterday's protein (g/kg)"),
    ("late_kcal", "Late-evening calories yesterday"),
    ("acwr", "Training load ratio (ACWR)"),
    ("bloating", "Bloating"),
    ("sore_muscles", "Number of sore muscles"),
]
BLOAT = {"none": 0, "mild": 1, "moderate": 2, "severe": 3}


def build_rows(days: list[dict], late_kcal: dict[str, float], acwr: dict[date, float | None]) -> list[dict]:
    """One row per day: features from that morning + the previous day, target = energy_level."""
    by_date = {d["date"]: d for d in days}
    rows = []
    for d in days:
        today = date.fromisoformat(d["date"])
        prev = by_date.get((today - timedelta(days=1)).isoformat())
        burn = (prev or {}).get("estimated_tdee") or (prev or {}).get("adaptive_tdee")
        rows.append(
            {
                "date": d["date"],
                "target": d.get("energy_level"),
                "sleep_hours": d.get("sleep_hours"),
                "sleep_quality": d.get("sleep_quality"),
                "intake_ratio": (prev["total_calories"] / burn) if prev and prev["food_count"] and burn else None,
                "protein_per_kg": prev["protein_per_kg"] if prev and prev["food_count"] else None,
                "late_kcal": late_kcal.get(prev["date"]) if prev else None,
                "acwr": acwr.get(today - timedelta(days=1)),
                "bloating": BLOAT.get(d.get("bloating_status") or "", None),
                "sore_muscles": len(d.get("soreness_muscles") or []) if d.get("energy_level") is not None else None,
            }
        )
    return rows


def _matrix(rows: list[dict], means: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    X = np.array([[np.nan if r[k] is None else float(r[k]) for k, _ in FEATURES] for r in rows], dtype=float)
    if means is None:
        means = np.nanmean(np.where(np.isnan(X).all(axis=0), 0, X), axis=0) if len(X) else np.zeros(len(FEATURES))
        means = np.nan_to_num(means)
    X = np.where(np.isnan(X), means, X)  # mean imputation
    return X, means


def fit(rows: list[dict]) -> dict:
    labelled = [r for r in rows if r["target"] is not None]
    result = {"mode": "rules", "samples": len(labelled), "min_samples": MIN_SAMPLES, "r2": None,
              "coefficients": [], "prediction_today": None, "notes": []}
    if len(labelled) < MIN_SAMPLES:
        result["notes"].append(
            f"{len(labelled)}/{MIN_SAMPLES} days with an energy check-in. The personal model switches on at {MIN_SAMPLES}."
        )
        return result

    X, means = _matrix(labelled)
    y = np.array([r["target"] for r in labelled], dtype=float)
    sd = X.std(axis=0)
    usable = sd > 1e-9
    Z = (X[:, usable] - X[:, usable].mean(axis=0)) / sd[usable]
    y_mean = y.mean()
    yc = y - y_mean
    A = Z.T @ Z + RIDGE_LAMBDA * np.eye(Z.shape[1])
    w = np.linalg.solve(A, Z.T @ yc)

    # Leave-one-out R² via the hat matrix (exact for ridge).
    H = Z @ np.linalg.solve(A, Z.T)
    residuals = (yc - H @ yc) / np.clip(1 - np.diag(H), 1e-6, None)
    ss_tot = float(((y - y_mean) ** 2).sum()) or 1.0
    r2 = 1 - float((residuals**2).sum()) / ss_tot

    labels = [label for (key, label), ok in zip(FEATURES, usable) if ok]
    keys = [key for (key, _), ok in zip(FEATURES, usable) if ok]
    coefficients = sorted(
        ({"feature": k, "label": lbl, "weight": round(float(c), 3)} for k, lbl, c in zip(keys, labels, w)),
        key=lambda c: -abs(c["weight"]),
    )
    result.update(r2=round(r2, 3), coefficients=coefficients)
    if r2 < MIN_USEFUL_R2:
        result["notes"].append("Not enough signal yet — your energy varies for reasons not captured here. Rules stay in charge.")
        return result

    result["mode"] = "personal_model"
    latest = rows[-1]
    x_today, _ = _matrix([latest], means)
    z_today = (x_today[:, usable] - X[:, usable].mean(axis=0)) / sd[usable]
    result["prediction_today"] = round(float(np.clip(y_mean + z_today @ w, 1, 10)[0]), 1)
    top = coefficients[0]
    result["notes"].append(
        f"Biggest driver so far: {top['label']} ({'+' if top['weight'] > 0 else '−'}{abs(top['weight']):.1f} energy points per typical change)."
    )
    return result
