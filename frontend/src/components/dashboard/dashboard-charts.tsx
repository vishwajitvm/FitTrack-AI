"use client";

import { Activity, Beef, Clock, Flame, LineChart, PieChart, Zap } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { EnergyStackChart } from "@/components/charts/energy-stack-chart";
import { IntakeTdeeChart } from "@/components/charts/intake-tdee-chart";
import { MacroCaloriesChart } from "@/components/charts/macro-calories-chart";
import { MacroDonut } from "@/components/charts/macro-donut";
import { MealTimingChart } from "@/components/charts/meal-timing-chart";
import { ProteinTargetChart } from "@/components/charts/protein-target-chart";
import { WeightTrendChart, weightPoints } from "@/components/charts/weight-trend-chart";
import { Skeleton } from "@/components/ui/misc";
import { useDaily } from "@/hooks/use-daily";
import { useProfile } from "@/hooks/use-profile";
import { trackedDays } from "@/lib/chart-data";
import { fmt } from "@/lib/format";
import {
  PENDING_NOTE,
  energyStackInsight,
  intakeVsTdeeInsight,
  macroCaloriesInsight,
  macroSplitInsight,
  mealTimingInsight,
  proteinInsight,
  weightInsight,
} from "@/lib/insights";
import type { Dashboard } from "@/lib/types";

/** All dashboard charts; each has a "how to read" tip and a plain-language takeaway. */
export function DashboardCharts({ data }: { data: Dashboard }) {
  const days = trackedDays(data.week);
  const pending = days.some((d) => d.estimated_tdee === null);
  const target = data.profile_metrics.protein_target_g;
  const weights = weightPoints(data.weight_trend);
  const today = data.today;
  const { data: detail, isLoading } = useDaily(today.date);
  const { data: profile } = useProfile();
  const ms = detail?.macro_split;

  return (
    <div className="space-y-5">
      <ChartCard
        title="Food eaten vs calories burned"
        description="Last 7 days · green shading = deficit"
        icon={<LineChart className="h-4 w-4" />}
        info="chart_intake_tdee"
        insight={intakeVsTdeeInsight(days)}
        note={pending ? PENDING_NOTE : null}
      >
        <IntakeTdeeChart days={days} />
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Protein vs target"
          description={target ? `Target ${fmt(target.min)}–${fmt(target.max)} g/day (1.6–2.0 g/kg)` : undefined}
          icon={<Beef className="h-4 w-4" />}
          info="chart_protein_target"
          insight={proteinInsight(days, target?.min ?? null, target?.max ?? null)}
        >
          <ProteinTargetChart days={days} min={target?.min ?? null} max={target?.max ?? null} />
        </ChartCard>
        <ChartCard title="Calories by macro" description="Protein · carbs · fat per day" icon={<Flame className="h-4 w-4" />} info="chart_macro_calories" insight={macroCaloriesInsight(days)}>
          <MacroCaloriesChart days={days} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Meal timing today"
          description={profile?.gym_return_time ? `Gym return ${profile.gym_return_time} · bed ${profile.bedtime ?? "—"}` : undefined}
          icon={<Clock className="h-4 w-4" />}
          info="chart_meal_timing"
          insight={detail ? mealTimingInsight(detail.foods, profile?.gym_return_time ?? null, profile?.bedtime ?? null) : null}
        >
          {isLoading ? <Skeleton className="h-60" /> : <MealTimingChart foods={detail?.foods ?? []} gymReturn={profile?.gym_return_time ?? null} bedtime={profile?.bedtime ?? null} />}
        </ChartCard>
        <ChartCard
          title="Macro split today"
          icon={<PieChart className="h-4 w-4" />}
          info="chart_macro_donut"
          insight={ms ? macroSplitInsight(ms.protein_pct, ms.carbs_pct, ms.fat_pct) : null}
        >
          <MacroDonut protein={today.total_protein} carbs={today.total_carbs} fat={today.total_fat} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Where your calories are burned"
          description="BMR + NEAT + TEF + exercise per day"
          icon={<Zap className="h-4 w-4" />}
          info="chart_energy_stack"
          insight={energyStackInsight(days[days.length - 1])}
          note={pending ? "Resting burn (BMR) and everyday movement (NEAT) appear once age and sex are set in Profile." : null}
        >
          <EnergyStackChart days={days} />
        </ChartCard>
        <ChartCard
          title="Weight trend"
          description={data.profile_metrics.weight_change_kg !== null ? `${fmt(data.profile_metrics.weight_change_kg, 1)} kg since start` : undefined}
          icon={<Activity className="h-4 w-4" />}
          info="chart_weight"
          insight={weightInsight(weights)}
        >
          <WeightTrendChart points={weights} />
        </ChartCard>
      </div>
    </div>
  );
}
