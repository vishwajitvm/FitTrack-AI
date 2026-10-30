"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { daysWithFood } from "@/lib/chart-data";
import { fmt, shortDate } from "@/lib/format";
import type { DailySummary } from "@/lib/types";
import { axisProps, chartMargin, gridProps, legendProps } from "./axis";

/** Stacked calories per day from protein (4/g), carbs (4/g) and fat (9/g). */
export function MacroCaloriesChart({ days, height = 240 }: { days: DailySummary[]; height?: number }) {
  const t = useChartTheme();
  const fed = daysWithFood(days);
  if (!fed.length) return <EmptyState title="No food logged in this period" />;
  const data = fed.map((d) => ({
    date: d.date,
    protein: Math.round(d.total_protein * 4),
    carbs: Math.round(d.total_carbs * 4),
    fat: Math.round(d.total_fat * 9),
    pg: d.total_protein,
    cg: d.total_carbs,
    fg: d.total_fat,
  }));
  const grams: Record<string, "pg" | "cg" | "fg"> = { Protein: "pg", Carbs: "cg", Fat: "fg" };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps(t)} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps(t)} />
        <YAxis {...axisProps(t)} width={52} />
        <Tooltip
          {...t.tooltip}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v, name, item) => [`${fmt(Number(v))} kcal (${fmt(item.payload[grams[String(name)]], 1)} g)`, name]}
        />
        <Legend {...legendProps(t)} />
        <Bar dataKey="protein" name="Protein" stackId="m" fill={t.c.protein} maxBarSize={36} />
        <Bar dataKey="carbs" name="Carbs" stackId="m" fill={t.c.carbs} maxBarSize={36} />
        <Bar dataKey="fat" name="Fat" stackId="m" fill={t.c.fat} radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
