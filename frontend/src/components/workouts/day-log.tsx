"use client";

import type { ReactNode } from "react";
import { Bike, Clock, Dumbbell, Gauge, ListPlus, Pencil, Timer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CollapseBody, CollapseButton, useCollapse } from "@/components/ui/collapse";
import { ACCENT, IconBubble, type Accent } from "@/components/ui/fx";
import { fmt, humanize } from "@/lib/format";
import type { WorkoutLog, WorkoutSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { splitAccent, SplitChip } from "./split-style";

interface DayLogProps {
  sessions: WorkoutSession[];
  logs: WorkoutLog[];
  onEditSession: (s: WorkoutSession) => void;
  onDeleteSession: (s: WorkoutSession) => void;
  onEditLog: (l: WorkoutLog) => void;
  onDeleteLog: (l: WorkoutLog) => void;
}

function setsSummary(l: WorkoutLog): string {
  return [l.sets && `${l.sets} sets`, l.reps && `${l.reps} reps`, l.weight_kg && `${l.weight_kg} kg`].filter(Boolean).join(" × ");
}

/** Each recorded set as a small pill: "10 × 40 kg @8". */
function SetPills({ l, accent }: { l: WorkoutLog; accent: Accent }) {
  if (!l.sets_json?.length) return <p className="num mt-0.5 text-[13px] text-slate-500">{setsSummary(l) || "No sets recorded"}</p>;
  return (
    <ol className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Sets">
      {l.sets_json.map((s, i) => (
        <li key={i} className="num inline-flex items-center gap-1 rounded-lg border border-line bg-card px-2 py-0.5 text-xs text-slate-700">
          <span className={cn("text-[10px] font-semibold", ACCENT[accent].text)}>{i + 1}</span>
          <span className="font-medium text-slate-900">{s.reps ?? "?"}</span>
          {s.weight_kg ? <span>× {s.weight_kg} kg</span> : null}
          {s.rpe ? <span className="text-slate-400">@{s.rpe}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function RowActions({ onEdit, onDelete, what }: { onEdit: () => void; onDelete: () => void; what: string }) {
  return (
    <div className="flex shrink-0 items-center">
      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900" onClick={onEdit} aria-label={`Edit ${what}`}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-crit-bg hover:text-crit-fg" onClick={onDelete} aria-label={`Delete ${what}`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ExerciseRow({ l, index, accent, onEdit, onDelete }: { l: WorkoutLog; index: number; accent: Accent; onEdit: () => void; onDelete: () => void }) {
  const cardio = l.workout_type === "cardio";
  return (
    <li className="fade-up flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80" style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}>
      <IconBubble accent={accent} className="mt-0.5">
        {cardio ? <Bike className="h-4 w-4" /> : <span className="num text-sm font-semibold">{index + 1}</span>}
      </IconBubble>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-900">
          {l.exercise_name}
          {l.target_muscle && !cardio && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{l.target_muscle}</span>}
        </p>
        {cardio ? (
          <p className="num mt-0.5 text-[13px] text-slate-500">
            {fmt(l.cardio_duration_min)} min · MET {fmt(l.met_value, 1)}
            {l.rpe ? ` · RPE ${l.rpe}` : ""}
          </p>
        ) : (
          <SetPills l={l} accent={accent} />
        )}
        {l.notes && <p className="mt-1 text-xs italic text-slate-400">{l.notes}</p>}
      </div>
      {cardio && (
        <span className="mt-1.5 shrink-0 whitespace-nowrap text-right">
          <span className="num text-sm font-semibold text-acc-burn">{fmt(l.estimated_calories)}</span> <span className="text-xs text-slate-500">kcal</span>
        </span>
      )}
      <RowActions what={`"${l.exercise_name}"`} onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}

function GroupHeader({ icon, accent, title, meta, kcal, actions }: { icon: ReactNode; accent: Accent; title: ReactNode; meta?: ReactNode; kcal?: number | null; actions?: ReactNode }) {
  const c = useCollapse();
  return (
    <div className={cn("flex items-start gap-3 px-5 py-4", !c?.collapsed && "border-b border-line")}>
      <IconBubble accent={accent} className="h-10 w-10">
        {icon}
      </IconBubble>
      <div className="min-w-0 flex-1">
        <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold tracking-tight text-slate-900">{title}</h3>
        {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">{meta}</div>}
      </div>
      {kcal !== undefined && (
        <div className="shrink-0 text-right leading-tight">
          <p className="num text-lg font-semibold text-acc-burn">{fmt(kcal)}</p>
          <p className="text-[11px] text-slate-500">kcal</p>
        </div>
      )}
      {actions}
      <CollapseButton label="this group" />
    </div>
  );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="num inline-flex items-center gap-1 whitespace-nowrap">
      {icon}
      {children}
    </span>
  );
}

export function DayLog({ sessions, logs, onEditSession, onDeleteSession, onEditLog, onDeleteLog }: DayLogProps) {
  const cardio = logs.filter((l) => l.workout_type === "cardio");
  const orphans = logs.filter((l) => l.workout_type === "strength" && !sessions.some((s) => s.id === l.session_id));
  const cardioKcal = cardio.reduce((a, l) => a + (l.estimated_calories ?? 0), 0);
  let card = 0;

  return (
    <div className="space-y-4">
      {sessions.map((s) => {
        const exercises = logs.filter((l) => l.workout_type === "strength" && l.session_id === s.id);
        const accent = splitAccent(s.split);
        return (
          <Card key={s.id} collapsible={`session-${s.id}`} className="fade-up overflow-hidden" style={{ animationDelay: `${card++ * 60}ms` }}>
            <GroupHeader
              icon={<Dumbbell className="h-5 w-5" />}
              accent={accent}
              title={
                <>
                  {humanize(s.split)} session
                  <SplitChip split={s.split} className="hidden sm:inline-flex">
                    {exercises.length} exercise{exercises.length === 1 ? "" : "s"}
                  </SplitChip>
                </>
              }
              meta={
                <>
                  <Meta icon={<Timer className="h-3.5 w-3.5" />}>{fmt(s.lifting_duration_min)} min</Meta>
                  <Meta icon={<Gauge className="h-3.5 w-3.5" />}>MET {fmt(s.lifting_met, 1)}</Meta>
                  {s.session_rpe ? <Meta icon={<span className="text-[10px] font-bold">RPE</span>}>{s.session_rpe}/10</Meta> : null}
                  {s.started_at && <Meta icon={<Clock className="h-3.5 w-3.5" />}>{s.started_at}</Meta>}
                </>
              }
              kcal={s.estimated_calories}
              actions={<RowActions what="session" onEdit={() => onEditSession(s)} onDelete={() => onDeleteSession(s)} />}
            />
            <CollapseBody>
              {exercises.length ? (
                <ul className="divide-y divide-line">
                  {exercises.map((l, i) => (
                    <ExerciseRow key={l.id} l={l} index={i} accent={accent} onEdit={() => onEditLog(l)} onDelete={() => onDeleteLog(l)} />
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-[13px] text-slate-500">No exercises logged in this session yet.</p>
              )}
              {s.notes && <p className="border-t border-line bg-slate-50/70 px-5 py-3 text-[13px] text-slate-600">{s.notes}</p>}
            </CollapseBody>
          </Card>
        );
      })}

      {orphans.length > 0 && (
        <Card collapsible="orphans" className="fade-up overflow-hidden" style={{ animationDelay: `${card++ * 60}ms` }}>
          <GroupHeader icon={<ListPlus className="h-5 w-5" />} accent="weight" title="Exercises without a session" meta="Lifting calories are counted on a session — edit an exercise to attach it." />
          <CollapseBody>
            <ul className="divide-y divide-line">
              {orphans.map((l, i) => (
                <ExerciseRow key={l.id} l={l} index={i} accent="weight" onEdit={() => onEditLog(l)} onDelete={() => onDeleteLog(l)} />
              ))}
            </ul>
          </CollapseBody>
        </Card>
      )}

      {cardio.length > 0 && (
        <Card collapsible="cardio" className="fade-up overflow-hidden" style={{ animationDelay: `${card++ * 60}ms` }}>
          <GroupHeader
            icon={<Bike className="h-5 w-5" />}
            accent="water"
            title="Cardio"
            meta={<Meta icon={<Timer className="h-3.5 w-3.5" />}>{fmt(cardio.reduce((a, l) => a + (l.cardio_duration_min ?? 0), 0))} min</Meta>}
            kcal={cardioKcal}
          />
          <CollapseBody>
            <ul className="divide-y divide-line">
              {cardio.map((l, i) => (
                <ExerciseRow key={l.id} l={l} index={i} accent="water" onEdit={() => onEditLog(l)} onDelete={() => onDeleteLog(l)} />
              ))}
            </ul>
          </CollapseBody>
        </Card>
      )}
    </div>
  );
}
