"use client";

import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, type DotProps } from "recharts";
import { useChartTheme, type ChartTheme } from "@/hooks/use-chart-theme";
import { fmt, prettyDate } from "@/lib/format";
import { axisProps, chartMargin, gridProps } from "./axis";

interface BiomarkerTrendChartProps {
  name: string;
  series: { date: string; value: number | null; status: string }[];
  refLow: number | null;
  refHigh: number | null;
  unit: string | null;
  height?: number;
}

function statusColor(t: ChartTheme, status: string | undefined) {
  if (status === "normal") return t.c.deficit;
  if (status === "borderline") return t.c.late;
  if (status === "low" || status === "high") return t.c.surplus;
  return t.axis;
}

function StatusDot({ cx, cy, payload, t }: DotProps & { payload?: { status?: string }; t?: ChartTheme }) {
  // Recharts clones this element for every point and injects cx / cy / payload.
  if (cx === undefined || cy === undefined || !t) return <g />;
  return <circle cx={cx} cy={cy} r={5} fill={statusColor(t, payload?.status)} stroke={t.tooltip.contentStyle.background} strokeWidth={2} />;
}

/** Biomarker values over time with the lab reference range shaded; each reading is coloured by its status. */
export function BiomarkerTrendChart({ name, series, refLow, refHigh, unit, height = 240 }: BiomarkerTrendChartProps) {
  const t = useChartTheme();
  const values = series.map((p) => p.value).filter((v): v is number => v !== null);
  const lo = Math.min(...values, refLow ?? Infinity);
  const hi = Math.max(...values, refHigh ?? -Infinity);
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
  const domain: [number, number] = [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={series} margin={{ ...chartMargin, top: 12 }}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={(d) => prettyDate(String(d), { month: "short", year: "2-digit" })} {...axisProps(t)} />
        <YAxis domain={domain} {...axisProps(t)} width={52} />
        {(refLow !== null || refHigh !== null) && (
          <ReferenceArea
            y1={refLow ?? domain[0]}
            y2={refHigh ?? domain[1]}
            fill={t.c.band}
            stroke={t.c.deficit}
            strokeOpacity={0.35}
            strokeDasharray="4 4"
            label={{ value: "Normal range", position: "insideTopLeft", fill: t.axis, fontSize: 10 }}
          />
        )}
        <Tooltip
          {...t.tooltip}
          labelFormatter={(l) => prettyDate(String(l), { day: "numeric", month: "short", year: "numeric" })}
          formatter={(v, _n, item) => [`${fmt(Number(v), 2)} ${unit ?? ""} · ${item.payload.status}`, name]}
        />
        <Line type="monotone" dataKey="value" stroke={t.ink} strokeOpacity={0.55} strokeWidth={2} dot={<StatusDot t={t} />} activeDot={{ r: 6, fill: t.ink }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
