"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Bike, Check, Dumbbell, ListChecks, Save } from "lucide-react";
import { ErrorState } from "@/components/common/states";
import { usePrefs } from "@/components/layout/prefs-provider";
import { Button } from "@/components/ui/button";
import { IconBubble } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/misc";
import { Pills, Stepper } from "@/components/ui/touch";
import { useQuickActions } from "@/hooks/use-quick-actions";
import { api } from "@/lib/api";
import { fmt, humanize, prettyDate } from "@/lib/format";
import type { LastPerformance, Preset, PresetPrefill, WorkoutPayload, WorkoutPresetExercise } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WorkoutPresetSheetProps {
  preset: Pick<Preset, "id" | "name" | "icon"> | null;
  date: string;
  onClose: () => void;
}

const RPE = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

const lastOf = (ex: WorkoutPresetExercise): Partial<LastPerformance> | null => ex.last ?? ex.last_performance ?? null;
const suggestionOf = (ex: WorkoutPresetExercise) => ex.suggestion ?? lastOf(ex)?.suggestion ?? null;
const isNumeric = (s: string | null) => !!s && /^\d+$/.test(s.trim());

/** Pick a routine → adjust with steppers → one "Save workout". */
export function WorkoutPresetSheet({ preset, date, onClose }: WorkoutPresetSheetProps) {
  const { t } = usePrefs();
  const { applyPreset } = useQuickActions();
  const [payload, setPayload] = useState<WorkoutPayload | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!preset) return;
    setPayload(null);
    setError(null);
    api
      .get<PresetPrefill>(`/api/presets/${preset.id}/prefill`, { date })
      .then((r) => {
        const p = r.payload as WorkoutPayload;
        setPayload({ session: p.session ?? null, cardio: p.cardio ?? [], exercises: (p.exercises ?? []).map((e) => ({ ...e, skip: e.skip ?? false })) });
      })
      .catch(setError);
  }, [preset, date]);

  const save = async () => {
    if (!preset || !payload) return;
    setSaving(true);
    const res = await applyPreset(preset, { date, payload });
    setSaving(false);
    if (res) onClose();
  };

  const setEx = (i: number, patch: Partial<WorkoutPresetExercise>) => setPayload((p) => (p ? { ...p, exercises: p.exercises.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) } : p));
  const done = payload?.exercises.filter((e) => !e.skip).length ?? 0;

  return (
    <Modal
      open={!!preset}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-acc-burn/10 text-xl" aria-hidden>
            {preset?.icon || "🏋️"}
          </span>
          {preset?.name}
        </span>
      }
      description={`${prettyDate(date, { weekday: "long", day: "numeric", month: "short" })} · adjust anything, then save once`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" onClick={save} loading={saving} disabled={!payload}>
            <Save className="h-4 w-4" /> Save workout
          </Button>
        </>
      }
    >
      {error ? <ErrorState error={error} /> : null}
      {!payload && !error && (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      )}
      {payload && (
        <div className="space-y-5">
          {payload.cardio.length > 0 && (
            <section>
              <SectionTitle icon={<Bike className="h-4 w-4" />} title="Cardio" />
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {payload.cardio.map((c, i) => (
                  <div key={i} className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 transition-opacity", c.skip && "opacity-50")}>
                    <SkipToggle skipped={!!c.skip} onToggle={() => setPayload({ ...payload, cardio: payload.cardio.map((x, idx) => (idx === i ? { ...x, skip: !x.skip } : x)) })} label={c.exercise_name} />
                    <Stepper
                      value={c.cardio_duration_min}
                      fallback={20}
                      step={5}
                      min={0}
                      max={240}
                      unit="min"
                      label={`${c.exercise_name} minutes`}
                      onChange={(v) => setPayload({ ...payload, cardio: payload.cardio.map((x, idx) => (idx === i ? { ...x, cardio_duration_min: v } : x)) })}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {payload.session && (
            <section className="space-y-4 rounded-2xl border border-line bg-slate-50/60 p-4">
              <SectionTitle
                icon={<Dumbbell className="h-4 w-4" />}
                title={
                  <>
                    {humanize(payload.session.split)} lifting block
                    <InfoTip term="lifting_once" />
                  </>
                }
                flush
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-slate-700">Time in the gym (lifting)</span>
                <Stepper
                  value={payload.session.lifting_duration_min}
                  fallback={60}
                  step={5}
                  min={0}
                  max={240}
                  unit="min"
                  label="lifting minutes"
                  onChange={(v) => setPayload({ ...payload, session: { ...payload.session!, lifting_duration_min: v } })}
                />
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1 text-sm text-slate-700">
                  {t("How hard did it feel? (1 easy – 10 max)", "Session RPE (1–10)")} <InfoTip term="session_rpe" />
                </p>
                <Pills options={RPE} value={payload.session.session_rpe} onChange={(v) => setPayload({ ...payload, session: { ...payload.session!, session_rpe: v } })} layout="scale" ariaLabel="Session effort" />
              </div>
            </section>
          )}

          {payload.exercises.length > 0 && (
            <section>
              <SectionTitle
                icon={<ListChecks className="h-4 w-4" />}
                title="Exercises"
                aside={
                  <span className="num text-xs font-normal text-slate-500">
                    {done}/{payload.exercises.length} done · tap a name to skip
                  </span>
                }
              />
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-acc-burn/10">
                <div className="h-full rounded-full bg-acc-burn transition-[width] duration-500" style={{ width: `${(done / Math.max(1, payload.exercises.length)) * 100}%` }} />
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {payload.exercises.map((ex, i) => (
                  <ExerciseRow key={i} ex={ex} onChange={(patch) => setEx(i, patch)} />
                ))}
              </ul>
            </section>
          )}

          {!payload.session && !payload.cardio.length && !payload.exercises.length && <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">This routine is empty — edit it under Routines & presets.</p>}
        </div>
      )}
    </Modal>
  );
}

function SkipToggle({ skipped, onToggle, label }: { skipped: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={!skipped} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left">
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors", skipped ? "border-slate-300 bg-card" : "border-navy bg-navy text-white")}>
        {!skipped && <Check className="h-4 w-4" />}
      </span>
      <span className={cn("truncate text-sm font-medium", skipped ? "text-slate-500 line-through" : "text-slate-900")}>{label}</span>
    </button>
  );
}

function ExerciseRow({ ex, onChange }: { ex: WorkoutPresetExercise; onChange: (patch: Partial<WorkoutPresetExercise>) => void }) {
  const last = lastOf(ex);
  const sug = suggestionOf(ex);
  const repsNum = isNumeric(ex.reps) ? Number(ex.reps) : null;
  const canApply = sug && ((sug.weight_kg !== null && sug.weight_kg !== ex.weight_kg) || (sug.reps !== null && String(sug.reps) !== ex.reps));

  return (
    <li className={cn("px-3 py-2.5 transition-opacity", ex.skip && "opacity-50")}>
      <SkipToggle skipped={!!ex.skip} onToggle={() => onChange({ skip: !ex.skip })} label={ex.exercise_name} />
      {last?.date && (
        <p className="ml-8 text-[11px] text-slate-500">
          Last done {prettyDate(last.date, { day: "numeric", month: "short" })}
          {last.sets != null ? ` · ${last.sets}×${last.reps ?? "?"}${last.weight_kg ? ` @ ${fmt(last.weight_kg, 1)} kg` : ""}` : " · prefilled with those numbers"}
        </p>
      )}
      {!ex.skip && (
        <div className="ml-8 mt-2 flex flex-wrap items-center gap-2">
          <Stepper size="sm" value={ex.sets} fallback={3} min={1} max={10} unit="sets" label="sets" onChange={(v) => onChange({ sets: v })} />
          {repsNum !== null || !ex.reps ? (
            <Stepper size="sm" value={repsNum} fallback={10} min={1} max={50} unit="reps" label="reps" onChange={(v) => onChange({ reps: String(v) })} />
          ) : (
            <input
              value={ex.reps ?? ""}
              onChange={(e) => onChange({ reps: e.target.value })}
              aria-label="reps"
              className="h-9 w-20 rounded-xl border border-line bg-card px-2 text-center text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          )}
          <Stepper size="sm" value={ex.weight_kg} fallback={0} min={0} max={500} step={2.5} unit="kg" label="weight" onChange={(v) => onChange({ weight_kg: v })} format={(v) => (v === 0 ? "BW" : fmt(v, v % 1 ? 1 : 0))} />
          {sug && canApply && (
            <button
              type="button"
              onClick={() => onChange({ weight_kg: sug.weight_kg ?? ex.weight_kg, reps: sug.reps !== null ? String(sug.reps) : ex.reps })}
              title={sug.message}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-good-bg px-3 text-xs font-medium text-good-fg hover:opacity-90"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              {sug.weight_kg !== null && sug.weight_kg !== ex.weight_kg ? `${fmt(sug.weight_kg, 1)} kg` : `${sug.reps} reps`}
            </button>
          )}
        </div>
      )}
      {!ex.skip && sug?.message && <p className="ml-8 mt-1 text-[11px] text-slate-500">{sug.message}</p>}
    </li>
  );
}

function SectionTitle({ icon, title, aside, flush }: { icon: React.ReactNode; title: React.ReactNode; aside?: React.ReactNode; flush?: boolean }) {
  return (
    <h4 className={cn("flex items-center justify-between gap-2", !flush && "mb-2.5")}>
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <IconBubble accent="burn" className="h-8 w-8">
          {icon}
        </IconBubble>
        <span className="flex items-center gap-1">{title}</span>
      </span>
      {aside}
    </h4>
  );
}
