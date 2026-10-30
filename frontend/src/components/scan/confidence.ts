import type { BadgeTone } from "@/components/ui/badge";

/** Confidence bar colour follows the same tone as the confidence pill (`confidenceTone`). */
export const CONF_BAR: Record<BadgeTone, string> = {
  ok: "bg-good-fg",
  warning: "bg-warn-fg",
  critical: "bg-crit-fg",
  info: "bg-info-fg",
  neutral: "bg-slate-400",
  dark: "bg-slate-900",
  brand: "bg-brand-500",
};
