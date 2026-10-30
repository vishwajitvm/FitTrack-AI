"use client";

import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { fmt, shortDate } from "@/lib/format";
import type { ExpenditureInsight } from "@/lib/types";
import { axisProps, chartMargin, gridProps, legendProps } from "./axis";

/** Daily intake bars (orange) vs the adaptive (learned) expenditure line (pink) with its band, and the formula TDEE. */
export function ExpenditureChart({ insight, height = 270 }: { insight: ExpenditureInsight; height?: number }) {
  const t = useChartTheme();
  if (!insight.points.length) return <EmptyState title="Not enough data yet" description="Log food and morning weight for a few days." />;
  const data = insight.points.map((p) => ({
    date: p.date,
    intake: p.intake,
    expenditure: p.expenditure,
    band: p.low !== null && p.high !== null ? [p.low, p.high] : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps(t)} interval="preserveStartEnd" minTickGap={24} />
        <YAxis {...axisProps(t)} width={52} />
        <Tooltip
          {...t.tooltip}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v, name) => {
            if (Array.isArray(v)) return [`${fmt(Number(v[0]))}–${fmt(Number(v[1]))} kcal`, name];
            return [v === null || v === undefined ? "—" : `${fmt(Number(v))} kcal`, name];
          }}
        />
        <Legend {...legendProps(t)} />
        <Bar dataKey="intake" name="Food eaten" fill={t.c.intake} fillOpacity={0.75} radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Area dataKey="band" name="Burn range" fill={t.c.exercise} fillOpacity={0.14} stroke="none" connectNulls legendType="square" isAnimationActive={false} />
        <Line dataKey="expenditure" name={insight.adaptive_tdee !== null ? "Real burn (adaptive)" : "Burn estimate (still learning)"} stroke={t.c.exercise} strokeWidth={2.5} dot={false} connectNulls type="monotone" />
        {insight.formula_tdee !== null && (
          <ReferenceLine y={insight.formula_tdee} stroke={t.ink} strokeOpacity={0.6} strokeDasharray="6 4" label={{ value: `Formula ${fmt(insight.formula_tdee)}`, position: "insideTopRight", fill: t.axis, fontSize: 10 }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
