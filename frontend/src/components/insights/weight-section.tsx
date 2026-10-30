"use client";

import { Activity, PauseCircle } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { KalmanWeightChart } from "@/components/charts/kalman-weight-chart";
import { ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import { Skeleton } from "@/components/ui/misc";
import { useWeightInsight } from "@/hooks/use-insights";
import { fmt, prettyDate } from "@/lib/format";
import { RATE_STATUS } from "@/lib/ml-labels";
import { weightTrendInsight } from "@/lib/ml-insights";
import { KeyStat } from "./key-stat";

export function WeightSection() {
  const { data, error, isLoading, mutate } = useWeightInsight(90);
  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !data) return <Skeleton className="h-96 rounded-2xl" />;
  const status = RATE_STATUS[data.rate_status] ?? RATE_STATUS.insufficient_data;

  return (
    <div className="space-y-4">
      {data.plateau.detected && (
        <div className="fade-up relative flex items-start gap-3 overflow-hidden rounded-2xl border border-line bg-card py-3.5 pl-5 pr-4 shadow-card before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-warn-fg">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warn-bg text-warn-fg">
            <PauseCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="flex items-center gap-1 font-semibold text-slate-900">
              Plateau detected{data.plateau.since ? ` since ${prettyDate(data.plateau.since)}` : ""} <InfoTip term="plateau" />
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{data.plateau.message}</p>
          </div>
        </div>
      )}
      <ChartCard
        title="Weight trend & goal forecast"
        description="Kalman-smoothed trend, likely range, outliers and projection"
        icon={<Activity className="h-4 w-4" />}
        info="chart_weight_kalman"
        insight={weightTrendInsight(data)}
        note={data.notes.length ? data.notes.join(" ") : null}
        action={
          <span className="hidden items-center gap-1 sm:flex">
            <Badge tone={status.tone}>{status.label}</Badge>
            <InfoTip term="rate_status" />
          </span>
        }
      >
        <span className="flex items-center gap-1 sm:hidden">
          <Badge tone={status.tone}>{status.label}</Badge>
          <InfoTip term="rate_status" />
        </span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KeyStat
            label="Trend weight"
            term="trend_weight"
            value={
              data.trend_weight !== null ? (
                <>
                  <AnimatedNumber value={data.trend_weight} digits={1} />
                  <span className="ml-1 text-sm font-normal text-slate-500">kg</span>
                </>
              ) : (
                "—"
              )
            }
          />
          <KeyStat
            label="Rate"
            term="weight_rate"
            value={data.rate_kg_per_week !== null ? `${data.rate_kg_per_week > 0 ? "+" : ""}${fmt(data.rate_kg_per_week, 2)} kg/wk` : "—"}
            sub={data.rate_pct_per_week !== null ? `${fmt(data.rate_pct_per_week, 2)}% per week` : undefined}
          />
          <KeyStat
            className="col-span-2 sm:col-span-1"
            label="Goal date"
            term="goal_eta"
            value={data.forecast?.eta_date ? prettyDate(data.forecast.eta_date, { day: "numeric", month: "short", year: "numeric" }) : "—"}
            sub={data.forecast?.days_remaining ? `${fmt(data.forecast.days_remaining)} days to go` : data.target_weight === null ? "set a target in Profile" : undefined}
          />
        </div>
        <KalmanWeightChart insight={data} />
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
          Smoothing <InfoTip term="kalman" /> · band <InfoTip term="uncertainty_band" /> · outliers <InfoTip term="outlier_weighin" />
        </p>
      </ChartCard>
    </div>
  );
}
