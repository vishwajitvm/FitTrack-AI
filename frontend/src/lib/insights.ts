// Plain-language "What this means" sentences generated from chart data.
import { avg, daysWithFood, foodHour, hoursToLabel, sum, timeToHours } from "./chart-data";
import { fmt, humanize, prettyDate } from "./format";
import type { Biomarker, CorrelationFinding, Correlations, DailySummary, FoodLog, WorkoutHistoryRow } from "./types";

const k = (n: number) => `${fmt(Math.round(n))} kcal`;

export const PENDING_NOTE = "Your total burn (TDEE) and deficit are pending — add your age and sex in Profile to unlock them. Until then only food eaten and exercise burn are shown.";

export function intakeVsTdeeInsight(days: DailySummary[]): string | null {
  const fed = daysWithFood(days);
  if (!fed.length) return null;
  const last = fed[fed.length - 1];
  const prev = fed.length > 1 ? fed[fed.length - 2] : null;
  const when = prettyDate(last.date, { weekday: "long" });
  if (last.estimated_tdee !== null) {
    const gap = last.estimated_tdee - last.total_calories;
    const verdict =
      gap > 1000 ? "a very aggressive deficit — muscle and gym performance are at risk; aim for 500–750 kcal." : gap > 300 ? "a healthy fat-loss deficit." : gap >= 0 ? "close to maintenance." : "a surplus — you ate more than you burned.";
    return `On ${when} you ate ${k(last.total_calories)} — about ${k(Math.abs(gap))} ${gap >= 0 ? "below" : "above"} your estimated burn of ${k(last.estimated_tdee)}. That is ${verdict}`;
  }
  const trend = prev ? ` (${last.total_calories < prev.total_calories ? "down" : "up"} from ${k(prev.total_calories)} the day before)` : "";
  const low = last.total_calories < 1000 ? " That is below 1,000 kcal — a crash-diet level for a 94.5 kg body, even before counting your burn." : "";
  return `On ${when} you ate ${k(last.total_calories)}${trend}.${low}`;
}

export function macroCaloriesInsight(days: DailySummary[]): string | null {
  const fed = daysWithFood(days);
  if (!fed.length) return null;
  const share = (d: DailySummary) => (d.total_protein * 4) / Math.max(1, d.total_protein * 4 + d.total_carbs * 4 + d.total_fat * 9);
  const last = fed[fed.length - 1];
  const p = Math.round(share(last) * 100);
  const carbs = Math.round(((last.total_carbs * 4) / Math.max(1, last.total_calories)) * 100);
  return `${p}% of your calories on ${prettyDate(last.date, { weekday: "long" })} came from protein and ~${carbs}% from carbs. ${p < 30 ? "Shifting some rice/pasta/bread calories to dal, paneer, eggs or chicken would raise protein without adding calories." : "Good protein share for fat loss."}`;
}

export function proteinInsight(days: DailySummary[], min: number | null, max: number | null): string | null {
  const fed = daysWithFood(days);
  if (!fed.length || !min) return null;
  const hits = fed.filter((d) => d.total_protein >= min).length;
  const last = fed[fed.length - 1];
  const short = min - last.total_protein;
  return `You reached the protein target on ${hits} of ${fed.length} tracked day(s). Latest: ${fmt(last.total_protein)} g vs ${fmt(min)}–${fmt(max)} g${short > 0 ? ` — about ${fmt(short)} g short (≈ ${Math.ceil(short / 24)} extra whey scoops, or eggs/paneer/chicken).` : " — on target."}`;
}

export function weightInsight(points: { date: string; weight: number | null; avg: number | null }[]): string | null {
  const real = points.filter((p) => p.weight !== null);
  if (!real.length) return null;
  if (real.length === 1) return `One weigh-in so far (${fmt(real[0].weight, 1)} kg). Log your morning weight daily — the 7-day average becomes reliable after a week.`;
  const avgs = points.filter((p) => p.avg !== null);
  const first = avgs[0].avg as number;
  const lastAvg = avgs[avgs.length - 1].avg as number;
  const diff = lastAvg - first;
  const days = real.length;
  return `Across ${days} weigh-ins your 7-day average moved ${diff <= 0 ? "down" : "up"} ${fmt(Math.abs(diff), 1)} kg (${fmt(first, 1)} → ${fmt(lastAvg, 1)} kg). ${diff < -1.2 * (days / 7) ? "That's faster than ~1 kg/week — some may be water; watch strength and energy." : ""}`.trim();
}

export function energyStackInsight(day: DailySummary | undefined): string | null {
  if (!day) return null;
  const ex = day.estimated_exercise_calories ?? 0;
  if (day.estimated_tdee === null) {
    return `Known so far for ${prettyDate(day.date, { weekday: "long" })}: ${k(ex)} from exercise and ${k(day.estimated_tef ?? 0)} from digesting food. Resting burn (BMR) and everyday movement are still pending.`;
  }
  const pctEx = Math.round((ex / day.estimated_tdee) * 100);
  return `Of the ${k(day.estimated_tdee)} you burned, only ${pctEx}% came from exercise — most is your resting metabolism (BMR) and everyday movement. Walking more is an easy way to burn extra without extra fatigue.`;
}

