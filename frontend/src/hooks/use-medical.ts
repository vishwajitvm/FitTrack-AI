import useSWR from "swr";
import type { BiomarkerTrends, MedicalReport } from "@/lib/types";

export function useReports() {
  return useSWR<MedicalReport[]>("/api/medical/reports", {
    // Keep polling while any report is still being analysed.
    refreshInterval: (data) => (data?.some((r) => r.status === "analyzing") ? 3000 : 0),
  });
}

export function useBiomarkerTrends() {
  return useSWR<BiomarkerTrends>("/api/medical/biomarkers/trends");
}
