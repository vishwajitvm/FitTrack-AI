import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "critical" | "warning" | "ok" | "info" | "neutral" | "dark" | "brand";

const tones: Record<BadgeTone, string> = {
  critical: "bg-crit-bg text-crit-fg border-crit-border",
  warning: "bg-warn-bg text-warn-fg border-warn-border",
  ok: "bg-good-bg text-good-fg border-good-border",
  info: "bg-info-bg text-info-fg border-info-border",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  dark: "bg-slate-900 text-white border-slate-900 dark:text-slate-50",
  brand: "bg-brand-50 text-brand-700 border-brand-100",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

/** Map a 0–1 confidence to a badge tone. */
export function confidenceTone(c: number | null | undefined): BadgeTone {
  if (c === null || c === undefined) return "neutral";
  if (c >= 0.75) return "ok";
  if (c >= 0.5) return "warning";
  return "critical";
}
