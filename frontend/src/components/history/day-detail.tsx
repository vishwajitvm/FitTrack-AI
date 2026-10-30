"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Dumbbell, HeartPulse, MessageCircle, Utensils } from "lucide-react";
import { AlertList } from "@/components/common/alert-list";
import { StatCard } from "@/components/common/stat-card";
import { CardsSkeleton, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { useDaily } from "@/hooks/use-daily";
import { fmt, humanize, prettyDate } from "@/lib/format";
import type { DailyDetail, FoodLog } from "@/lib/types";

interface Props {
  date: string | null;
  onClose: () => void;
  /** Dates of the rows on screen, newest first, for prev / next. */
  dates: string[];
  onNavigate: (date: string) => void;
}

/** Everything about one day: food by meal, workout, check-in, symptoms and flags. */
export function DayDetailModal({ date, onClose, dates, onNavigate }: Props) {
  const { data, error, isLoading, mutate } = useDaily(date);
  const i = date ? dates.indexOf(date) : -1;
  const newer = i > 0 ? dates[i - 1] : null;
  const older = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null;

  return (
    <Modal
      open={!!date}
      onClose={onClose}
      size="xl"
      title={date ? prettyDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
      description={data ? `Day ${data.summary.day_number}${data.summary.is_rest_day ? " · rest day" : ""}` : undefined}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={!older} onClick={() => older && onNavigate(older)}>
              <ChevronLeft className="h-4 w-4" /> Older
            </Button>
            <Button variant="outline" size="sm" disabled={!newer} onClick={() => newer && onNavigate(newer)}>
              Newer <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {date && (
            <Link href={`/ask?q=${encodeURIComponent(`Summarise ${date}: what I ate, my workout, weight and how I felt`)}`}>
              <Button variant="secondary" size="sm">
                <MessageCircle className="h-4 w-4" /> Ask about this day
              </Button>
            </Link>
          )}
        </div>
      }
    >
      {error ? <ErrorState error={error} onRetry={() => mutate()} /> : isLoading || !data ? <CardsSkeleton /> : <DayBody data={data} />}
    </Modal>
  );
}

function DayBody({ data }: { data: DailyDetail }) {
  const s = data.summary;
  const deficit = data.energy.deficit;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Eaten" value={fmt(s.total_calories)} unit="kcal" accent="kcal" />
        <StatCard label="Protein" accent="protein" value={fmt(s.total_protein, 1)} unit="g" sub={s.protein_per_kg !== null ? `${fmt(s.protein_per_kg, 2)} g/kg` : undefined} />
        <StatCard label="Exercise" value={fmt(s.estimated_exercise_calories)} unit="kcal" accent="burn" />
        <StatCard label="Burned" accent="burn" value={fmt(data.energy.tdee)} unit="kcal" sub="TDEE" info="tdee" />
        <StatCard
          label="Balance"
          accent="balance"
          value={deficit === null ? "—" : fmt(Math.abs(deficit))}
          unit={deficit === null ? undefined : "kcal"}
          status={deficit === null ? "Pending" : deficit > 0 ? "Deficit" : "Surplus"}
          tone={deficit === null ? "default" : deficit > 0 ? "ok" : "warning"}
          info="deficit"
        />
        <StatCard label="Weight" accent="weight" value={s.morning_weight !== null ? fmt(s.morning_weight, 1) : "—"} unit={s.morning_weight !== null ? "kg" : undefined} sub={s.morning_weight === null ? "No weigh-in" : "Morning"} />
      </div>

      <Section icon={<Utensils className="h-4 w-4" />} title="What you ate" meta={`${data.foods.length} item${data.foods.length === 1 ? "" : "s"} · C ${fmt(s.total_carbs)} g · F ${fmt(s.total_fat)} g`}>
        {data.foods.length ? <FoodTable data={data} /> : <Empty>No food logged this day.</Empty>}
      </Section>

      <Section icon={<Dumbbell className="h-4 w-4" />} title="Workout" meta={data.sessions.length || data.workouts.length ? `${fmt(s.estimated_exercise_calories)} kcal` : undefined}>
        {data.sessions.length || data.workouts.length ? <WorkoutBlock data={data} /> : <Empty>{s.is_rest_day ? "Rest day — no workout logged." : "No workout logged."}</Empty>}
      </Section>

      <Section icon={<HeartPulse className="h-4 w-4" />} title="How you felt">
        <CheckInGrid data={data} />
      </Section>

      <Section title="Flags for this day">
        <AlertList alerts={s.alerts} />
      </Section>
    </div>
  );
}

