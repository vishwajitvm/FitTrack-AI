"use client";

import { Brain } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { CoefficientsChart } from "@/components/charts/coefficients-chart";
import { ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { MetricRing } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import { Progress, Skeleton } from "@/components/ui/misc";
import { useReadinessModel } from "@/hooks/use-insights";
import { fmt } from "@/lib/format";
import { READINESS_MODE } from "@/lib/ml-labels";
import { readinessModelInsight } from "@/lib/ml-insights";
import { usePrefs } from "@/components/layout/prefs-provider";

export function ReadinessModelCard() {
  const { data, error, isLoading, mutate } = useReadinessModel();
  const { simple } = usePrefs();
  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !data) return <Skeleton className="h-80 rounded-2xl" />;
  const active = data.mode === "personal_model";
  const p = data.prediction_today;

  return (
    <ChartCard
      title="What drives your energy"
      description="Personal readiness model"
      icon={<Brain className="h-4 w-4" />}
      info="chart_coefficients"
      insight={readinessModelInsight(data)}
      note={data.notes.length ? data.notes.join(" ") : null}
    >
      <div className="flex items-center gap-4 rounded-xl border border-line bg-slate-50/70 p-3.5">
        <MetricRing value={p !== null ? p / 10 : 0} accent="sleep" size={72} stroke={7} label={p !== null ? `Predicted energy today ${fmt(p, 1)} out of 10` : "No prediction yet"}>
          <span className="num text-base font-semibold leading-none text-slate-900">{p !== null ? fmt(p, 1) : "—"}</span>
          <span className="text-[10px] text-slate-500">/ 10</span>
        </MetricRing>
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-semibold text-slate-900">{p !== null ? "Predicted energy today" : "No prediction yet"}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={active ? "ok" : "neutral"}>{READINESS_MODE[data.mode]}</Badge>
            <InfoTip term="readiness_model" />
            {!simple && data.r2 !== null && (
              <span className="flex items-center gap-1 text-xs text-slate-600">
                R² <span className="num font-medium">{fmt(data.r2, 2)}</span> <InfoTip term="r2" />
              </span>
            )}
          </div>
        </div>
      </div>
      {!active && (
        <div>
          <div className="mb-1.5 flex justify-between text-[13px] text-slate-600">
            <span>Check-ins collected</span>
            <span className="num font-medium text-slate-900">
              {data.samples}/{data.min_samples}
            </span>
          </div>
          <Progress value={data.samples} max={data.min_samples} className="h-1.5" barClassName="bg-acc-sleep" />
        </div>
      )}
      {active ? (
        <CoefficientsChart coefficients={data.coefficients} />
      ) : (
        <p className="text-[13px] leading-relaxed text-slate-500">Until then, readiness uses rules (sleep, energy, soreness, recent intake). Daily check-ins unlock your personal model.</p>
      )}
    </ChartCard>
  );
}
