// Small data-shaping helpers shared by the charts.
import type { DailySummary, FoodLog } from "./types";

/** Days on or after Day 1 (the API also returns earlier, empty days in a range). */
export function trackedDays(days: DailySummary[]): DailySummary[] {
  return days.filter((d) => (d.day_number ?? 0) >= 1);
}

/** Days with at least one food entry. */
export function daysWithFood(days: DailySummary[]): DailySummary[] {
  return days.filter((d) => d.total_calories > 0);
}

/** Trailing moving average over the last `window` points (ignores nulls). */
export function movingAverage(values: (number | null)[], window = 7): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null);
    return slice.length ? Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10 : null;
  });
}

/** "21:10" → 21.17 */
export function timeToHours(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return Number.isFinite(h) ? h + (m || 0) / 60 : null;
}

export function hoursToLabel(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Typical clock time for a meal type — used when an entry has no time recorded. */
const MEAL_HOURS: Record<string, number> = {
  breakfast: 8,
  morning_snack: 10.5,
  lunch: 13.5,
  evening_snack: 17,
  pre_workout: 18.5,
  dinner: 20,
  post_workout: 21.25,
  other: 12,
};

export function foodHour(f: FoodLog): { hour: number; estimated: boolean } {
  const t = timeToHours(f.time);
  if (t !== null) return { hour: t, estimated: false };
  return { hour: MEAL_HOURS[f.meal_type] ?? 12, estimated: true };
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);
