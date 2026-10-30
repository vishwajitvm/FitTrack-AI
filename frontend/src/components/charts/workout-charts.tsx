"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme, type ChartTheme } from "@/hooks/use-chart-theme";
import { fmt, humanize, shortDate } from "@/lib/format";
import type { WorkoutHistoryRow } from "@/lib/types";
import { axisProps, chartMargin, gridProps, legendProps } from "./axis";

/** Lifting vs cardio minutes per day (stacked) with exercise calories as a line. */
export function WorkoutLoadChart({ rows, height = 250 }: { rows: WorkoutHistoryRow[]; height?: number }) {
  const t = useChartTheme();
  if (!rows.length) return <EmptyState title="No workouts in this period" />;
  const data = [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, lifting: Math.round(r.lifting_min), cardio: Math.round(r.cardio_min), kcal: Math.round(r.total_calories), split: r.split }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ ...chartMargin, left: 0, right: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps(t)} />
        <YAxis yAxisId="min" {...axisProps(t)} width={44} unit="m" />
        <YAxis yAxisId="kcal" orientation="right" {...axisProps(t)} width={44} />
        <Tooltip
          {...t.tooltip}
          labelFormatter={(l, p) => `${shortDate(String(l))}${p?.[0]?.payload?.split ? ` · ${humanize(p[0].payload.split)}` : ""}`}
          formatter={(v, name) => [name === "Exercise kcal" ? `${fmt(Number(v))} kcal` : `${fmt(Number(v))} min`, name]}
        />
        <Legend {...legendProps(t)} />
        <Bar yAxisId="min" dataKey="lifting" name="Lifting" stackId="w" fill={t.c.lifting} maxBarSize={32} />
        <Bar yAxisId="min" dataKey="cardio" name="Cardio" stackId="w" fill={t.c.cardio} radius={[6, 6, 0, 0]} maxBarSize={32} />
        <Line yAxisId="kcal" dataKey="kcal" name="Exercise kcal" stroke={t.c.exercise} strokeWidth={2.5} dot={{ r: 3, fill: t.c.exercise }} type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Same split colours as the History page chips (push orange, pull indigo, legs pink…), from the chart theme. */
function splitColor(t: ChartTheme, split: string): string {
  const map: Record<string, string> = { push: t.c.intake, pull: t.c.sleep, legs: t.c.exercise, cardio: t.c.cardio, full_body: t.c.deficit, rest: t.muted, other: t.c.bmr };
  return map[split] ?? t.muted;
}

export function splitCounts(rows: WorkoutHistoryRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, r) => {
    if (r.split) acc[r.split] = (acc[r.split] ?? 0) + 1;
    return acc;
  }, {});
}

export function SplitDistributionChart({ counts, height = 200 }: { counts: Record<string, number>; height?: number }) {
  const t = useChartTheme();
  const data = Object.entries(counts).map(([split, n]) => ({ name: humanize(split), split, n }));
  if (!data.length) return <EmptyState title="No sessions in this period" />;
  const total = data.reduce((a, d) => a + d.n, 0);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="w-full max-w-[180px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="n" nameKey="name" innerRadius="55%" outerRadius="90%" paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.split} fill={splitColor(t, d.split)} />
              ))}
            </Pie>
            <Tooltip {...t.tooltip} formatter={(v, name) => [`${v} session(s)`, name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.split} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: splitColor(t, d.split) }} />
              {d.name}
            </span>
            <span className="num text-slate-600">
              {d.n} · {Math.round((d.n / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
