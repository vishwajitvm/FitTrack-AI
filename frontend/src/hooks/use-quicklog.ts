import useSWR from "swr";
import type { LastPerformance, MealType, Preset, PresetKind, QuickPick, TodayPlan } from "@/lib/types";

export function useToday() {
  return useSWR<TodayPlan>("/api/today");
}

export function usePresets(kind: PresetKind) {
  return useSWR<Preset[]>(`/api/presets?kind=${kind}`);
}

export function useQuickPicks(mealType: MealType | null, limit = 12) {
  return useSWR<QuickPick[]>(mealType ? `/api/quick-picks?meal_type=${mealType}&limit=${limit}` : null, { keepPreviousData: true });
}

export function useLastPerformance(exercise: string | null) {
  return useSWR<LastPerformance | null>(exercise ? `/api/workouts/last-performance?exercise=${encodeURIComponent(exercise)}` : null);
}
