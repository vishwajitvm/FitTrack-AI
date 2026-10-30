"use client";

import { useState, type ReactNode } from "react";
import { Activity, Bike, Bot, Clock, Droplets, Dumbbell, Footprints, Frown, Gauge, HeartPulse, ListChecks, Moon, PieChart, Scale, ShieldAlert, Smile, Utensils, Wind, Zap } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { MacroDonut } from "@/components/charts/macro-donut";
import { MealTimingChart } from "@/components/charts/meal-timing-chart";
import { WithTip } from "@/components/ui/info-tip";
import { useProfile } from "@/hooks/use-profile";
import { useRecommendation } from "@/hooks/use-workouts";
import { macroSplitInsight, mealTimingInsight, readinessInsight } from "@/lib/insights";
import { AlertList } from "@/components/common/alert-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ACCENT, AnimatedNumber, IconBubble, MetricRing, MiniBar, type Accent } from "@/components/ui/fx";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MEAL_LABEL } from "@/config/constants";
import type { GlossaryKey } from "@/config/glossary";
import { api } from "@/lib/api";
import { dateTime, fmt, humanize } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { AiText, DailyDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { readinessTone, readinessWord } from "@/components/workouts/recommendation-panel";
import { splitAccent } from "@/components/workouts/split-style";
import { EnergyCard } from "./energy-card";

interface AdvancedDayProps {
  detail: DailyDetail;
  onChanged: () => void;
}

const sevTone = ["neutral", "ok", "warning", "critical"] as const;

export function AdvancedDay({ detail, onChanged }: AdvancedDayProps) {
  const s = detail.summary;
  const [asking, setAsking] = useState(false);
  const [aiMeta, setAiMeta] = useState<string | null>(null);
  const { data: profile } = useProfile();
  const { data: rec } = useRecommendation(s.date);

  const askCoach = async () => {
    setAsking(true);
    try {
      const res = await api.post<AiText>(`/api/daily/${s.date}/coach`);
      setAiMeta(res.provider ? `${res.provider} / ${res.model}` : "rule-based");
      notify.success("Coach advice updated");
      onChanged();
    } catch (err) {
      notify.error(err, "AI coach failed");
    } finally {
      setAsking(false);
    }
  };

  const ms = detail.macro_split;
  const score = rec?.readiness_score ?? null;
  const cardio = detail.workouts.filter((w) => w.workout_type === "cardio");
  const maxMealKcal = Math.max(1, ...detail.meal_breakdown.map((m) => m.calories));

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <EnergyCard energy={detail.energy} />

        <div className="grid gap-5 md:grid-cols-2">
          <ChartCard
            className="fade-up"
            title="Meal timing"
            icon={<Clock className="h-4 w-4" />}
            info="chart_meal_timing"
            insight={mealTimingInsight(detail.foods, profile?.gym_return_time ?? null, profile?.bedtime ?? null)}
          >
            <MealTimingChart foods={detail.foods} gymReturn={profile?.gym_return_time ?? null} bedtime={profile?.bedtime ?? null} />
          </ChartCard>
          <ChartCard className="fade-up" title="Macro split" icon={<PieChart className="h-4 w-4" />} info="chart_macro_donut" insight={macroSplitInsight(ms.protein_pct, ms.carbs_pct, ms.fat_pct)}>
            <MacroDonut protein={s.total_protein} carbs={s.total_carbs} fat={s.total_fat} />
          </ChartCard>
        </div>

        <Card className="fade-up overflow-hidden">
          <CardHeader title="Meal-by-meal breakdown" description="Where today's calories and protein came from" icon={<Utensils className="h-4 w-4" />} info="macro_split" />
          <CardBody className="p-0 pt-3">
            {detail.meal_breakdown.length === 0 ? (
              <p className="px-5 pb-5 pt-2 text-sm text-slate-500">No food logged.</p>
            ) : (
              <>
                {/* Desktop: table */}
                <div className="hidden md:block">
                  <Table>
                    <THead>
                      <TR>
                        <TH className="pl-5">Meal</TH>
                        <TH className="text-right">Items</TH>
                        <TH className="text-right">kcal</TH>
                        <TH className="text-right">Protein</TH>
                        <TH className="text-right">Carbs</TH>
                        <TH className="text-right">Fat</TH>
                        <TH className="pr-5 text-right">
                          <WithTip term="fibre">Fibre</WithTip>
                        </TH>
                      </TR>
                    </THead>
                    <TBody>
                      {detail.meal_breakdown.map((m) => (
                        <TR key={m.meal_type}>
                          <TD className="pl-5 font-medium text-slate-900">{MEAL_LABEL[m.meal_type] ?? humanize(m.meal_type)}</TD>
                          <TD className="num text-right">{m.items}</TD>
                          <TD className="min-w-[96px] text-right">
                            <span className="num font-semibold text-slate-900">{fmt(m.calories)}</span>
                            <MiniBar value={m.calories} max={maxMealKcal} accent="kcal" className="mt-1" />
                          </TD>
                          <TD className="num text-right font-medium text-acc-protein">{fmt(m.protein, 1)}</TD>
                          <TD className="num text-right">{fmt(m.carbs, 1)}</TD>
                          <TD className="num text-right">{fmt(m.fat, 1)}</TD>
                          <TD className="num pr-5 text-right">{fmt(m.fibre, 1)}</TD>
                        </TR>
                      ))}
                      <TR className="bg-slate-50/80 font-semibold [&>td]:text-slate-900">
                        <TD className="pl-5">Total</TD>
                        <TD className="num text-right">{detail.foods.length}</TD>
                        <TD className="num text-right">{fmt(s.total_calories)}</TD>
                        <TD className="num text-right">{fmt(s.total_protein, 1)}</TD>
                        <TD className="num text-right">{fmt(s.total_carbs, 1)}</TD>
                        <TD className="num text-right">{fmt(s.total_fat, 1)}</TD>
                        <TD className="num pr-5 text-right">{fmt(s.total_fibre, 1)}</TD>
                      </TR>
                    </TBody>
                  </Table>
                </div>
                {/* Phone: rows */}
                <ul className="divide-y divide-line border-t border-line md:hidden">
                  {detail.meal_breakdown.map((m) => (
                    <li key={m.meal_type} className="flex items-center gap-3 px-5 py-3.5">
                      <IconBubble accent="kcal">
                        <Utensils className="h-4 w-4" />
                      </IconBubble>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{MEAL_LABEL[m.meal_type] ?? humanize(m.meal_type)}</p>
                        <p className="num mt-0.5 text-xs text-slate-500">
                          {m.items} item{m.items === 1 ? "" : "s"} · <span className="text-acc-protein">P {fmt(m.protein, 1)}</span> · C {fmt(m.carbs, 1)} · F {fmt(m.fat, 1)} · Fibre {fmt(m.fibre, 1)}
                        </p>
                      </div>
                      <span className="num shrink-0 text-right text-sm font-semibold text-slate-900">
                        {fmt(m.calories)} <span className="text-xs font-normal text-slate-500">kcal</span>
                      </span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between gap-3 bg-slate-50/80 px-5 py-3 text-sm font-semibold text-slate-900">
                    <span>Total · {detail.foods.length} items</span>
                    <span className="num">
                      {fmt(s.total_calories)} kcal · {fmt(s.total_protein, 1)} g P
                    </span>
                  </li>
                </ul>
              </>
            )}
            <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3.5 text-xs text-slate-600">
              <Pill>
                Macro split: <b className="text-acc-protein">P {fmt(ms.protein_pct)}%</b> · <b>C {fmt(ms.carbs_pct)}%</b> · <b>F {fmt(ms.fat_pct)}%</b>
              </Pill>
              <Pill>
                <WithTip term="whey_scoops">Whey scoops:</WithTip> <b>{fmt(s.whey_scoops)}</b>
              </Pill>
              <Pill>
                <WithTip term="protein_per_kg">Protein:</WithTip> <b className="text-acc-protein">{fmt(s.protein_per_kg, 2)} g/kg</b>
              </Pill>
            </div>
          </CardBody>
        </Card>

        <Card className="fade-up">
          <CardHeader
            title="Coach advice"
            description={aiMeta ? `Generated by ${aiMeta}` : "Rule-based by default; ask the AI coach for a deeper review"}
            icon={<Bot className="h-4 w-4" />}
            action={
              <Button size="sm" onClick={askCoach} loading={asking}>
                Ask AI coach
              </Button>
            }
          />
          <CardBody>
            {s.coach_advice ? (
              <p className="whitespace-pre-line rounded-xl border-l-[3px] border-brand-500 bg-slate-50/70 px-4 py-3 text-sm leading-relaxed text-slate-700">{s.coach_advice}</p>
            ) : (
              <p className="text-sm text-slate-500">No advice yet.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5">
        <ChartCard className="fade-up" title="Training readiness" icon={<Gauge className="h-4 w-4" />} info="chart_readiness" insight={readinessInsight(score, rec?.readiness_label ?? null)}>
          <div className="flex flex-col items-center gap-3 py-1">
            <MetricRing value={score !== null ? score / 100 : 0} accent="sleep" size={132} stroke={11} label={`Readiness ${score ?? "not available"} out of 100`}>
              <span className="text-3xl font-semibold leading-none tracking-tight text-slate-900">
                <AnimatedNumber value={score} />
              </span>
              <span className="mt-1 text-xs text-slate-500">of 100</span>
            </MetricRing>
            <Badge tone={readinessTone(score)}>{readinessWord(score)}</Badge>
            {rec?.readiness_label && <p className="-mt-1 text-xs text-slate-500">{rec.readiness_label}</p>}
            <div className="grid w-full grid-cols-3 gap-1.5 text-center text-[11px] text-slate-500">
              <span className={cn("rounded-lg px-1 py-1", score !== null && score < 45 && "bg-crit-bg font-semibold text-crit-fg")}>0–44 recover</span>
              <span className={cn("rounded-lg px-1 py-1", score !== null && score >= 45 && score < 70 && "bg-warn-bg font-semibold text-warn-fg")}>45–69 lighter</span>
              <span className={cn("rounded-lg px-1 py-1", score !== null && score >= 70 && "bg-good-bg font-semibold text-good-fg")}>70+ train</span>
            </div>
          </div>
        </ChartCard>

        <Card className="fade-up">
          <CardHeader title="Alerts" icon={<ShieldAlert className="h-4 w-4" />} info="alert_levels" />
          <CardBody>
            <AlertList alerts={s.alerts} />
          </CardBody>
        </Card>

        <Card className="fade-up">
          <CardHeader title="Check-in metrics" description={s.day_number !== null ? `Day ${s.day_number}` : undefined} icon={<ListChecks className="h-4 w-4" />} />
          <CardBody className="px-0 pb-2 pt-3">
            <ul className="divide-y divide-line">
              <MetricRow icon={<Scale className="h-4 w-4" />} accent="weight" term="morning_weight" label="Morning weight" value={s.morning_weight !== null ? `${fmt(s.morning_weight, 1)} kg` : "—"} />
              <MetricRow icon={<Gauge className="h-4 w-4" />} accent="sleep" term="checkin_readiness" label="Readiness" value={s.readiness_score !== null ? `${s.readiness_score}/10` : "—"} bar={s.readiness_score} />
              <MetricRow icon={<Zap className="h-4 w-4" />} accent="kcal" term="checkin_energy" label="Energy" value={s.energy_level !== null ? `${s.energy_level}/10` : "—"} bar={s.energy_level} />
              <MetricRow icon={<Moon className="h-4 w-4" />} accent="sleep" term="sleep_quality" label="Sleep" value={s.sleep_hours !== null ? `${fmt(s.sleep_hours, 1)} h · quality ${s.sleep_quality ?? "—"}/10` : "—"} bar={s.sleep_hours !== null ? s.sleep_quality : null} />
              <MetricRow icon={<Wind className="h-4 w-4" />} accent="protein" term="bloating" label="Bloating" value={humanize(s.bloating_status)} />
              <MetricRow icon={<Footprints className="h-4 w-4" />} accent="water" term="steps" label="Steps" value={fmt(s.steps)} />
              <MetricRow icon={<Droplets className="h-4 w-4" />} accent="water" term="water" label="Water" value={s.water_ml !== null ? `${fmt(s.water_ml)} ml` : "—"} />
              <MetricRow icon={<Smile className="h-4 w-4" />} accent="sleep" term="stress" label="Mood / stress" value={`${s.mood ?? "—"} / ${s.stress ?? "—"}`} />
              <MetricRow icon={<Frown className="h-4 w-4" />} accent="burn" term="soreness" label="Soreness" value={s.soreness_notes || "—"} />
            </ul>
          </CardBody>
        </Card>

        <Card className="fade-up">
          <CardHeader title="Symptoms" icon={<HeartPulse className="h-4 w-4" />} info="symptom_severity" />
          <CardBody className={detail.biofeedback.length ? "px-0 pb-2 pt-3" : undefined}>
            {detail.biofeedback.length === 0 ? (
              <p className="text-sm text-slate-500">No symptoms logged.</p>
            ) : (
              <ul className="divide-y divide-line">
                {detail.biofeedback.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/80">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <HeartPulse className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{humanize(b.symptom_type)}</p>
                      <p className="text-xs text-slate-500">
                        {dateTime(b.timestamp)}
                        {b.trigger_suspect ? ` · suspect: ${b.trigger_suspect}` : ""}
                      </p>
                    </div>
                    <Badge tone={sevTone[b.severity] ?? "neutral"}>{b.severity_label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="fade-up">
          <CardHeader title="Training" icon={<Activity className="h-4 w-4" />} info="lifting_once" />
          <CardBody className="px-0 pb-0 pt-3">
            <ul className="divide-y divide-line">
              {detail.sessions.map((ses) => (
                <TrainingRow key={ses.id} icon={<Dumbbell className="h-4 w-4" />} accent={splitAccent(ses.split)} title={humanize(ses.split)} sub={`${fmt(ses.lifting_duration_min)} min @ MET ${fmt(ses.lifting_met, 1)}`} kcal={ses.estimated_calories} />
              ))}
              {cardio.map((w) => (
                <TrainingRow key={w.id} icon={<Bike className="h-4 w-4" />} accent="water" title={w.exercise_name} sub={`${fmt(w.cardio_duration_min)} min`} kcal={w.estimated_calories} />
              ))}
              {!detail.sessions.length && !cardio.length && <li className="px-5 py-3 text-sm text-slate-500">No training logged.</li>}
            </ul>
            <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-slate-50/70 px-5 py-3 text-sm">
              <span className="font-semibold text-slate-900">Total exercise</span>
              <span className="num font-semibold text-acc-burn">{fmt(s.estimated_exercise_calories)} kcal</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">{children}</span>;
}

function MetricRow({ icon, accent, term, label, value, bar }: { icon: ReactNode; accent: Accent; term: GlossaryKey; label: string; value: ReactNode; /** 0–10 value for a small bar. */ bar?: number | null }) {
  return (
    <li className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50/80">
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", ACCENT[accent].tint, ACCENT[accent].text)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 text-sm">
          <WithTip term={term} className="text-slate-600">
            {label}
          </WithTip>
          <span className="num text-right font-medium text-slate-900">{value}</span>
        </div>
        {bar !== undefined && bar !== null && <MiniBar value={bar} max={10} accent={accent} className="mt-1.5" />}
      </div>
    </li>
  );
}

function TrainingRow({ icon, accent, title, sub, kcal }: { icon: ReactNode; accent: Accent; title: string; sub: string; kcal: number | null }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/80">
      <IconBubble accent={accent}>{icon}</IconBubble>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{title}</p>
        <p className="num text-xs text-slate-500">{sub}</p>
      </div>
      <span className="num shrink-0 text-sm font-semibold text-slate-900">
        {fmt(kcal)} <span className="text-xs font-normal text-slate-500">kcal</span>
      </span>
    </li>
  );
}
