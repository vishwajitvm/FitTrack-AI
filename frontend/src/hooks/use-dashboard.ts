import useSWR from "swr";
import type { Dashboard } from "@/lib/types";

export function useDashboard(days = 7) {
  return useSWR<Dashboard>(`/api/dashboard?days=${days}`);
}
