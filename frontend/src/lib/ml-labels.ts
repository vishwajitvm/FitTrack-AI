// Human labels and badge tones for the ML enums.
import type { BadgeTone } from "@/components/ui/badge";
import { pct } from "./format";
import type { AcwrZone, AnalysisMethod, RateStatus, ReadinessMode, TdeeSource } from "./types";

export const RATE_STATUS: Record<RateStatus, { label: string; tone: BadgeTone }> = {
  too_fast: { label: "Too fast — muscle-loss risk", tone: "critical" },
  on_track: { label: "On track", tone: "ok" },
  slow: { label: "Slow", tone: "warning" },
  gaining: { label: "Gaining", tone: "warning" },
  insufficient_data: { label: "Not enough weigh-ins", tone: "neutral" },
};

export const ACWR_ZONE: Record<AcwrZone, { label: string; tone: BadgeTone }> = {
  low: { label: "Low (detraining)", tone: "info" },
  optimal: { label: "Optimal", tone: "ok" },
  high: { label: "High", tone: "warning" },
  very_high: { label: "Very high", tone: "critical" },
};

export const READINESS_MODE: Record<ReadinessMode, string> = {
  rules: "Rules",
  personal_model: "Personal model",
};

export const TDEE_SOURCE: Record<TdeeSource, { label: string; tone: BadgeTone }> = {
  formula: { label: "formula", tone: "neutral" },
  adaptive: { label: "adaptive", tone: "ok" },
  blended: { label: "blended", tone: "brand" },
  pending: { label: "pending", tone: "warning" },
};

/** e.g. "adaptive · 72% confidence" (confidence only shown for learned estimates). */
export function tdeeSourceText(source: TdeeSource | undefined | null, confidence?: number | null): string | null {
  if (!source) return null;
  const label = TDEE_SOURCE[source]?.label ?? source;
  return (source === "adaptive" || source === "blended") && confidence !== null && confidence !== undefined ? `${label} · ${pct(confidence)} confidence` : label;
}

export const ANALYSIS_METHOD: Record<AnalysisMethod, { label: string; tone: BadgeTone }> = {
  "ai+ml": { label: "AI + ML", tone: "brand" },
  ml_only: { label: "ML only (no AI)", tone: "info" },
  duplicate: { label: "Duplicate photo", tone: "warning" },
  personal_match: { label: "Your usual meal", tone: "ok" },
};

export const ANOMALY_KIND: Record<string, string> = {
  atwater_mismatch: "Calories don't match macros",
  impossible_density: "Unrealistic portion",
  unusual_day: "Unusual day",
  weight_outlier: "Odd weigh-in",
  duplicate_entry: "Possible duplicate",
};

export const MATCH_LABEL: Record<string, string> = {
  semantic: "meaning match",
  lexical: "spelling match",
  hybrid: "meaning + spelling",
};
