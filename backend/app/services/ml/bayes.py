"""Bayesian comparison of two symptom rates (N-of-1 trigger analysis).

Days WITH a trigger vs days WITHOUT it: each symptom rate gets a Beta(1, 1) prior, so the
posteriors are Beta(1 + s, 1 + n − s). We estimate P(rate_with > rate_without) and a 90%
credible interval of the difference by Monte-Carlo, and add Fisher's exact p-value.
"""
import numpy as np
from scipy.stats import fisher_exact

DRAWS = 20_000
_rng = np.random.default_rng(42)  # deterministic results for the same data


def compare_rates(s_with: int, n_with: int, s_without: int, n_without: int) -> dict:
    a = _rng.beta(1 + s_with, 1 + n_with - s_with, DRAWS)
    b = _rng.beta(1 + s_without, 1 + n_without - s_without, DRAWS)
    diff = a - b
    _, p_value = fisher_exact([[s_with, n_with - s_with], [s_without, n_without - s_without]], alternative="greater")
    return {
        "posterior_prob": round(float((diff > 0).mean()), 3),
        "diff_low": round(float(np.quantile(diff, 0.05)), 3),
        "diff_high": round(float(np.quantile(diff, 0.95)), 3),
        "p_value": round(float(p_value), 4),
    }


def strength(posterior_prob: float, diff_mean: float, n_with: int, n_without: int) -> str | None:
    if n_with < 3 or n_without < 2:
        return "insufficient_data"
    if posterior_prob >= 0.95 and diff_mean >= 0.25:
        return "strong"
    if posterior_prob >= 0.85:
        return "moderate"
    if posterior_prob >= 0.7:
        return "weak"
    return None  # no evidence of a link — not shown
