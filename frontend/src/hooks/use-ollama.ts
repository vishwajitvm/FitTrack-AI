import useSWR from "swr";
import type { OllamaLibraryItem, OllamaModel, OllamaRunning, OllamaStatus, PullJob } from "@/lib/types";

export function useOllamaStatus() {
  return useSWR<OllamaStatus>("/api/ollama/status", { refreshInterval: 20000 });
}

export function useOllamaModels(enabled: boolean) {
  return useSWR<OllamaModel[]>(enabled ? "/api/ollama/models" : null);
}

export function useOllamaRunning(enabled: boolean) {
  return useSWR<OllamaRunning[]>(enabled ? "/api/ollama/running" : null, { refreshInterval: 10000 });
}

export function useOllamaLibrary() {
  return useSWR<OllamaLibraryItem[]>("/api/ollama/library", { revalidateIfStale: false });
}

const ACTIVE = new Set(["queued", "pulling"]);

export function isPullActive(job: PullJob) {
  return ACTIVE.has(job.status);
}

/** Polls every 1.5 s while any download is queued or in progress. */
export function usePullJobs() {
  return useSWR<PullJob[]>("/api/ollama/pulls", {
    refreshInterval: (jobs) => (jobs?.some(isPullActive) ? 1500 : 0),
  });
}
