import useSWR from "swr";
import type {
  Anomaly,
  ExpenditureInsight,
  InsightsSummary,
  MealSlot,
  MealSuggestions,
  MLStatus,
  ReadinessModelInfo,
  TrainingLoadInsight,
  WeightInsight,
} from "@/lib/types";

export function useInsightsSummary() {
  return useSWR<InsightsSummary>("/api/insights/summary");
}

export function useWeightInsight(days = 90) {
  return useSWR<WeightInsight>(`/api/insights/weight?days=${days}`);
}

export function useExpenditureInsight(days = 90) {
  return useSWR<ExpenditureInsight>(`/api/insights/expenditure?days=${days}`);
}

export function useTrainingLoad(days = 56) {
  return useSWR<TrainingLoadInsight>(`/api/insights/training-load?days=${days}`);
}

export function useReadinessModel() {
  return useSWR<ReadinessModelInfo>("/api/insights/readiness-model");
}

export function useMealSuggestions(date: string, slot: MealSlot) {
  return useSWR<MealSuggestions>(`/api/insights/meal-suggestions?date=${date}&slot=${slot}`);
}

export function useAnomalies(days = 30) {
  return useSWR<Anomaly[]>(`/api/insights/anomalies?days=${days}`);
}

/** ML model status; polls every 2 s while a model is downloading/loading. */
export function useMlStatus() {
  return useSWR<MLStatus>("/api/ml/status", {
    refreshInterval: (s) => (s?.models.some((m) => m.state === "loading") ? 2000 : 0),
  });
}
