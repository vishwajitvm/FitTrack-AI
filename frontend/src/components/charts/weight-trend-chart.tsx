"use client";

import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { movingAverage } from "@/lib/chart-data";
import { fmt, shortDate } from "@/lib/format";
import { axisProps, chartMargin, gridProps, legendProps } from "./axis";

export interface WeightPoint {
  date: string;
  weight: number | null;
  avg: number | null;
}

/** Build points with a 7-reading moving average. */
export function weightPoints(raw: { date: string; weight: number | null }[]): WeightPoint[] {
  const sorted = [...raw].sort((a, b) => a.date.localeCompare(b.date));
  const ma = movingAverage(sorted.map((p) => p.weight), 7);
  return sorted.map((p, i) => ({ ...p, avg: ma[i] }));
}

export function WeightTrendChart({ points, height = 230 }: { points: WeightPoint[]; height?: number }) {
  const t = useChartTheme();
  const real = points.filter((p) => p.weight !== null);
  if (!real.length) return <EmptyState title="No weigh-ins yet" description="Log your morning weight in the daily check-in." />;
  const ws = real.map((p) => p.weight as number);
  const min = Math.floor(Math.min(...ws) - 1);
  const max = Math.ceil(Math.max(...ws) + 1);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={points} margin={chartMargin}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps(t)} interval="preserveStartEnd" />
        <YAxis domain={[min, max]} allowDecimals={false} tickCount={max - min + 1} {...axisProps(t)} width={48} unit="kg" />
        <Tooltip {...t.tooltip} labelFormatter={(l) => shortDate(String(l))} formatter={(v, name) => [v === null ? "—" : `${fmt(Number(v), 1)} kg`, name]} />
        <Legend {...legendProps(t)} />
        <Line dataKey="weight" name="Morning weigh-in" stroke={t.c.carbs} strokeWidth={0} legendType="circle" dot={{ r: 3.5, fill: t.c.carbs, fillOpacity: 0.45, stroke: t.c.carbs, strokeOpacity: 0.7 }} activeDot={{ r: 5, fill: t.c.carbs }} isAnimationActive={false} />
        <Line dataKey="avg" name="7-day average" stroke={t.c.carbs} strokeWidth={2.5} dot={false} connectNulls type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
