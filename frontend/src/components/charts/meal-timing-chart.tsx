"use client";

import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, type TooltipProps } from "recharts";
import { EmptyState } from "@/components/common/states";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { foodHour, hoursToLabel, timeToHours } from "@/lib/chart-data";
import { fmt } from "@/lib/format";
import type { FoodLog } from "@/lib/types";
import { axisProps, gridProps } from "./axis";

interface MealTimingChartProps {
  foods: FoodLog[];
  gymReturn: string | null;
  bedtime: string | null;
  height?: number;
}

interface Point {
  hour: number;
  kcal: number;
  name: string;
  estimated: boolean;
}

/** Calories by time of day, with the gym-return → bedtime window shaded. */
export function MealTimingChart({ foods, gymReturn, bedtime, height = 240 }: MealTimingChartProps) {
  const t = useChartTheme();
  if (!foods.length) return <EmptyState title="Nothing logged for this day" />;
  const data: Point[] = foods.map((f) => {
    const { hour, estimated } = foodHour(f);
    return { hour, kcal: Math.round(f.calories), name: f.food_name, estimated };
  });
  const ret = timeToHours(gymReturn);
  const bed = timeToHours(bedtime);
  const maxKcal = Math.max(...data.map((d) => d.kcal));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 20, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid {...gridProps(t, { vertical: true })} />
        <XAxis type="number" dataKey="hour" domain={[5, 24]} ticks={[6, 9, 12, 15, 18, 21, 24]} tickFormatter={(h) => hoursToLabel(Number(h))} {...axisProps(t)} />
        <YAxis type="number" dataKey="kcal" {...axisProps(t)} width={48} domain={[0, Math.ceil((maxKcal * 1.15) / 50) * 50]} />
        <ZAxis type="number" dataKey="kcal" range={[50, 420]} />
        <ReferenceArea x1={20.5} x2={24} fill={t.c.window} fillOpacity={0.5} />
        {/* The two lines are ~20 min apart, so one combined label avoids overlapping text. */}
        {ret !== null && <ReferenceLine x={ret} stroke={t.c.late} strokeDasharray="4 4" />}
        {bed !== null && (
          <ReferenceLine
            x={bed}
            stroke={t.c.surplus}
            strokeDasharray="4 4"
            label={{ value: ret !== null ? `Gym ${gymReturn} → bed ${bedtime}` : `Bed ${bedtime}`, position: "insideTopRight", fill: t.axis, fontSize: 10 }}
          />
        )}
        <Tooltip {...t.tooltip} content={<TimingTooltip bg={t.tooltip.contentStyle} />} />
        <Scatter data={data} fill={t.c.intake} fillOpacity={0.6} stroke={t.c.intake} strokeWidth={1.5} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function TimingTooltip({ active, payload, bg }: TooltipProps<number, string> & { bg: React.CSSProperties }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div style={{ ...bg, padding: "8px 12px" }}>
      <p style={{ fontWeight: 600 }}>{p.name}</p>
      <p>
        {fmt(p.kcal)} kcal at {hoursToLabel(p.hour)}
        {p.estimated ? " (estimated time)" : ""}
      </p>
    </div>
  );
}
