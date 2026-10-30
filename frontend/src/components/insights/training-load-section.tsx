"use client";

import { Activity, Dumbbell, Gauge, Repeat, Zap } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { TrainingLoadChart } from "@/components/charts/training-load-chart";
import { StatCard } from "@/components/common/stat-card";
import { ErrorState } from "@/components/common/states";
import { Skeleton } from "@/components/ui/misc";
import { useTrainingLoad } from "@/hooks/use-insights";
import { fmt } from "@/lib/format";
import { ACWR_ZONE } from "@/lib/ml-labels";
import { trainingLoadInsight } from "@/lib/ml-insights";
import { usePrefs } from "@/components/layout/prefs-provider";
import { statTone } from "./key-stat";

export function TrainingLoadSection() {
  const { data, error, isLoading, mutate } = useTrainingLoad(56);
  const { simple, t } = usePrefs();
  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !data) return <Skeleton className="h-96 rounded-2xl" />;
  const zone = data.acwr_zone ? ACWR_ZONE[data.acwr_zone] : null;
  const recent = data.points.slice(-28);

  return (
    <section className="space-y-4">
      <div className={simple ? "grid grid-cols-2 gap-4" : "grid grid-cols-2 gap-4 lg:grid-cols-4"}>
        <div className="fade-up">
          <StatCard
            label={t("This week vs usual", "ACWR")}
            info="acwr"
            accent="burn"
            icon={<Gauge className="h-4 w-4" />}
            value={simple ? (zone ? zone.label.split(" (")[0] : "Too early") : data.acwr !== null ? fmt(data.acwr, 2) : "—"}
            tone={!simple && zone ? statTone(zone.tone) : "default"}
            status={!simple && zone ? zone.label : undefined}
            sub={zone ? (simple ? `Training load is ${zone.label.toLowerCase().split(" (")[0]}` : "acute ÷ chronic load") : "needs a few weeks of training"}
            spark={recent.map((p) => p.acwr)}
          />
        </div>
        <div className="fade-up" style={{ animationDelay: "50ms" }}>
          <StatCard
            label={t("Work done this week", "Weekly load")}
            info="training_load"
            accent="burn"
            icon={<Dumbbell className="h-4 w-4" />}
            value={fmt(data.weekly_load)}
            unit="units"
            sub={t("minutes × how hard it felt", "minutes × session RPE, last 7 days")}
            spark={recent.map((p) => p.acute)}
          />
        </div>
        {!simple && (
          <div className="fade-up" style={{ animationDelay: "100ms" }}>
            <StatCard
              label="Monotony"
              info="monotony"
              icon={<Repeat className="h-4 w-4" />}
              value={data.monotony !== null ? fmt(data.monotony, 2) : "—"}
              tone={data.monotony !== null && data.monotony > 2 ? "warning" : "default"}
              status={data.monotony !== null && data.monotony > 2 ? "High" : undefined}
            />
          </div>
        )}
        {!simple && (
          <div className="fade-up" style={{ animationDelay: "150ms" }}>
            <StatCard label="Strain" info="strain" icon={<Zap className="h-4 w-4" />} value={data.strain !== null ? fmt(data.strain) : "—"} />
          </div>
        )}
      </div>
      <ChartCard
        title="Training load (8 weeks)"
        description="Minutes × session RPE, with fatigue vs fitness"
        icon={<Activity className="h-4 w-4" />}
        info="chart_training_load"
        insight={trainingLoadInsight(data)}
        note={data.notes.length ? data.notes.join(" ") : null}
      >
        <TrainingLoadChart insight={data} />
      </ChartCard>
    </section>
  );
}
