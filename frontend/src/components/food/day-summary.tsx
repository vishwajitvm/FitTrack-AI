"use client";

import type { ReactNode } from "react";
import { Beef, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ACCENT, AnimatedNumber, MetricRing, type Accent } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import type { GlossaryKey } from "@/config/glossary";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MacroDot, MacroSplitBar, macroCalories, useMacroColors } from "./macro";

export interface DayTotals {
  kcal: number;
  p: number;
  c: number;
  f: number;
  fib: number;
}

interface DaySummaryProps {
  totals: DayTotals;
  /** "Eaten" in Simple mode, "Calories" in Detailed mode. */
  kcalLabel: string;
  itemCount: number;
  mealCount: number;
  calorieTarget: number | null;
  proteinTarget: number | null;
}

type Tone = "neutral" | "ok" | "warning";
const pill: Record<Tone, string> = { neutral: "bg-slate-100 text-slate-600", ok: "bg-good-bg text-good-fg", warning: "bg-warn-bg text-warn-fg" };
const dot: Record<Tone, string> = { neutral: "bg-slate-400", ok: "bg-good-fg", warning: "bg-warn-fg" };

/** The top of the food log: two rings (calories, protein) against today's targets and the macro split. */
export function DaySummary({ totals, kcalLabel, itemCount, mealCount, calorieTarget, proteinTarget }: DaySummaryProps) {
  const colors = useMacroColors();
  const { parts, total } = macroCalories(totals.p, totals.c, totals.f);
  const share = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const kcalStatus: { tone: Tone; text: string } = !calorieTarget
    ? { tone: "neutral", text: "No target yet" }
    : totals.kcal > calorieTarget
      ? { tone: "warning", text: `${fmt(totals.kcal - calorieTarget)} kcal over` }
      : { tone: "neutral", text: `${fmt(calorieTarget - totals.kcal)} kcal left` };
  const proteinStatus: { tone: Tone; text: string } = !proteinTarget
    ? { tone: "neutral", text: "No target yet" }
    : totals.p >= proteinTarget
      ? { tone: "ok", text: "Target reached" }
      : { tone: "neutral", text: `${fmt(proteinTarget - totals.p)} g to go` };

  return (
    <Card className="fade-up mb-5 overflow-hidden">
      <div className="grid gap-6 p-5 xl:grid-cols-2 xl:gap-0">
        <div className="grid grid-cols-2 gap-4 xl:pr-6">
          <RingStat
            accent="kcal"
            icon={<Flame className="h-4 w-4" />}
            label={kcalLabel}
            value={totals.kcal}
            target={calorieTarget}
            unit="kcal"
            status={kcalStatus}
          />
          <RingStat
            accent="protein"
            icon={<Beef className="h-4 w-4" />}
            label="Protein"
            info="protein_target"
            value={totals.p}
            digits={1}
            target={proteinTarget}
            unit="g"
            status={proteinStatus}
          />
        </div>

        <div className="xl:border-l xl:border-line xl:pl-6">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-[13px] font-medium text-slate-500">
              Macro split <InfoTip term="macro_split" />
            </p>
            <span className="text-xs text-slate-400">share of calories</span>
          </div>
          <MacroSplitBar protein={totals.p} carbs={totals.c} fat={totals.f} className="mt-3" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(
              [
                ["protein", "Protein", totals.p, parts.protein],
                ["carbs", "Carbs", totals.c, parts.carbs],
                ["fat", "Fat", totals.f, parts.fat],
              ] as const
            ).map(([key, label, grams, kcal]) => (
              <div key={key} className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] text-slate-500">
                  <MacroDot color={colors[key]} /> {label}
                </p>
                <p className="num mt-1 text-lg font-semibold leading-none tracking-tight text-slate-900">
                  {fmt(grams, 1)}
                  <span className="ml-0.5 text-xs font-normal text-slate-500">g</span>
                </p>
                <p className="num mt-1 text-xs text-slate-400">{total ? `${share(kcal)}%` : "—"}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
              <MacroDot color={colors.fibre} /> Fibre <InfoTip term="fibre" />
            </span>
            <span className="num text-sm font-semibold text-slate-900">
              {fmt(totals.fib, 1)} <span className="text-xs font-normal text-slate-500">g</span>
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-line bg-slate-50/70 px-5 py-2.5 text-[13px] text-slate-500">
        {itemCount === 0 ? "Nothing logged yet for this day." : `${itemCount} item${itemCount === 1 ? "" : "s"} across ${mealCount} meal${mealCount === 1 ? "" : "s"}`}
      </div>
    </Card>
  );
}

interface RingStatProps {
  accent: Accent;
  icon: ReactNode;
  label: string;
  info?: GlossaryKey;
  value: number;
  digits?: number;
  target: number | null;
  unit: string;
  status: { tone: Tone; text: string };
}

function RingStat({ accent, icon, label, info, value, digits = 0, target, unit, status }: RingStatProps) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
      <MetricRing value={target ? value / target : 0} accent={accent} size={96} stroke={9} label={`${label}: ${fmt(value, digits)} ${unit}${target ? ` of ${fmt(target)} ${unit}` : ""}`}>
        <span className={ACCENT[accent].text}>{icon}</span>
        <span className="mt-0.5 text-lg font-semibold leading-none tracking-tight text-slate-900">
          <AnimatedNumber value={value} digits={digits} />
        </span>
        <span className="text-[11px] text-slate-500">{unit}</span>
      </MetricRing>
      <div className="min-w-0">
        <p className="flex items-center justify-center gap-1 text-[13px] font-medium text-slate-500 sm:justify-start">
          {label}
          {info && <InfoTip term={info} />}
        </p>
        <p className="num mt-0.5 text-sm text-slate-700">{target ? `of ${fmt(target)} ${unit}` : "—"}</p>
        <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", pill[status.tone])}>
          <span className={cn("h-1.5 w-1.5 rounded-full", dot[status.tone])} />
          {status.text}
        </span>
      </div>
    </div>
  );
}
