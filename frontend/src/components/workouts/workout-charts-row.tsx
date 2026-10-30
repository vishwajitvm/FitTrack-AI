"use client";

import { BarChart3, PieChart } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { SplitDistributionChart, WorkoutLoadChart, splitCounts } from "@/components/charts/workout-charts";
import { Skeleton } from "@/components/ui/misc";
import { useWorkoutHistory } from "@/hooks/use-workouts";
import { splitInsight, workoutLoadInsight } from "@/lib/insights";

export function WorkoutChartsRow() {
  const { data, isLoading } = useWorkoutHistory(30);
  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  const rows = data ?? [];
  const counts = splitCounts(rows);
  return (
    <div className="fade-up grid gap-5 xl:grid-cols-3">
      <ChartCard className="xl:col-span-2" title="Training load (30 days)" description="Minutes per day and exercise calories" icon={<BarChart3 className="h-4 w-4" />} info="chart_workout_load" insight={workoutLoadInsight(rows)}>
        <WorkoutLoadChart rows={rows} />
      </ChartCard>
      <ChartCard title="Split distribution" icon={<PieChart className="h-4 w-4" />} info="chart_split" insight={splitInsight(counts)}>
        <SplitDistributionChart counts={counts} />
      </ChartCard>
    </div>
  );
}
