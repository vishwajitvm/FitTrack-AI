import type { ReactNode } from "react";
import { ACCENT, type Accent } from "@/components/ui/fx";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Each training split has its own colour (same as the History page), so a week of training reads at a glance:
 * push = orange, pull = indigo, legs = pink, cardio = cyan, full body = emerald.
 */
const SPLIT_ACCENT: Record<string, Accent> = { push: "kcal", pull: "sleep", legs: "burn", cardio: "water", full_body: "balance", rest: "weight", other: "weight" };

export function splitAccent(split: string | null | undefined): Accent {
  return SPLIT_ACCENT[split ?? "other"] ?? "weight";
}

/** Coloured pill with a dot, e.g. "• Pull". */
export function SplitChip({ split, className, children }: { split: string | null | undefined; className?: string; children?: ReactNode }) {
  const a = ACCENT[splitAccent(split)];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", a.tint, a.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", a.solid)} aria-hidden />
      {children ?? humanize(split)}
    </span>
  );
}
