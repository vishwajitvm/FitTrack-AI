"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type DotProps } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme, type ChartTheme } from "@/hooks/use-chart-theme";
import { fmt, shortDate } from "@/lib/format";
import type { WeightInsight } from "@/lib/types";
import { axisProps, chartMargin, gridProps, legendProps } from "./axis";

interface Row {
  date: string;
  weight?: number | null;
  outlier?: number | null;
  trend?: number | null;
  band?: [number, number] | null;
  projection?: number | null;
}

/** Merge measured points and the forecast into one date-ordered series. */
function buildRows(w: WeightInsight): Row[] {
  const rows = new Map<string, Row>();
  for (const p of w.points) {
    rows.set(p.date, {
      date: p.date,
      weight: p.outlier ? null : p.weight,
      outlier: p.outlier ? p.weight : null,
      trend: p.trend,
      band: p.lower !== null && p.upper !== null ? [p.lower, p.upper] : null,
    });
  }
  const lastTrend = [...w.points].reverse().find((p) => p.trend !== null);
  if (w.forecast?.projected.length && lastTrend) {
    // Start the dashed projection at the last trend point so the lines join.
    rows.get(lastTrend.date)!.projection = lastTrend.trend;
    for (const p of w.forecast.projected) rows.set(p.date, { ...(rows.get(p.date) ?? { date: p.date }), projection: p.weight });
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function OutlierDot({ cx, cy, value, t }: DotProps & { value?: number | null; t?: ChartTheme }) {
  // Recharts calls the dot renderer for every row; only draw where there is an outlier value.
  if (cx === undefined || cy === undefined || value === null || value === undefined) return <g />;
  return (
    <g stroke={t?.c.surplus} strokeWidth={2} strokeLinecap="round">
      <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} />
      <line x1={cx - 4} y1={cy + 4} x2={cx + 4} y2={cy - 4} />
    </g>
  );
}

export function KalmanWeightChart({ insight, height = 280 }: { insight: WeightInsight; height?: number }) {
  const t = useChartTheme();
  const rows = buildRows(insight);
  const values = rows.flatMap((r) => [r.weight, r.outlier, r.projection, ...(r.band ?? [])]).filter((v): v is number => typeof v === "number");
  if (insight.target_weight !== null) values.push(insight.target_weight);
  if (!values.length) return <EmptyState title="No weigh-ins yet" description="Log your morning weight in the daily check-in." />;
  const hasProjection = rows.some((r) => typeof r.projection === "number");
  const hasOutliers = rows.some((r) => typeof r.outlier === "number");
  const domain: [number, number] = [Math.floor(Math.min(...values) - 0.5), Math.ceil(Math.max(...values) + 0.5)];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ ...chartMargin, left: -4 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps(t)} interval="preserveStartEnd" minTickGap={24} />
        <YAxis domain={domain} allowDecimals={false} {...axisProps(t)} width={48} unit="kg" />
        <Tooltip
          {...t.tooltip}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v, name) => {
            if (Array.isArray(v)) return [`${fmt(Number(v[0]), 1)}–${fmt(Number(v[1]), 1)} kg`, name];
            return [v === null || v === undefined ? "—" : `${fmt(Number(v), 1)} kg`, name];
          }}
        />
        <Legend {...legendProps(t)} />
        {insight.target_weight !== null && (
          <ReferenceLine y={insight.target_weight} stroke={t.c.deficit} strokeDasharray="6 4" label={{ value: `Target ${fmt(insight.target_weight, 1)} kg`, position: "insideBottomRight", fill: t.axis, fontSize: 10 }} />
        )}
        <Area dataKey="band" name="Likely range" fill={t.c.carbs} fillOpacity={0.14} stroke="none" connectNulls legendType="square" isAnimationActive={false} />
        <Line dataKey="trend" name="Trend weight" stroke={t.c.carbs} strokeWidth={2.75} dot={false} connectNulls type="monotone" />
        {hasProjection && <Line dataKey="projection" name="Projection" stroke={t.c.carbs} strokeOpacity={0.8} strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls />}
        {/* strokeWidth 0 (not stroke "none") keeps the legend icon coloured while hiding the connecting line */}
        <Line dataKey="weight" name="Weigh-in" stroke={t.c.carbs} strokeWidth={0} legendType="circle" dot={{ r: 3.5, fill: t.c.carbs, fillOpacity: 0.4, stroke: t.c.carbs, strokeOpacity: 0.7 }} activeDot={false} isAnimationActive={false} />
        {hasOutliers && (
          <Line dataKey="outlier" name="Outlier (ignored)" stroke={t.c.surplus} strokeWidth={0} legendType="cross" dot={<OutlierDot t={t} />} activeDot={false} isAnimationActive={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
