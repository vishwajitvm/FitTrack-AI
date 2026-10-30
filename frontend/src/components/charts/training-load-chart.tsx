"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { fmt, shortDate } from "@/lib/format";
import type { TrainingLoadInsight } from "@/lib/types";
import { axisProps, chartMargin, gridProps, legendProps } from "./axis";

/** Daily load bars (exercise pink), acute/chronic EWMA lines, and ACWR on a second axis with the 0.8–1.3 zone shaded. */
export function TrainingLoadChart({ insight, height = 280 }: { insight: TrainingLoadInsight; height?: number }) {
  const t = useChartTheme();
  if (!insight.points.length) return <EmptyState title="No training logged yet" />;
  const maxAcwr = Math.max(2, ...insight.points.map((p) => p.acwr ?? 0));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={insight.points} margin={{ ...chartMargin, left: 0, right: 0 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps(t)} interval="preserveStartEnd" minTickGap={24} />
        <YAxis yAxisId="load" {...axisProps(t)} width={44} />
        <YAxis yAxisId="acwr" orientation="right" domain={[0, Math.ceil(maxAcwr * 2) / 2]} {...axisProps(t)} width={32} />
        <ReferenceArea yAxisId="acwr" y1={0.8} y2={1.3} fill={t.c.band} stroke="none" label={{ value: "ACWR sweet spot", position: "insideTopRight", fill: t.axis, fontSize: 10 }} />
        <Tooltip
          {...t.tooltip}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v, name) => [v === null || v === undefined ? "—" : name === "ACWR" ? fmt(Number(v), 2) : `${fmt(Number(v))} units`, name]}
        />
        <Legend {...legendProps(t)} />
        <Bar yAxisId="load" dataKey="load" name="Daily load" fill={t.c.exercise} fillOpacity={0.3} radius={[4, 4, 0, 0]} minPointSize={0} maxBarSize={20} />
        <Line yAxisId="load" dataKey="acute" name="Acute (7-day)" stroke={t.c.exercise} strokeWidth={2.5} dot={false} type="monotone" />
        <Line yAxisId="load" dataKey="chronic" name="Chronic (28-day)" stroke={t.ink} strokeOpacity={0.7} strokeWidth={2} dot={false} type="monotone" />
        <Line yAxisId="acwr" dataKey="acwr" name="ACWR" stroke={t.c.sleep} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
