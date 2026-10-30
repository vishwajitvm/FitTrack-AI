"use client";

import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { fmt, shortDate } from "@/lib/format";
import type { DailySummary } from "@/lib/types";
import { axisProps, chartMargin, gridProps, legendProps } from "./axis";

/** Food intake bars vs TDEE line; the shaded band between them is the deficit. */
export function IntakeTdeeChart({ days, height = 250 }: { days: DailySummary[]; height?: number }) {
  const t = useChartTheme();
  if (!days.length) return <EmptyState title="No tracked days yet" />;
  const data = days.map((d) => ({
    date: d.date,
    intake: Math.round(d.total_calories),
    tdee: d.estimated_tdee !== null ? Math.round(d.estimated_tdee) : null,
    exercise: Math.round(d.estimated_exercise_calories ?? 0),
    gap: d.estimated_tdee !== null ? [Math.round(d.total_calories), Math.round(d.estimated_tdee)] : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps(t)} interval="preserveStartEnd" />
        <YAxis {...axisProps(t)} width={52} />
        <Tooltip
          {...t.tooltip}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v, name) => {
            if (Array.isArray(v)) {
              const diff = Number(v[1]) - Number(v[0]);
              return [`${fmt(Math.abs(diff))} kcal ${diff >= 0 ? "deficit" : "surplus"}`, "Gap"];
            }
            return [v === null || v === undefined ? "pending" : `${fmt(Number(v))} kcal`, name];
          }}
        />
        <Legend {...legendProps(t)} />
        <Area dataKey="gap" name="Deficit zone" fill={t.c.deficit} fillOpacity={0.15} stroke="none" connectNulls legendType="square" />
        <Bar dataKey="intake" name="Food eaten" fill={t.c.intake} radius={[6, 6, 0, 0]} maxBarSize={32} />
        <Bar dataKey="exercise" name="Exercise burn" fill={t.c.exercise} fillOpacity={0.85} radius={[6, 6, 0, 0]} maxBarSize={32} />
        <Line dataKey="tdee" name="Total burn (TDEE)" stroke={t.c.tdee} strokeWidth={2} dot={{ r: 3, fill: t.c.tdee }} type="monotone" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
