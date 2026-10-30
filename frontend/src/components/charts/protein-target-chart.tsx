"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { daysWithFood } from "@/lib/chart-data";
import { fmt, shortDate } from "@/lib/format";
import type { DailySummary } from "@/lib/types";
import { axisProps, chartMargin, gridProps } from "./axis";

interface ProteinTargetChartProps {
  days: DailySummary[];
  min: number | null;
  max: number | null;
  height?: number;
}

/** Daily protein bars against the 1.6–2.0 g/kg target band. */
export function ProteinTargetChart({ days, min, max, height = 240 }: ProteinTargetChartProps) {
  const t = useChartTheme();
  const fed = daysWithFood(days);
  if (!fed.length) return <EmptyState title="No food logged in this period" />;
  const data = fed.map((d) => ({ date: d.date, protein: Math.round(d.total_protein * 10) / 10, perKg: d.protein_per_kg }));
  const top = Math.ceil((Math.max(max ?? 0, ...data.map((d) => d.protein)) * 1.1) / 50) * 50;
  const ticks = Array.from({ length: top / 50 + 1 }, (_, i) => i * 50);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps(t)} />
        <YAxis {...axisProps(t)} width={44} domain={[0, top]} ticks={ticks} unit="g" />
        {min !== null && max !== null && (
          <ReferenceArea y1={min} y2={max} fill={t.c.band} stroke={t.c.protein} strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `Target ${fmt(min)}–${fmt(max)} g`, position: "insideTopRight", fill: t.axis, fontSize: 10 }} />
        )}
        {min !== null && <ReferenceLine y={min} stroke={t.c.protein} strokeDasharray="4 4" />}
        <Tooltip
          {...t.tooltip}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v, _n, item) => [`${fmt(Number(v), 1)} g${item.payload.perKg !== null ? ` (${fmt(item.payload.perKg, 2)} g/kg)` : ""}`, "Protein"]}
        />
        <Bar dataKey="protein" name="Protein" radius={[6, 6, 0, 0]} maxBarSize={36}>
          {data.map((d) => (
            <Cell key={d.date} fill={min !== null && d.protein >= min ? t.c.protein : d.protein >= (min ?? 0) * 0.6 ? t.c.fat : t.c.surplus} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
