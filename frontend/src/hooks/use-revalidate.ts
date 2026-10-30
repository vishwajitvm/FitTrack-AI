import { useSWRConfig } from "swr";

const DAY_SCOPED = ["/api/daily", "/api/dashboard", "/api/brief", "/api/food", "/api/workouts", "/api/biofeedback", "/api/profile", "/api/today", "/api/presets", "/api/quick-picks", "/api/insights"];

/**
 * Returns a function that revalidates every cached query that depends on daily data
 * (dashboard, tracker, food, workouts, check-ins). Call it after any mutation.
 */
export function useRevalidateTracking() {
  const { mutate } = useSWRConfig();
  return () => mutate((key) => typeof key === "string" && DAY_SCOPED.some((p) => key.startsWith(p)));
}

/** Revalidate every key starting with one of the given prefixes. */
export function useRevalidatePrefix() {
  const { mutate } = useSWRConfig();
  return (...prefixes: string[]) => mutate((key) => typeof key === "string" && prefixes.some((p) => key.startsWith(p)));
}
