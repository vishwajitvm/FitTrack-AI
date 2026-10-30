import useSWR from "swr";
import type { DailyDetail, DailySummary } from "@/lib/types";

/** `null` = nothing to load (e.g. a closed panel). */
export function useDaily(date: string | null) {
  return useSWR<DailyDetail>(date ? `/api/daily/${date}` : null);
}

export function useDailyRange(start: string, end: string) {
  return useSWR<DailySummary[]>(`/api/daily?start=${start}&end=${end}`);
}
