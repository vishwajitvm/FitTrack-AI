import type { MealSlot, MealType } from "./types";

/** Pick a sensible meal type from the time of day (gym return ≈ 21:10). */
export function guessMeal(time: string): MealType {
  const h = Number(time.split(":")[0]);
  if (h < 10) return "breakfast";
  if (h < 12) return "morning_snack";
  if (h < 15) return "lunch";
  if (h < 18) return "evening_snack";
  if (h < 20) return "pre_workout";
  if (h < 21) return "dinner";
  return "post_workout";
}

/** Meal type to log an optimizer suggestion under. */
export function mealForSlot(slot: MealSlot, time: string): MealType {
  if (slot === "dinner") return "dinner";
  if (slot === "post_workout") return "post_workout";
  if (slot === "snack") return "evening_snack";
  return guessMeal(time);
}
