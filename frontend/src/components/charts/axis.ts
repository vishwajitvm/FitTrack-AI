import type { ChartTheme } from "@/hooks/use-chart-theme";

/** Shared axis styling so every chart reads the same in light and dark mode: no axis lines, quiet ticks. */
export function axisProps(t: ChartTheme) {
  return {
    tick: { fontSize: 11, fill: t.axis },
    stroke: t.grid,
    axisLine: false,
    tickLine: false,
    tickMargin: 6,
  } as const;
}

/** Faint horizontal gridlines (pass `vertical` for scatter/vertical-bar charts). */
export function gridProps(t: ChartTheme, opts: { vertical?: boolean; horizontal?: boolean } = {}) {
  return {
    stroke: t.grid,
    strokeDasharray: "3 4",
    vertical: opts.vertical ?? false,
    horizontal: opts.horizontal ?? true,
  } as const;
}

/** Small round legend markers under the plot. */
export function legendProps(t: ChartTheme) {
  return {
    wrapperStyle: { ...t.legend, paddingTop: 10 },
    iconSize: 9,
  } as const;
}

export const chartMargin = { top: 8, right: 8, left: -12, bottom: 0 };
