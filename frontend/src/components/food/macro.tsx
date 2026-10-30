"use client";

import { useChartTheme } from "@/hooks/use-chart-theme";
import { cn } from "@/lib/utils";

export type Macro = "protein" | "carbs" | "fat" | "fibre";

/**
 * Macro colours. Protein has its own metric accent; carbs / fat / fibre have no `ACCENT` token,
 * so they come from the chart theme to match the dashboard macro charts.
 */
export function useMacroColors(): Record<Macro, string> {
  const { c } = useChartTheme();
  return { protein: c.protein, carbs: c.carbs, fat: c.fat, fibre: c.fibre };
}

/** Small coloured dot for a macro label or legend. */
export function MacroDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: color }} aria-hidden />;
}

/** Calories contributed by each macro (Atwater 4/4/9) — used for the split bar. */
export function macroCalories(p: number, c: number, f: number) {
  const parts = { protein: p * 4, carbs: c * 4, fat: f * 9 };
  const total = parts.protein + parts.carbs + parts.fat;
  return { parts, total };
}

interface SplitBarProps {
  protein: number;
  carbs: number;
  fat: number;
  className?: string;
}

/** Stacked bar: share of calories from protein, carbs and fat. Empty (grey) when nothing is logged. */
export function MacroSplitBar({ protein, carbs, fat, className }: SplitBarProps) {
  const colors = useMacroColors();
  const { parts, total } = macroCalories(protein, carbs, fat);
  return (
    <div className={cn("flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-200", className)} role="img" aria-label={total ? `Protein ${Math.round((parts.protein / total) * 100)}%, carbs ${Math.round((parts.carbs / total) * 100)}%, fat ${Math.round((parts.fat / total) * 100)}% of calories` : "No macros yet"}>
      {total > 0 &&
        (["protein", "carbs", "fat"] as const).map((k) =>
          parts[k] > 0 ? <span key={k} className="h-full transition-[width] duration-700 first:rounded-l-full last:rounded-r-full" style={{ width: `${(parts[k] / total) * 100}%`, background: colors[k] }} /> : null,
        )}
    </div>
  );
}
