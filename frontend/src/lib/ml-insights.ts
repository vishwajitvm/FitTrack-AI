// "What this means" sentences for the ML insight charts.
import { fmt, humanize, pct, prettyDate } from "./format";
import type { ExpenditureInsight, ReadinessModelInfo, TrainingLoadInsight, WeightInsight } from "./types";

export function weightTrendInsight(w: WeightInsight): string | null {
  const weighIns = w.points.filter((p) => p.weight !== null).length;
  if (!weighIns) return null;
  if (w.trend_weight === null || w.rate_kg_per_week === null) {
    return `${weighIns} weigh-in(s) so far. The trend and rate need about a week of morning weigh-ins.`;
  }
  const dir = w.rate_kg_per_week < 0 ? "losing" : "gaining";
  const rate = `${fmt(Math.abs(w.rate_kg_per_week), 2)} kg/week${w.rate_pct_per_week !== null ? ` (${fmt(Math.abs(w.rate_pct_per_week), 2)}% of body weight)` : ""}`;
  const eta = w.forecast?.eta_date ? ` At this rate you'd reach ${fmt(w.target_weight, 1)} kg around ${prettyDate(w.forecast.eta_date, { day: "numeric", month: "long", year: "numeric" })}.` : "";
  const outliers = w.points.filter((p) => p.outlier).length;
  return `Your trend weight is ${fmt(w.trend_weight, 1)} kg and you're ${dir} ${rate}.${eta}${outliers ? ` ${outliers} odd weigh-in(s) were ignored.` : ""}`;
}

export function expenditureInsight(e: ExpenditureInsight): string | null {
  const intakes = e.points.map((p) => p.intake).filter((v): v is number => v !== null);
  if (e.adaptive_tdee === null) {
    return `${e.logged_days} logged day(s) and ${e.weigh_ins_used} weigh-in(s) so far. Your real burn becomes reliable after ~2–3 weeks of logging food and weighing in.`;
  }
  const avgIntake = intakes.length ? intakes.reduce((a, b) => a + b, 0) / intakes.length : null;
  const gap = avgIntake !== null ? e.adaptive_tdee - avgIntake : null;
  const vsFormula =
    e.formula_tdee !== null ? ` That's ${fmt(Math.abs(e.adaptive_tdee - e.formula_tdee))} kcal ${e.adaptive_tdee >= e.formula_tdee ? "above" : "below"} the formula estimate.` : "";
  return `Your body really burns about ${fmt(e.adaptive_tdee)} kcal/day (likely ${fmt(e.adaptive_low)}–${fmt(e.adaptive_high)}, ${pct(e.confidence)} confidence).${vsFormula}${
    gap !== null ? ` You've averaged ${fmt(avgIntake)} kcal — a ${gap >= 0 ? "deficit" : "surplus"} of ~${fmt(Math.abs(gap))} kcal/day.` : ""
  }`;
}

export function trainingLoadInsight(l: TrainingLoadInsight): string | null {
  if (!l.points.some((p) => p.load > 0)) return "No training load yet — log sessions with a duration and session RPE.";
  const zone =
    l.acwr_zone === "optimal"
      ? "in the sweet spot — steady, sustainable progress."
      : l.acwr_zone === "high" || l.acwr_zone === "very_high"
        ? "above the sweet spot — you've ramped up quickly, so prioritise sleep, food and an easier day."
        : l.acwr_zone === "low"
          ? "below your usual — fine for a deload, but don't stay here for long."
          : "not available yet (needs a few weeks of sessions).";
  const mono = l.monotony !== null && l.monotony > 2 ? ` Monotony is ${fmt(l.monotony, 1)} — add an easier day to vary the load.` : "";
  const acwr = l.acwr !== null ? `ACWR ${fmt(l.acwr, 2)} is ${zone}` : "ACWR isn't available yet — it needs a few weeks of logged sessions.";
  return `This week's load is ${fmt(l.weekly_load)} units. ${acwr}${mono}`;
}

export function readinessModelInsight(m: ReadinessModelInfo): string | null {
  if (m.mode === "rules" || !m.coefficients.length) {
    return `${m.samples} of ${m.min_samples} check-ins collected. After ${m.min_samples}, the app learns what drives YOUR energy.`;
  }
  const top = [...m.coefficients].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))[0];
  return `${top.label} has the biggest effect on your next-morning energy (${top.weight > 0 ? "+" : ""}${fmt(top.weight, 2)} points per typical change).${
    m.prediction_today !== null ? ` Predicted energy today: ${fmt(m.prediction_today, 1)}/10.` : ""
  }${m.r2 !== null ? ` The model explains ${pct(Math.max(0, m.r2))} of your day-to-day energy swings.` : ""}`;
}

export function slotLabel(slot: string): string {
  return slot === "now" ? "Next meal" : slot === "post_workout" ? "Post-workout" : humanize(slot);
}
