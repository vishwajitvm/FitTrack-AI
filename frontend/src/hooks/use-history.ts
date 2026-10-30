import useSWR from "swr";
import type { HistoryFilters, HistoryPage } from "@/lib/types";

export function historyKey(f: HistoryFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v !== "" && v !== "any" && v !== null && v !== undefined) params.set(k, String(v));
  }
  return `/api/history?${params.toString()}`;
}

/** One page of day rows; keeps the previous page on screen while the next one loads. */
export function useHistory(filters: HistoryFilters) {
  return useSWR<HistoryPage>(historyKey(filters), { keepPreviousData: true });
}