function Section({ icon, title, meta, children }: { icon?: ReactNode; title: string; meta?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {icon && <span className="text-slate-500">{icon}</span>}
          {title}
        </h3>
        {meta && <span className="text-xs text-slate-500">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">{children}</p>;
}

function portion(f: FoodLog): string {
  const parts = [f.quantity !== null ? `${fmt(f.quantity, f.quantity % 1 ? 1 : 0)} ${f.portion_unit ?? ""}`.trim() : null, f.weight_grams ? `${fmt(f.weight_grams)} g` : null];
  return parts.filter(Boolean).join(" · ") || "—";
}

function FoodTable({ data }: { data: DailyDetail }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Time</TH>
          <TH>Food</TH>
          <TH>Portion</TH>
          <TH className="text-right">kcal</TH>
          <TH className="text-right">Protein</TH>
          <TH className="text-right">Carbs</TH>
          <TH className="text-right">Fat</TH>
        </TR>
      </THead>
      <TBody className="[&>tr:nth-child(even)]:bg-transparent">
        {data.meal_breakdown.map((meal) => (
          <MealRows key={meal.meal_type} meal={meal} foods={data.foods.filter((f) => f.meal_type === meal.meal_type)} />
        ))}
      </TBody>
    </Table>
  );
}

function MealRows({ meal, foods }: { meal: DailyDetail["meal_breakdown"][number]; foods: FoodLog[] }) {
  return (
    <>
      <TR className="bg-slate-50">
        <TD colSpan={3} className="py-2 text-[13px] font-semibold text-slate-700">
          {humanize(meal.meal_type)}
        </TD>
        <TD className="py-1.5 text-right text-xs font-semibold text-slate-700">{fmt(meal.calories)}</TD>
        <TD className="py-1.5 text-right text-xs font-semibold text-slate-700">{fmt(meal.protein, 1)} g</TD>
        <TD className="py-1.5 text-right text-xs text-slate-500">{fmt(meal.carbs)} g</TD>
        <TD className="py-1.5 text-right text-xs text-slate-500">{fmt(meal.fat)} g</TD>
      </TR>
      {foods.map((f) => (
        <TR key={f.id}>
          <TD className="whitespace-nowrap text-xs text-slate-500">{f.time ?? "—"}</TD>
          <TD className="min-w-[160px]">
            <p className="text-slate-900">{f.food_name}</p>
            {f.ingredients.length > 0 && <p className="line-clamp-1 text-xs text-slate-500">{f.ingredients.join(", ")}</p>}
          </TD>
          <TD className="whitespace-nowrap text-xs">{portion(f)}</TD>
          <TD className="text-right">{fmt(f.calories)}</TD>
          <TD className="text-right">{fmt(f.protein, 1)} g</TD>
          <TD className="text-right text-slate-500">{fmt(f.carbs)} g</TD>
          <TD className="text-right text-slate-500">{fmt(f.fat)} g</TD>
        </TR>
      ))}
    </>
  );
}

function WorkoutBlock({ data }: { data: DailyDetail }) {
  const strength = data.workouts.filter((w) => w.workout_type === "strength");
  const cardio = data.workouts.filter((w) => w.workout_type === "cardio");
  return (
    <div className="space-y-3">
      {data.sessions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.sessions.map((ses) => (
            <Badge key={ses.id} tone="dark" className="px-2.5 py-1 text-xs">
              {humanize(ses.split)} · {ses.lifting_duration_min ? `${fmt(ses.lifting_duration_min)} min` : "duration not logged"} · {fmt(ses.estimated_calories)} kcal
              {ses.session_rpe ? ` · RPE ${ses.session_rpe}` : ""}
            </Badge>
          ))}
        </div>
      )}
      {cardio.length > 0 && (
        <p className="text-sm text-slate-700">
          <span className="font-medium">Cardio:</span> {cardio.map((c) => `${c.exercise_name} ${fmt(c.cardio_duration_min)} min (${fmt(c.estimated_calories)} kcal)`).join(" · ")}
        </p>
      )}
      {strength.length > 0 && (
        <Table>
          <THead>
            <TR>
              <TH>Exercise</TH>
              <TH>Muscle</TH>
              <TH>Sets × reps</TH>
              <TH className="text-right">Weight</TH>
              <TH>RPE</TH>
            </TR>
          </THead>
          <TBody>
            {strength.map((w) => (
              <TR key={w.id}>
                <TD className="text-slate-900">{w.exercise_name}</TD>
                <TD className="text-xs">{w.target_muscle ?? "—"}</TD>
                <TD className="whitespace-nowrap">{w.sets ? `${w.sets} × ${w.reps ?? "?"}` : "—"}</TD>
                <TD className="whitespace-nowrap text-right">{w.weight_kg ? `${fmt(w.weight_kg, 1)} kg` : "—"}</TD>
                <TD>{w.rpe ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function CheckInGrid({ data }: { data: DailyDetail }) {
  const s = data.summary;
  const items: [string, string | null][] = [
    ["Sleep", s.sleep_hours !== null ? `${fmt(s.sleep_hours, 1)} h${s.sleep_quality ? ` · quality ${s.sleep_quality}/10` : ""}` : null],
    ["Energy", s.energy_level !== null ? `${s.energy_level}/10` : null],
    ["Mood", s.mood !== null ? `${s.mood}/10` : null],
    ["Stress", s.stress !== null ? `${s.stress}/10` : null],
    ["Readiness", s.readiness_score !== null ? `${s.readiness_score}/10` : null],
    ["Bloating", s.bloating_status ? humanize(s.bloating_status) : null],
    ["Steps", s.steps !== null ? fmt(s.steps) : null],
    ["Water", s.water_ml !== null ? `${fmt(s.water_ml / 1000, 1)} L` : null],
  ];
  const logged = items.filter(([, v]) => v !== null);
  return (
    <div className="space-y-3">
      {logged.length ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {logged.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="text-sm font-medium text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Empty>No check-in this day.</Empty>
      )}
      {(s.soreness_notes || s.notes) && (
        <p className="text-sm text-slate-700">
          {s.soreness_notes && <><span className="font-medium">Soreness:</span> {s.soreness_notes} </>}
          {s.notes && <><span className="font-medium">Notes:</span> {s.notes}</>}
        </p>
      )}
      {data.biofeedback.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {data.biofeedback.map((b) => (
            <Badge key={b.id} tone={b.severity >= 2 ? "warning" : "neutral"}>
              {humanize(b.symptom_type)} · {b.severity_label}
              {b.trigger_suspect ? ` · after ${b.trigger_suspect}` : ""}
            </Badge>
          ))}
        </ul>
      )}
    </div>
  );
}
