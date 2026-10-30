"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Loader2, PartyPopper } from "lucide-react";
import { ErrorState } from "@/components/common/states";
import { openQuickLog } from "@/components/quick-log/quick-log";
import { WorkoutPresetSheet } from "@/components/quick-log/workout-preset-sheet";
import { Card } from "@/components/ui/card";
import { CollapseBody, CollapseButton } from "@/components/ui/collapse";
import { Skeleton } from "@/components/ui/misc";
import { ProgressRing } from "@/components/ui/touch";
import { useQuickActions } from "@/hooks/use-quick-actions";
import { useToday } from "@/hooks/use-quicklog";
import { addDays, fmt, humanize, prettyDate } from "@/lib/format";
import { confirmAction } from "@/lib/notify";
import type { Preset, TodayPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Row {
  key: string;
  label: string;
  done: boolean;
  hint?: string;
  actionLabel: string;
  onAction: () => void;
}

/** "Today" checklist: what's done, what's next, and one-tap actions for each item. */
export function TodayCard() {
  const { data: plan, error, isLoading, mutate } = useToday();
  const { applyPreset, copyDay } = useQuickActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [routine, setRoutine] = useState<Preset | null>(null);

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !plan) return <Skeleton className="h-64 rounded-xl" />;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  const rows = buildRows(plan, {
    preset: (key, p) => run(key, () => applyPreset(p, { date: plan.date })),
    routine: (p) => setRoutine(p),
  });

  const copyYesterday = async () => {
    const from = addDays(plan.date, -1);
    const ok = await confirmAction({
      title: "Copy all of yesterday?",
      text: `Every meal and workout from ${prettyDate(from, { weekday: "long" })} is added to today. You can undo it right after.`,
      confirmText: "Copy everything",
    });
    if (ok) run("copy-all", () => copyDay({ from_date: from, to_date: plan.date, include: ["food", "workouts"], label: "Copied yesterday" }));
  };

  const pEaten = plan.protein.eaten;
  const pTarget = plan.protein.target;
  const doneCount = rows.filter((r) => r.done).length;
  const next = plan.next_action;
  // If the server says "done" but something is still open, point at the first open item instead.
  const firstOpen = next.kind === "done" ? rows.find((r) => !r.done) : undefined;

  return (
    <Card collapsible="today-plan" className="overflow-hidden">
      <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <CollapseButton label="today's checklist" className="absolute right-4 top-4 sm:right-5 sm:top-5" />
        <ProgressRing value={pTarget ? pEaten / pTarget : 0} size={96} color="rgb(var(--acc-protein))">
          <span className="num text-lg font-semibold text-slate-900">{fmt(pEaten)}</span>
          <span className="text-[10px] text-slate-500">{pTarget ? `of ${fmt(pTarget)} g` : "g"} protein</span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-1 sm:pr-10">
          <p className="text-[13px] font-medium text-slate-500">
            Today · {plan.weekday}
            {plan.is_rest_day ? " · rest day" : ""}
          </p>
          <p className="num text-lg font-semibold text-slate-900">
            Eaten {fmt(plan.calories.eaten)}
            {plan.calories.target ? ` of your ~${fmt(plan.calories.target)} goal` : ""} kcal
          </p>
          <p className="text-sm text-slate-600">
            {pTarget && pEaten < pTarget
              ? `Protein: ${fmt(pTarget - pEaten)} g to go — add a scoop, eggs, paneer or chicken.`
              : pTarget
                ? "Protein target reached — nice."
                : "Add your weight in Profile to get a protein target."}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${rows.length ? (doneCount / rows.length) * 100 : 0}%` }} />
            </div>
            <span className="text-xs text-slate-500">
              {doneCount} of {rows.length} done today
            </span>
          </div>
        </div>
      </div>

      {firstOpen ? (
        <button type="button" onClick={firstOpen.onAction} className="group flex min-h-[60px] w-full items-center justify-between gap-3 bg-navy px-5 text-left text-white transition-colors hover:bg-navy-800">
          <span>
            <span className="block text-xs font-medium text-white/75">Next up</span>
            <span className="block text-sm font-semibold">{firstOpen.label}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
        </button>
      ) : next.kind !== "done" ? (
        <button
          type="button"
          onClick={() => {
            if (next.kind === "checkin") window.location.assign("/checkin");
            else if (next.kind === "workout") openQuickLog("workout");
            else if (next.kind === "scoop") openQuickLog("scoop");
            else openQuickLog("meal", next.meal_type ?? undefined);
          }}
          className="group flex min-h-[60px] w-full items-center justify-between gap-3 bg-navy px-5 text-left text-white transition-colors hover:bg-navy-800"
        >
          <span>
            <span className="block text-xs font-medium text-white/75">Next up</span>
            <span className="block text-sm font-semibold">{next.label}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
        </button>
      ) : (
        <p className="flex items-center gap-2 bg-good-bg px-5 py-3 text-sm font-medium text-good-fg">
          <PartyPopper className="h-4 w-4" /> {next.label || "All done for today!"}
        </p>
      )}

      <CollapseBody>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.key} className="flex min-h-[60px] items-center gap-3 px-4 transition-colors hover:bg-slate-50/80 sm:px-5">
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors", r.done ? "border-navy bg-navy text-white" : "border-slate-300")} aria-hidden>
              {r.done && <Check className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-medium", r.done ? "text-slate-500" : "text-slate-900")}>
                {r.label}
                <span className="sr-only">{r.done ? " — done" : " — to do"}</span>
              </span>
              {r.hint && <span className="block truncate text-[11px] text-slate-500">{r.hint}</span>}
            </span>
            {!r.done && (
              <button
                type="button"
                onClick={r.onAction}
                disabled={busy !== null}
                className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-sm font-medium text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
              >
                {busy === r.key && <Loader2 className="h-4 w-4 animate-spin" />}
                {r.actionLabel}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 sm:px-5">
        <button type="button" onClick={copyYesterday} disabled={busy !== null} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
          {busy === "copy-all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Copy all of yesterday
        </button>
        <Link href="/tracker" className="text-xs font-medium text-brand-600 hover:underline">
          Full day details →
        </Link>
      </div>
      </CollapseBody>

      <WorkoutPresetSheet preset={routine} date={plan.date} onClose={() => setRoutine(null)} />
    </Card>
  );
}

function buildRows(plan: TodayPlan, act: { preset: (key: string, p: Preset) => void; routine: (p: Preset) => void }): Row[] {
  const rows: Row[] = [
    { key: "checkin", label: "Morning check-in", done: plan.checkin_done, hint: "Sleep, energy, mood — 10 seconds", actionLabel: "Check in", onAction: () => window.location.assign("/checkin") },
    { key: "weight", label: "Weigh-in", done: plan.weight_logged, hint: "After the toilet, before eating", actionLabel: "Add weight", onAction: () => openQuickLog("weight") },
  ];
  const workoutRow: Row = {
    key: "workout",
    label: plan.is_rest_day ? "Rest day (no workout)" : plan.workout.split ? `${humanize(plan.workout.split)} workout` : "Workout",
    done: plan.workout.logged || plan.is_rest_day,
    hint: plan.workout.preset ? `Routine: ${plan.workout.preset.name}` : plan.workout.message,
    actionLabel: plan.workout.preset ? "Log routine" : "Log workout",
    onAction: () => (plan.workout.preset ? act.routine(plan.workout.preset) : openQuickLog("workout")),
  };
  let workoutAdded = false;
  for (const m of plan.meals) {
    if (!workoutAdded && (m.meal_type === "post_workout" || m.meal_type === "dinner")) {
      rows.push(workoutRow);
      workoutAdded = true;
    }
    const preset = m.suggested_preset;
    rows.push({
      key: `meal-${m.meal_type}`,
      label: m.label,
      done: m.logged,
      hint: preset ? `Usual: ${preset.name}` : m.top_picks.length ? `Usual: ${m.top_picks.map((p) => p.food_name).slice(0, 3).join(", ")}` : m.typical_time ? `Around ${m.typical_time}` : undefined,
      actionLabel: preset ? "Log usual" : "Add",
      onAction: () => (preset ? act.preset(`meal-${m.meal_type}`, preset) : openQuickLog("meal", m.meal_type)),
    });
  }
  if (!workoutAdded) rows.push(workoutRow);
  return rows;
}
