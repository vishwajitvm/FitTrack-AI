"use client";

import { useState, type ReactNode } from "react";
import { Activity, Beef, CalendarRange, ChevronRight, Flame, LineChart, Moon, TrendingDown, Utensils, Zap } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { EnergyStackChart } from "@/components/charts/energy-stack-chart";
import { IntakeTdeeChart } from "@/components/charts/intake-tdee-chart";
import { MacroCaloriesChart } from "@/components/charts/macro-calories-chart";
import { ProteinTargetChart } from "@/components/charts/protein-target-chart";
import { WeightTrendChart, weightPoints } from "@/components/charts/weight-trend-chart";
import { StatCard } from "@/components/common/stat-card";
import { ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AnimatedNumber, MiniBar } from "@/components/ui/fx";
import { WithTip } from "@/components/ui/info-tip";
import { Segmented, Skeleton } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useDailyRange } from "@/hooks/use-daily";
import { useProfileMetrics } from "@/hooks/use-profile";
import { avg, daysWithFood, trackedDays } from "@/lib/chart-data";
import { addDays, fmt, prettyDate, today } from "@/lib/format";
import { PENDING_NOTE, energyStackInsight, intakeVsTdeeInsight, macroCaloriesInsight, proteinInsight, weightInsight } from "@/lib/insights";
import type { DailySummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

const mean = (rows: DailySummary[], pick: (r: DailySummary) => number | null) => avg(rows.map(pick).filter((v): v is number => v !== null && v !== undefined));

/** Animated number, or a dash when there is no data. */
const num = (v: number | null | undefined, digits = 0) => (v === null || v === undefined || Number.isNaN(v) ? "—" : <AnimatedNumber value={v} digits={digits} />);

function AlertBadges({ d, compact }: { d: DailySummary; /** Phone rows: only the most serious badge. */ compact?: boolean }) {
  const crit = d.alerts.filter((a) => a.level === "critical").length;
  const warn = d.alerts.filter((a) => a.level === "warning").length;
  if (compact) return crit ? <Badge tone="critical">{crit} critical</Badge> : warn ? <Badge tone="warning">{warn} warning</Badge> : <Badge tone="ok">OK</Badge>;
  return (
    <div className="flex gap-1">
      {crit > 0 && <Badge tone="critical">{crit} critical</Badge>}
      {warn > 0 && <Badge tone="warning">{warn} warning</Badge>}
      {!crit && !warn && <Badge tone="ok">OK</Badge>}
    </div>
  );
}

export function RangeView({ onPickDate }: { onPickDate: (date: string) => void }) {
  const [range, setRange] = useState("7");
  const end = today();
  const start = addDays(end, -(Number(range) - 1));
  const { data, error, isLoading, mutate } = useDailyRange(start, end);
  const { data: metrics } = useProfileMetrics();
  const days = trackedDays(data ?? []);
  const fed = daysWithFood(days);
  const pending = days.some((d) => d.estimated_tdee === null);
  const target = metrics?.protein_target_g;
  const weights = weightPoints(days.map((d) => ({ date: d.date, weight: d.morning_weight })));
  const maxKcal = Math.max(1, ...days.map((d) => Math.max(d.total_calories, d.estimated_tdee ?? 0)));

  const cards: { key: string; node: ReactNode; wide?: boolean }[] = [
    {
      key: "intake",
      node: <StatCard label="Avg intake" value={num(mean(fed, (r) => r.total_calories))} unit="kcal" sub={`${fed.length} day(s) with food logged`} icon={<Utensils className="h-4 w-4" />} accent="kcal" spark={days.map((d) => (d.total_calories > 0 ? d.total_calories : null))} />,
    },
    {
      key: "protein",
      node: <StatCard label="Avg protein" value={num(mean(fed, (r) => r.total_protein), 1)} unit="g" info="protein_target" icon={<Beef className="h-4 w-4" />} accent="protein" spark={days.map((d) => (d.total_calories > 0 ? d.total_protein : null))} />,
    },
    {
      key: "deficit",
      node: (
        <StatCard
          label="Avg deficit"
          value={pending ? "Pending" : num(mean(fed, (r) => r.calorie_deficit))}
          unit={pending ? undefined : "kcal"}
          info={pending ? "pending_biometrics" : "deficit"}
          icon={<TrendingDown className="h-4 w-4" />}
          accent="balance"
          spark={pending ? undefined : days.map((d) => d.calorie_deficit)}
        />
      ),
    },
    {
      key: "exercise",
      node: <StatCard label="Avg exercise" value={num(mean(days, (r) => r.estimated_exercise_calories || null))} unit="kcal" info="exercise_calories" icon={<Flame className="h-4 w-4" />} accent="burn" spark={days.map((d) => d.estimated_exercise_calories || null)} />,
    },
    {
      key: "sleep",
      wide: true,
      node: <StatCard label="Avg sleep" value={num(mean(days, (r) => r.sleep_hours), 1)} unit="h" info="sleep_quality" icon={<Moon className="h-4 w-4" />} accent="sleep" spark={days.map((d) => d.sleep_hours)} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented options={RANGES} value={range} onChange={setRange} />
        {data && (
          <p className="flex items-center gap-1.5 text-[13px] text-slate-500">
            <CalendarRange className="h-4 w-4" />
            {prettyDate(start, { day: "numeric", month: "short" })} – {prettyDate(end, { day: "numeric", month: "short" })} · {days.length} tracked day{days.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      )}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {cards.map((c, i) => (
              <div key={c.key} className={cn("fade-up [&>div]:h-full", c.wide && "col-span-2 lg:col-span-1")} style={{ animationDelay: `${i * 50}ms` }}>
                {c.node}
              </div>
            ))}
          </div>

          <ChartCard className="fade-up" title="Food eaten vs calories burned" icon={<LineChart className="h-4 w-4" />} info="chart_intake_tdee" insight={intakeVsTdeeInsight(days)} note={pending ? PENDING_NOTE : null}>
            <IntakeTdeeChart days={days} />
          </ChartCard>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard className="fade-up" title="Protein vs target" icon={<Beef className="h-4 w-4" />} info="chart_protein_target" insight={proteinInsight(days, target?.min ?? null, target?.max ?? null)}>
              <ProteinTargetChart days={days} min={target?.min ?? null} max={target?.max ?? null} />
            </ChartCard>
            <ChartCard className="fade-up" title="Calories by macro" icon={<Flame className="h-4 w-4" />} info="chart_macro_calories" insight={macroCaloriesInsight(days)}>
              <MacroCaloriesChart days={days} />
            </ChartCard>
            <ChartCard className="fade-up" title="Where your calories are burned" icon={<Zap className="h-4 w-4" />} info="chart_energy_stack" insight={energyStackInsight(days[days.length - 1])}>
              <EnergyStackChart days={days} />
            </ChartCard>
            <ChartCard className="fade-up" title="Weight trend" icon={<Activity className="h-4 w-4" />} info="chart_weight" insight={weightInsight(weights)}>
              <WeightTrendChart points={weights} />
            </ChartCard>
          </div>

          <Card className="fade-up overflow-hidden">
            <CardHeader title="Day by day" description="Tap a day to open its full breakdown" icon={<CalendarRange className="h-4 w-4" />} />
            <CardBody className="p-0 pt-3">
              {/* Desktop: full table */}
              <div className="hidden md:block">
                <Table>
                  <THead>
                    <TR>
                      <TH className="pl-5">Date</TH>
                      <TH>Day</TH>
                      <TH className="text-right">Weight</TH>
                      <TH className="text-right">Intake</TH>
                      <TH className="text-right">Protein</TH>
                      <TH className="text-right">C / F / Fibre</TH>
                      <TH className="text-right">
                        <WithTip term="exercise_calories">Exercise</WithTip>
                      </TH>
                      <TH className="text-right">
                        <WithTip term="tdee">TDEE</WithTip>
                      </TH>
                      <TH className="text-right">
                        <WithTip term="deficit">Deficit</WithTip>
                      </TH>
                      <TH className="text-right">
                        <WithTip term="checkin_readiness">Readiness</WithTip>
                      </TH>
                      <TH className="pr-5">
                        <WithTip term="alert_levels">Alerts</WithTip>
                      </TH>
                    </TR>
                  </THead>
                  <TBody>
                    {[...days].reverse().map((d) => (
                      <TR
                        key={d.date}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open ${prettyDate(d.date)}`}
                        className="cursor-pointer hover:bg-slate-50/80 focus-visible:bg-slate-50 focus-visible:outline-none"
                        onClick={() => onPickDate(d.date)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPickDate(d.date))}
                      >
                        <TD className="whitespace-nowrap pl-5 font-medium text-slate-900">{prettyDate(d.date)}</TD>
                        <TD>{d.is_rest_day ? <Badge tone="info">Rest</Badge> : d.day_number ?? "—"}</TD>
                        <TD className="num text-right">{d.morning_weight !== null ? fmt(d.morning_weight, 1) : "—"}</TD>
                        <TD className="min-w-[96px] text-right">
                          <span className="num font-semibold text-slate-900">{fmt(d.total_calories)}</span>
                          <MiniBar value={d.total_calories} max={maxKcal} accent="kcal" className="mt-1" />
                        </TD>
                        <TD className="num text-right font-medium text-acc-protein">{fmt(d.total_protein, 1)}</TD>
                        <TD className="num whitespace-nowrap text-right">
                          {fmt(d.total_carbs)} / {fmt(d.total_fat)} / {fmt(d.total_fibre)}
                        </TD>
                        <TD className="num text-right">{fmt(d.estimated_exercise_calories)}</TD>
                        <TD className="num text-right">{fmt(d.estimated_tdee)}</TD>
                        <TD className="num text-right">{d.calorie_deficit !== null ? <span className="font-medium text-slate-900">{fmt(d.calorie_deficit)}</span> : <span className="text-xs font-medium text-warn-fg">pending</span>}</TD>
                        <TD className="num text-right">{d.readiness_score ?? "—"}</TD>
                        <TD className="pr-5">
                          <AlertBadges d={d} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
              {/* Phone: rows */}
              <ul className="divide-y divide-line border-t border-line md:hidden">
                {[...days].reverse().map((d) => (
                  <li key={d.date}>
                    <button type="button" onClick={() => onPickDate(d.date)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                          {prettyDate(d.date)}
                          {d.is_rest_day ? <Badge tone="info">Rest</Badge> : d.day_number !== null && <span className="text-xs font-normal text-slate-500">Day {d.day_number}</span>}
                        </p>
                        <p className="num mt-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-900">{fmt(d.total_calories)}</span> kcal · <span className="font-medium text-acc-protein">{fmt(d.total_protein, 1)} g</span> protein ·{" "}
                          {d.calorie_deficit !== null ? `${fmt(d.calorie_deficit)} deficit` : <span className="text-warn-fg">deficit pending</span>}
                        </p>
                        <MiniBar value={d.total_calories} max={maxKcal} accent="kcal" className="mt-2" />
                      </div>
                      <AlertBadges d={d} compact />
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
