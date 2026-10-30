"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { fmt } from "@/lib/format";
import type { ReadinessModelInfo } from "@/lib/types";
import { axisProps, gridProps } from "./axis";

/** Horizontal bars: effect of +1 SD of each factor on next-morning energy (1–10). Indigo lifts energy, red lowers it. */
export function CoefficientsChart({ coefficients }: { coefficients: ReadinessModelInfo["coefficients"] }) {
  const t = useChartTheme();
  if (!coefficients.length) return <EmptyState title="No model yet" description="It appears after 14 days of check-ins." />;
  const data = [...coefficients].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).map((c) => ({ ...c, weight: Math.round(c.weight * 100) / 100 }));
  const max = Math.max(0.5, ...data.map((d) => Math.abs(d.weight)));
  const lim = Math.ceil(max * 2) / 2;

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps(t, { vertical: true, horizontal: false })} />
        <XAxis type="number" domain={[-lim, lim]} {...axisProps(t)} tickFormatter={(v) => (v > 0 ? `+${v}` : String(v))} />
        <YAxis type="category" dataKey="label" {...axisProps(t)} width={120} tick={{ fontSize: 10, fill: t.axis }} />
        <ReferenceLine x={0} stroke={t.axis} strokeOpacity={0.6} />
        <Tooltip {...t.tooltip} formatter={(v) => [`${Number(v) > 0 ? "+" : ""}${fmt(Number(v), 2)} energy points`, "Effect"]} />
        <Bar dataKey="weight" radius={[0, 6, 6, 0]} maxBarSize={16}>
          {data.map((d) => (
            <Cell key={d.feature} fill={d.weight >= 0 ? t.c.sleep : t.c.surplus} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
