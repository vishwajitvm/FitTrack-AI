import useSWR from "swr";
import type { ExerciseLibraryItem, MetReference, WorkoutDay, WorkoutHistoryRow, WorkoutRecommendation } from "@/lib/types";

export function useWorkouts(date: string) {
  return useSWR<WorkoutDay>(`/api/workouts?date=${date}`);
}

export function useWorkoutHistory(days = 30) {
  return useSWR<WorkoutHistoryRow[]>(`/api/workouts/history?days=${days}`);
}

export function useRecommendation(date: string) {
  return useSWR<WorkoutRecommendation>(`/api/workouts/recommendation?date=${date}`);
}

export function useExerciseLibrary() {
  return useSWR<ExerciseLibraryItem[]>("/api/workouts/exercises", { revalidateIfStale: false });
}

export function useMetReference() {
  return useSWR<MetReference[]>("/api/workouts/met-reference", { revalidateIfStale: false });
}