export function mealTimingInsight(foods: FoodLog[], gymReturn: string | null, bedtime: string | null): string | null {
  if (!foods.length) return null;
  const total = sum(foods.map((f) => f.calories));
  const late = foods.filter((f) => foodHour(f).hour >= 20.5);
  const lateKcal = sum(late.map((f) => f.calories));
  const biggest = [...foods].sort((a, b) => b.calories - a.calories)[0];
  const estimated = foods.some((f) => foodHour(f).estimated);
  const ret = timeToHours(gymReturn);
  const bed = timeToHours(bedtime);
  const window = ret !== null && bed !== null ? ` Only ${Math.round((bed - ret) * 60)} min between gym return (${gymReturn}) and bed (${bedtime}) — keep that window to a light shake or egg whites.` : "";
  const lateText =
    lateKcal > 400
      ? `${k(lateKcal)} was eaten after 20:30 — heavy late food is a common cause of reflux and morning bloating.`
      : lateKcal > 0
        ? `Only ${k(lateKcal)} after 20:30 — light enough for sleep.`
        : "Nothing eaten after 20:30.";
  return `Your biggest item was ${biggest.food_name} (${k(biggest.calories)} at ${hoursToLabel(foodHour(biggest).hour)}). ${lateText}${window}${estimated ? " Some times are estimated from the meal type." : ""} Total: ${k(total)}.`;
}

export function macroSplitInsight(p: number, c: number, f: number): string | null {
  if (!p && !c && !f) return null;
  if (p < 30) return `Protein is only ${p}% of today's calories (carbs ${c}%, fat ${f}%). For fat loss with muscle retention, ~30–35% protein works better.`;
  return `Protein ${p}%, carbs ${c}%, fat ${f}% — a good protein share for fat loss.`;
}

export function readinessInsight(score: number | null, label: string | null): string | null {
  if (score === null) return "No readiness yet — complete today's check-in.";
  if (score >= 70) return `${score}/100 (${label ?? "good"}): train as planned, keep 1–2 reps in reserve.`;
  if (score >= 45) return `${score}/100 (${label ?? "moderate"}): train, but with fewer sets and lower effort today.`;
  return `${score}/100 (${label ?? "low"}): prioritise recovery — light session, walk, eat and sleep well.`;
}

export function workoutLoadInsight(rows: WorkoutHistoryRow[]): string | null {
  const active = rows.filter((r) => r.lifting_min + r.cardio_min > 0);
  if (!active.length) return null;
  const kcal = sum(active.map((r) => r.total_calories));
  const lift = sum(active.map((r) => r.lifting_min));
  const cardio = sum(active.map((r) => r.cardio_min));
  const missing = rows.filter((r) => r.split && r.lifting_min + r.cardio_min === 0).length;
  return `${active.length} training day(s): ${fmt(lift)} min lifting + ${fmt(cardio)} min cardio, ≈ ${k(kcal)} burned (avg ${k(kcal / active.length)} per session).${missing ? ` ${missing} session(s) have no duration logged, so their calories show as 0.` : ""}`;
}

export function splitInsight(counts: Record<string, number>): string | null {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (!entries.length) return null;
  const ppl = ["push", "pull", "legs"];
  const missing = ppl.filter((s) => !counts[s]);
  const text = entries.map(([s, n]) => `${humanize(s)} ×${n}`).join(", ");
  return `${text}.${missing.length ? ` No ${missing.map(humanize).join(" / ")} session yet in this period — keep the rotation balanced.` : " All three PPL days are covered."}`;
}

export function timelineInsight(t: Correlations["timeline"]): string | null {
  if (!t.length) return null;
  const late = t.filter((d) => (d.late_meal_kcal ?? 0) > 300).length;
  const bloated = t.filter((d) => (d.bloating_score ?? 0) >= 2).length;
  const energies = t.map((d) => d.energy).filter((e): e is number => e !== null);
  const e = avg(energies);
  return `${t.length} day(s) shown. Heavy late eating (>300 kcal after 20:30) on ${late} day(s); moderate-or-worse bloating on ${bloated} day(s).${e !== null ? ` Average energy ${fmt(e, 1)}/10.` : " Log energy in your check-ins to see it here."}`;
}

export function correlationInsight(findings: CorrelationFinding[]): string | null {
  if (!findings.length) return null;
  const rated = findings.filter((f) => f.strength !== "insufficient_data" && f.relative_risk !== null);
  if (!rated.length) return "No trigger can be rated yet — there aren't enough days both with and without each suspect. Keep logging; patterns usually show after ~2 weeks.";
  const top = [...rated].sort((a, b) => (b.relative_risk ?? 0) - (a.relative_risk ?? 0))[0];
  const likely = top.posterior_prob !== null && top.posterior_prob !== undefined ? `, ${Math.round(top.posterior_prob * 100)}% likely to be a real effect` : "";
  return `Strongest suspect: ${top.label} → ${humanize(top.symptom).toLowerCase()} appears ${fmt(top.relative_risk, 1)}× as often on days with it (${top.strength}${likely}). Test it by cutting it out for 1–2 weeks — correlation alone doesn't prove cause.`;
}

export function biomarkerInsight(name: string, series: { date: string; value: number | null }[], ref: Pick<Biomarker, "ref_low" | "ref_high" | "unit"> | null): string | null {
  const pts = series.filter((p) => p.value !== null) as { date: string; value: number }[];
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  const unit = ref?.unit ? ` ${ref.unit}` : "";
  let where = "";
  if (ref && (ref.ref_low !== null || ref.ref_high !== null)) {
    if (ref.ref_low !== null && last.value < ref.ref_low) where = ` — below the normal range (${ref.ref_low}–${ref.ref_high ?? "…"}).`;
    else if (ref.ref_high !== null && last.value > ref.ref_high) where = ` — above the normal range (${ref.ref_low ?? "…"}–${ref.ref_high}).`;
    else where = " — within the normal range.";
  }
  const change = pts.length > 1 ? ` Changed ${last.value - pts[0].value >= 0 ? "+" : ""}${fmt(last.value - pts[0].value, 1)}${unit} since ${prettyDate(pts[0].date, { month: "short", year: "numeric" })}.` : "";
  return `Latest ${name}: ${fmt(last.value, 1)}${unit}${where}${change}`;
}
