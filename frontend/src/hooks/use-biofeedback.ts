import useSWR from "swr";
import type { BioFeedback, Correlations } from "@/lib/types";

export function useBioFeedback(start: string, end: string) {
  return useSWR<BioFeedback[]>(`/api/biofeedback?start=${start}&end=${end}`);
}

export function useCorrelations(days = 30) {
  return useSWR<Correlations>(`/api/biofeedback/correlations?days=${days}`);
}
