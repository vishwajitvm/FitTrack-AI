"use client";

import type { ReactNode } from "react";
import { Beef, Dumbbell, Flame, Scale, TrendingDown } from "lucide-react";
import { ACCENT, AnimatedNumber, IconBubble, Sparkline, type Accent } from "@/components/ui/fx";
import type { HistorySummary } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Averages over every day that matches the current search & filters, with a trend line each. */
export function HistorySummaryStrip({ summary }: { summary: HistorySummary }) {
  const s = summary.series;
  const change = summary.weight_change;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile accent="kcal" icon={<Flame className="h-4 w-4" />} label="Avg eaten" value={summary.avg_calories} unit="kcal / day" spark={s.map((p) => p.calories)} delay={0} />
        <Tile accent="protein" icon={<Beef className="h-4 w-4" />} label="Avg protein" value={summary.avg_protein} unit="g / day" spark={s.map((p) => p.protein)} delay={60} />
        <Tile accent="balance" icon={<TrendingDown className="h-4 w-4" />} label="Avg deficit" value={summary.avg_deficit} unit="kcal / day" spark={s.map((p) => p.deficit)} delay={120} />
        <Tile
          accent="weight"
          icon={<Scale className="h-4 w-4" />}
          label="Weight change"
          value={change}
          digits={1}
          prefix={change !== null && change > 0 ? "+" : ""}
          unit={summary.weigh_ins > 1 ? `kg over ${summary.weigh_ins} weigh-ins` : "needs 2+ weigh-ins"}
          spark={s.map((p) => p.weight)}
          delay={180}
        />
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Dumbbell className="h-3.5 w-3.5 text-acc-burn" />
          Trained on <b className="text-slate-700">{summary.trained_days}</b> of {summary.days} days
        </span>
        <span>·</span>
        <span>Food logged on {summary.food_days} days</span>
      </p>
    </div>
  );
}

interface TileProps {
  accent: Accent;
  icon: ReactNode;
  label: string;
  value: number | null;
  unit: string;
  spark: (number | null)[];
  digits?: number;
  prefix?: string;
  delay: number;
}

function Tile({ accent, icon, label, value, unit, spark, digits = 0, prefix = "", delay }: TileProps) {
  return (
    <div className={cn("fade-up lift relative overflow-hidden rounded-2xl border bg-card p-4 shadow-card", ACCENT[accent].border)} style={{ animationDelay: `${delay}ms` }}>
      <div className={cn("pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl", ACCENT[accent].tint)} aria-hidden />
      <div className="relative flex items-center gap-2.5">
        <IconBubble accent={accent} className="h-8 w-8">
          {icon}
        </IconBubble>
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
      </div>
      <p className="relative mt-2 text-2xl font-bold text-slate-900">
        {value === null ? "—" : (
          <>
            {prefix}
            <AnimatedNumber value={value} digits={digits} />
          </>
        )}
      </p>
      <p className="relative text-[11px] text-slate-500">{value === null ? "not enough data" : unit}</p>
      <Sparkline values={spark} accent={accent} height={30} className="relative mt-2" />
    </div>
  );
}
