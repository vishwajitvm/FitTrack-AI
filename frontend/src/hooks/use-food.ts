import useSWR from "swr";
import type { ContainerPreset, FoodAnalysis, FoodLog, NutritionHit } from "@/lib/types";

export function useFood(date: string) {
  return useSWR<FoodLog[]>(`/api/food?date=${date}`);
}

export function useContainers() {
  return useSWR<ContainerPreset[]>("/api/food/containers", { revalidateIfStale: false });
}

export function useAnalyses(limit = 12) {
  return useSWR<FoodAnalysis[]>(`/api/food/analyses?limit=${limit}`);
}

export function useNutritionSearch(query: string) {
  const q = query.trim();
  return useSWR<NutritionHit[]>(q.length >= 2 ? `/api/nutrition/search?q=${encodeURIComponent(q)}` : null, {
    keepPreviousData: true,
    dedupingInterval: 10000,
  });
}
