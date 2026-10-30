"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { fmt, shortDate } from "@/lib/format";
import type { DailySummary } from "@/lib/types";
import { axisProps, chartMargin, gridProps, legendProps } from "./axis";

/** Where each day's calories are burned (BMR / NEAT / TEF / exercise), with intake as a dot. */
export function EnergyStackChart({ days, height = 250 }: { days: DailySummary[]; height?: number }) {
  const t = useChartTheme();
  if (!days.length) return <EmptyState title="No tracked days yet" />;
  const data = days.map((d) => ({
    date: d.date,
    bmr: d.estimated_bmr !== null ? Math.round(d.estimated_bmr) : null,
    neat: d.estimated_neat !== null ? Math.round(d.estimated_neat) : null,
    tef: Math.round(d.estimated_tef ?? 0),
    exercise: Math.round(d.estimated_exercise_calories ?? 0),
    intake: Math.round(d.total_calories),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps(t)} />
        <YAxis {...axisProps(t)} width={52} />
        <Tooltip {...t.tooltip} labelFormatter={(l) => shortDate(String(l))} formatter={(v, name) => [v === null || v === undefined ? "pending" : `${fmt(Number(v))} kcal`, name]} />
        <Legend {...legendProps(t)} />
        <Bar dataKey="bmr" name="BMR (resting)" stackId="e" fill={t.c.bmr} maxBarSize={36} />
        <Bar dataKey="neat" name="NEAT (movement)" stackId="e" fill={t.c.neat} maxBarSize={36} />
        <Bar dataKey="tef" name="TEF (digestion)" stackId="e" fill={t.c.tef} maxBarSize={36} />
        <Bar dataKey="exercise" name="Exercise" stackId="e" fill={t.c.exercise} radius={[6, 6, 0, 0]} maxBarSize={36} />
        <Line dataKey="intake" name="Food eaten" stroke={t.c.intake} strokeDasharray="4 4" strokeWidth={2} dot={{ r: 4.5, fill: t.c.intake, stroke: t.tooltip.contentStyle.background, strokeWidth: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
