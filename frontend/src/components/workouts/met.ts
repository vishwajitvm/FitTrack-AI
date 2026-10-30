/** Exercise Calories ≈ MET × 3.5 × weight(kg) / 200 × minutes (spec formula). */
export function metCalories(met: number | null | undefined, weightKg: number | null | undefined, minutes: number | null | undefined): number | null {
  if (!met || !weightKg || !minutes) return null;
  return Math.round(((met * 3.5 * weightKg) / 200) * minutes);
}
