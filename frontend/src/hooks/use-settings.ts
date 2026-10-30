import useSWR from "swr";
import type { AppSettings, Health } from "@/lib/types";

export function useHealth() {
  return useSWR<Health>("/api/health", { refreshInterval: 30000 });
}

export function useSettings() {
  return useSWR<AppSettings>("/api/settings");
}
