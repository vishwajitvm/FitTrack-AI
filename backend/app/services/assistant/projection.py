"""Weight projections from the athlete's own numbers. Pure functions (no I/O).

Two models, shown side by side:
- constant: today's average deficit kept forever, 7,700 kcal per kg (the classic rule; optimistic over months).
- adaptive: same food intake, but daily burn falls in proportion to body weight as you get lighter
  (E_t = E_0 × W_t / W_0), so the deficit — and the rate — shrink over time. More realistic beyond ~4 weeks.
"""
from dataclasses import dataclass
from datetime import date, timedelta

KCAL_PER_KG = 7700.0
MAX_DAYS = 730


@dataclass
class Projection:
    weekly_loss_kg: float  # at the start
    points: list[dict]  # [{week, date, constant, adaptive}]
    target_weight: float | None
    target_date_constant: date | None
    target_date_adaptive: date | None


def average(values: list[float | None]) -> float | None:
    vals = [v for v in values if v is not None]
    return sum(vals) / len(vals) if vals else None


def weekly_loss(deficit_per_day: float) -> float:
    return deficit_per_day * 7 / KCAL_PER_KG


def project(weight: float, intake: float, expenditure: float, today: date, weeks: list[int], target: float | None = None) -> Projection:
    """Projected weight after each of `weeks`, and the date the target is reached (if within two years)."""
    deficit = expenditure - intake
    want = set(weeks)
    points: list[dict] = []
    w_adapt = weight
    hit_constant = hit_adaptive = None
    last_week = max(weeks) if weeks else 0
    for day in range(1, MAX_DAYS + 1):
        burn = expenditure * w_adapt / weight
        w_adapt -= (burn - intake) / KCAL_PER_KG
        w_const = weight - deficit * day / KCAL_PER_KG
        when = today + timedelta(days=day)
        if target is not None and deficit > 0 and target < weight:
            if hit_constant is None and w_const <= target:
                hit_constant = when
            if hit_adaptive is None and w_adapt <= target:
                hit_adaptive = when
        if day % 7 == 0 and day // 7 in want:
            # nobody keeps dieting past the goal: the table stops at the target weight
            floor = target if target is not None and target < weight else float("-inf")
            points.append({"week": day // 7, "date": when, "constant": round(max(w_const, floor), 1),
                           "adaptive": round(max(w_adapt, floor), 1), "at_target": w_adapt <= floor})
        if day >= last_week * 7 and (target is None or deficit <= 0 or (hit_constant and hit_adaptive)):
            break
    return Projection(round(weekly_loss(deficit), 2), points, target, hit_constant, hit_adaptive)


def rate_label(weekly_kg: float, weight: float) -> str:
    """Plain-language verdict on a weekly change (positive = losing)."""
    pct = weekly_kg / weight * 100 if weight else 0
    if weekly_kg <= 0:
        return "not losing at this rate"
    if pct > 1.0:
        return "faster than the recommended 0.5–1% of body weight a week (risk of muscle loss)"
    if pct >= 0.5:
        return "within the recommended 0.5–1% of body weight a week"
    return "slower than 0.5% of body weight a week (steady, easy to sustain)"
