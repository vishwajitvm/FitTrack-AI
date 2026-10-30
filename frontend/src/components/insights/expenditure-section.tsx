"use client";

import { Flame } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { ExpenditureChart } from "@/components/charts/expenditure-chart";
import { ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/fx";
import { Progress, Skeleton } from "@/components/ui/misc";
import { useExpenditureInsight } from "@/hooks/use-insights";
import { fmt, pct } from "@/lib/format";
import { TDEE_SOURCE } from "@/lib/ml-labels";
import { expenditureInsight } from "@/lib/ml-insights";
import { KeyStat } from "./key-stat";

export function ExpenditureSection() {
  const { data, error, isLoading, mutate } = useExpenditureInsight(90);
  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !data) return <Skeleton className="h-96 rounded-2xl" />;
  const source = TDEE_SOURCE[data.tdee_source] ?? TDEE_SOURCE.pending;
  const conf = data.confidence ?? 0;
  const confLevel = conf >= 0.7 ? { word: "High", bar: "bg-good-fg", tone: "ok" as const } : conf >= 0.5 ? { word: "Medium", bar: "bg-warn-fg", tone: "warning" as const } : { word: "Low", bar: "bg-slate-400", tone: "neutral" as const };

  return (
    <ChartCard
      title="Your real calorie burn"
      description="Adaptive TDEE learned from your food log and weigh-ins"
      icon={<Flame className="h-4 w-4" />}
      info="chart_expenditure"
      insight={expenditureInsight(data)}
      note={data.notes.length ? data.notes.join(" ") : null}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KeyStat
          label="Adaptive TDEE"
          term="adaptive_tdee"
          value={
            data.adaptive_tdee !== null ? (
              <span className="text-acc-burn">
                <AnimatedNumber value={data.adaptive_tdee} />
                <span className="ml-1 text-sm font-normal text-slate-500">kcal</span>
              </span>
            ) : (
              "Learning…"
            )
          }
          sub={data.adaptive_low !== null && data.adaptive_high !== null ? <span className="num">likely {fmt(data.adaptive_low)}–{fmt(data.adaptive_high)}</span> : undefined}
        />
        <KeyStat
          label="Confidence"
          term="adaptive_confidence"
          value={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {pct(conf)}
              <Badge tone={confLevel.tone}>{confLevel.word}</Badge>
            </span>
          }
          sub={`${data.logged_days} logged days · ${data.weigh_ins_used} weigh-ins`}
        >
          <Progress value={conf * 100} className="mt-2 h-1.5" barClassName={confLevel.bar} />
        </KeyStat>
        <KeyStat
          className="col-span-2 sm:col-span-1"
          label="TDEE used"
          term="tdee_source"
          value={
            data.blended_tdee !== null ? (
              <>
                {fmt(data.blended_tdee)}
                <span className="ml-1 text-sm font-normal text-slate-500">kcal</span>
              </>
            ) : data.formula_tdee !== null ? (
              <>
                {fmt(data.formula_tdee)}
                <span className="ml-1 text-sm font-normal text-slate-500">kcal</span>
              </>
            ) : (
              "Pending"
            )
          }
          sub={
            <span className="mt-0.5 flex flex-wrap gap-1">
              <Badge tone={source.tone}>{source.label}</Badge>
              {data.formula_tdee !== null && <Badge tone="neutral">formula {fmt(data.formula_tdee)}</Badge>}
            </span>
          }
        />
      </div>
      <ExpenditureChart insight={data} />
    </ChartCard>
  );
}
