"""Adaptive energy expenditure + weight trend with a joint Kalman filter.

State x = [W, E]: W = "true" (trend) body weight in kg, E = daily expenditure in kcal.
  predict (one day):  W' = W + (intake − E) / 7700,  E' = E           (E is a slow random walk)
  update  (weigh-in): z  = W + v,   v ~ N(0, R)                        (water / gut-content noise)
Days without a complete food log skip the energy term and just add uncertainty.
Weigh-ins more than OUTLIER_SIGMA standard deviations from the prediction are gated out.
"""
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np

KCAL_PER_KG = 7700.0
WEIGHT_NOISE_SD = 0.6  # kg, day-to-day scale noise (water, sodium, gut content)
TREND_PROCESS_SD = 0.05  # kg/day of unexplained trend change
EXPENDITURE_PROCESS_SD = 15.0  # kcal/day drift of true expenditure
MISSING_INTAKE_SD = 0.25  # kg/day extra uncertainty when intake wasn't logged
PRIOR_EXPENDITURE_SD = 500.0
OUTLIER_SIGMA = 3.5


@dataclass
class DayInput:
    day: date
    intake: float | None  # complete-day kcal, None if not (fully) logged
    weight: float | None  # morning weigh-in


@dataclass
class DayEstimate:
    day: date
    trend: float
    trend_sd: float
    expenditure: float
    expenditure_sd: float
    outlier: bool

    @property
    def confidence(self) -> float:
        return float(max(0.0, min(1.0, 1 - self.expenditure_sd / PRIOR_EXPENDITURE_SD)))


def run_filter(days: list[DayInput], prior_expenditure: float, start_weight: float) -> list[DayEstimate]:
    """Filtered estimate for each day (state after that morning's weigh-in)."""
    x = np.array([start_weight, prior_expenditure], dtype=float)
    P = np.diag([1.0**2, PRIOR_EXPENDITURE_SD**2])
    Q = np.diag([TREND_PROCESS_SD**2, EXPENDITURE_PROCESS_SD**2])
    R = WEIGHT_NOISE_SD**2
    out: list[DayEstimate] = []
    for i, d in enumerate(days):
        outlier = False
        if d.weight is not None:
            S = P[0, 0] + R
            innovation = d.weight - x[0]
            if abs(innovation) > OUTLIER_SIGMA * np.sqrt(S) and i > 0:
                outlier = True
            else:
                K = P[:, 0] / S
                x = x + K * innovation
                P = P - np.outer(K, P[0, :])
        out.append(DayEstimate(d.day, float(x[0]), float(np.sqrt(P[0, 0])), float(x[1]), float(np.sqrt(P[1, 1])), outlier))

        # Predict tomorrow morning from today's intake.
        if d.intake is not None:
            F = np.array([[1.0, -1.0 / KCAL_PER_KG], [0.0, 1.0]])
            x = np.array([x[0] + (d.intake - x[1]) / KCAL_PER_KG, x[1]])
            P = F @ P @ F.T + Q
        else:
            P = P + Q + np.diag([MISSING_INTAKE_SD**2, 0.0])
    return out


def regression_rate(points: list[tuple[date, float]]) -> float | None:
    """Least-squares slope in kg/week."""
    if len(points) < 2:
        return None
    t0 = points[0][0]
    xs = np.array([(d - t0).days for d, _ in points], dtype=float)
    ys = np.array([w for _, w in points], dtype=float)
    if np.ptp(xs) < 3:
        return None
    slope = np.polyfit(xs, ys, 1)[0]
    return float(slope * 7)


def rate_status(rate_kg_week: float | None, weight: float, weigh_ins: int) -> str:
    if rate_kg_week is None or weigh_ins < 3:
        return "insufficient_data"
    pct = -rate_kg_week / weight * 100  # positive = losing
    if pct > 1.0:
        return "too_fast"
    if pct >= 0.5:
        return "on_track"
    if pct >= 0:
        return "slow"
    return "gaining"


def forecast(trend: float, rate_kg_week: float | None, target: float | None, today: date) -> dict | None:
    if target is None or rate_kg_week is None or rate_kg_week >= -0.05 or trend <= target:
        return None
    weeks = (trend - target) / -rate_kg_week
    if weeks > 104:
        return None
    eta = today + timedelta(days=round(weeks * 7))
    projected = []
    for w in range(0, int(np.ceil(weeks)) + 1):
        projected.append({"date": today + timedelta(days=7 * w), "weight": round(max(target, trend + rate_kg_week * w), 2)})
    return {"eta_date": eta, "days_remaining": (eta - today).days, "projected": projected}
