"use client";

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme, type ChartTheme } from "@/hooks/use-chart-theme";
import { fmt, humanize, shortDate } from "@/lib/format";
import type { CorrelationFinding, Correlations } from "@/lib/types";
import { axisProps, chartMargin, gridProps, legendProps } from "./axis";

/** Calories & late-night calories (bars) vs energy and bloating (lines). */
export function CheckinTimelineChart({ timeline, height = 260 }: { timeline: Correlations["timeline"]; height?: number }) {
  const t = useChartTheme();
  if (!timeline.length) return <EmptyState title="No days to show yet" />;
  const data = timeline.map((d) => ({ ...d, late_meal_kcal: d.late_meal_kcal ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ ...chartMargin, right: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps(t)} />
        <YAxis yAxisId="kcal" {...axisProps(t)} width={48} />
        <YAxis yAxisId="score" orientation="right" domain={[0, 10]} {...axisProps(t)} width={28} />
        <Tooltip
          {...t.tooltip}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v, name) => {
            if (v === null || v === undefined) return ["not logged", name];
            if (name === "Energy (1–10)") return [`${v}/10`, name];
            if (name === "Bloating (0–3)") return [`${v} (${["none", "mild", "moderate", "severe"][Number(v)] ?? ""})`, name];
            return [`${fmt(Number(v))} kcal`, name];
          }}
        />
        <Legend {...legendProps(t)} />
        <Bar yAxisId="kcal" dataKey="calories" name="Calories" fill={t.muted} fillOpacity={0.7} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar yAxisId="kcal" dataKey="late_meal_kcal" name="After 20:30" fill={t.c.late} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line yAxisId="score" dataKey="energy" name="Energy (1–10)" stroke={t.c.sleep} strokeWidth={2.5} connectNulls dot={{ r: 3, fill: t.c.sleep }} type="monotone" />
        <Line yAxisId="score" dataKey="bloating_score" name="Bloating (0–3)" stroke={t.c.bloating} strokeWidth={2.5} connectNulls dot={{ r: 3, fill: t.c.bloating }} type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Strength colours come from the chart theme so they follow light/dark mode. */
function strengthColor(t: ChartTheme, s: CorrelationFinding["strength"]): string {
  return { strong: t.c.surplus, moderate: t.c.late, weak: t.c.carbs, insufficient_data: t.muted }[s];
}

/** Relative risk per symptom ← trigger pair, coloured by strength. */
export function CorrelationStrengthChart({ findings }: { findings: CorrelationFinding[] }) {
  const t = useChartTheme();
  const data = findings
    .filter((f) => f.relative_risk !== null)
    .map((f) => ({
      name: `${humanize(f.symptom)} ← ${f.label.split(" (")[0]}`,
      rr: Math.round((f.relative_risk ?? 0) * 10) / 10,
      strength: f.strength,
      explanation: f.explanation,
      likely: f.posterior_prob ?? null,
    }))
    .sort((a, b) => b.rr - a.rr)
    .slice(0, 10);
  if (!data.length) return <EmptyState title="No triggers to compare yet" />;
  const height = Math.max(140, data.length * 36 + 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t, { vertical: true, horizontal: false })} />
        <XAxis type="number" {...axisProps(t)} domain={[0, (max: number) => Math.max(3, Math.ceil(max))]} tickFormatter={(v) => `×${v}`} />
        <YAxis type="category" dataKey="name" {...axisProps(t)} width={130} tick={{ fontSize: 10, fill: t.axis }} />
        <ReferenceLine x={1} stroke={t.axis} strokeDasharray="4 4" label={{ value: "no difference", position: "top", fill: t.axis, fontSize: 10 }} />
        <Tooltip {...t.tooltip} formatter={(v, _n, item) => [
            `×${v} · ${humanize(item.payload.strength)}${item.payload.likely !== null ? ` · ${Math.round(item.payload.likely * 100)}% likely` : ""}`,
            item.payload.explanation,
          ]} />
        <Bar dataKey="rr" name="Relative risk" radius={[0, 6, 6, 0]} maxBarSize={18}>
          {data.map((d) => (
            <Cell key={d.name} fill={strengthColor(t, d.strength)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
