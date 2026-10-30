"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { fmt } from "@/lib/format";

interface MacroDonutProps {
  protein: number;
  carbs: number;
  fat: number;
  height?: number;
}

/** Share of calories from each macro (grams in, kcal-weighted). */
export function MacroDonut({ protein, carbs, fat, height = 200 }: MacroDonutProps) {
  const t = useChartTheme();
  const data = [
    { name: "Protein", kcal: protein * 4, g: protein, color: t.c.protein },
    { name: "Carbs", kcal: carbs * 4, g: carbs, color: t.c.carbs },
    { name: "Fat", kcal: fat * 9, g: fat, color: t.c.fat },
  ];
  const total = data.reduce((a, d) => a + d.kcal, 0);
  if (!total) return <p className="py-10 text-center text-sm text-slate-500">No food logged.</p>;

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="relative w-full max-w-[200px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="kcal" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...t.tooltip} formatter={(v, name) => [`${fmt(Number(v))} kcal (${Math.round((Number(v) / total) * 100)}%)`, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-xl font-semibold tracking-tight text-slate-900">{fmt(total)}</span>
          <span className="text-[11px] text-slate-500">kcal from macros</span>
        </div>
      </div>
      <ul className="w-full space-y-3 text-sm">
        {data.map((d) => {
          const share = Math.round((d.kcal / total) * 100);
          return (
            <li key={d.name}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
                <span className="num text-slate-500">
                  {fmt(d.g, 1)} g · <b className="font-semibold text-slate-900">{share}%</b>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${share}%`, background: d.color }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
