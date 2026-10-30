import useSWR from "swr";
import type { AiStats, LLMCallLog, Model, Provider, RoutePreviewItem, Routing } from "@/lib/types";

export function useProviders() {
  return useSWR<Provider[]>("/api/ai/providers");
}

export function useModels(provider?: string) {
  return useSWR<Model[]>(provider ? `/api/ai/models?provider=${provider}` : "/api/ai/models");
}

export function useRouting() {
  return useSWR<Routing>("/api/ai/routing");
}

export function useRoutePreview(task: string) {
  return useSWR<RoutePreviewItem[]>(`/api/ai/routing/preview?task=${task}`);
}

export function useAiLogs(limit = 100) {
  return useSWR<LLMCallLog[]>(`/api/ai/logs?limit=${limit}`, { refreshInterval: 15000 });
}

export function useAiStats() {
  return useSWR<AiStats>("/api/ai/stats");
}
