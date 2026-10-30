"use client";

import { useEffect, useState } from "react";
import { Flame, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ACCENT, IconBubble } from "@/components/ui/fx";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/misc";
import { MUSCLE_GROUPS } from "@/config/constants";
import { useProfile } from "@/hooks/use-profile";
import { useExerciseLibrary, useMetReference } from "@/hooks/use-workouts";
import { api } from "@/lib/api";
import { fmt, humanize } from "@/lib/format";
import { withToast } from "@/lib/notify";
import type { SetEntry, WorkoutLog, WorkoutSession } from "@/lib/types";
import { cn, toNumberOrNull } from "@/lib/utils";
import { metCalories } from "./met";

type Kind = "strength" | "cardio";

interface ExerciseModalProps {
  open: boolean;
  onClose: () => void;
  date: string;
  kind: Kind;
  sessions: WorkoutSession[];
  editing: WorkoutLog | null;
  onSaved: () => void;
}

const emptySet = (): SetEntry => ({ reps: null, weight_kg: null, rpe: null });

export function ExerciseModal({ open, onClose, date, kind: initialKind, sessions, editing, onSaved }: ExerciseModalProps) {
  const { data: library } = useExerciseLibrary();
  const { data: mets } = useMetReference();
  const { data: profile } = useProfile();
  const [kind, setKind] = useState<Kind>(initialKind);
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [sets, setSets] = useState<SetEntry[]>([emptySet()]);
  const [repsText, setRepsText] = useState("");
  const [duration, setDuration] = useState("20");
  const [met, setMet] = useState("4.5");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const k = (editing?.workout_type ?? initialKind) as Kind;
    setKind(k);
    setName(editing?.exercise_name ?? "");
    setMuscle(editing?.target_muscle ?? "");
    setSessionId(editing?.session_id ? String(editing.session_id) : sessions[0] ? String(sessions[0].id) : "");
    setSets(editing?.sets_json?.length ? editing.sets_json : Array.from({ length: editing?.sets ?? 3 }, emptySet));
    setRepsText(editing?.reps ?? "");
    setDuration(String(editing?.cardio_duration_min ?? 20));
    setMet(String(editing?.met_value ?? 4.5));
    setRpe(editing?.rpe !== null && editing?.rpe !== undefined ? String(editing.rpe) : "");
    setNotes(editing?.notes ?? "");
  }, [open, editing, initialKind, sessions]);

  const cardioMets = (mets ?? []).filter((m) => !/lift|resist|circuit|strength/i.test(`${m.key} ${m.activity}`));
  const cardioPreview = metCalories(Number(met), profile?.current_weight_kg, Number(duration));

  const pickLibrary = (exerciseName: string) => {
    setName(exerciseName);
    const item = library?.find((l) => l.name === exerciseName);
    if (item) {
      setMuscle(item.target_muscle);
      setRepsText(item.default_reps);
      setSets(Array.from({ length: item.default_sets }, emptySet));
    }
  };

  const updateSet = (i: number, key: keyof SetEntry, v: string) => setSets((s) => s.map((row, idx) => (idx === i ? { ...row, [key]: toNumberOrNull(v) } : row)));

  const save = async () => {
    if (!name.trim()) return;
    const filled = sets.filter((s) => s.reps !== null || s.weight_kg !== null);
    const repsSummary = repsText || (filled.length ? Array.from(new Set(filled.map((s) => s.reps))).join("/") : null);
    const maxWeight = filled.reduce<number | null>((m, s) => (s.weight_kg !== null && (m === null || s.weight_kg > m) ? s.weight_kg : m), null);
    const maxRpe = filled.reduce<number | null>((m, s) => (s.rpe !== null && (m === null || s.rpe > m) ? s.rpe : m), null);
    const body =
      kind === "strength"
        ? {
            date,
            session_id: sessionId ? Number(sessionId) : null,
            workout_type: "strength",
            exercise_name: name.trim(),
            target_muscle: muscle || null,
            sets: sets.length,
            reps: repsSummary,
            weight_kg: maxWeight,
            sets_json: sets,
            rpe: toNumberOrNull(rpe) ?? maxRpe,
            notes: notes || null,
          }
        : {
            date,
            session_id: null,
            workout_type: "cardio",
            exercise_name: name.trim(),
            target_muscle: "cardio",
            cardio_duration_min: toNumberOrNull(duration),
            met_value: toNumberOrNull(met),
            rpe: toNumberOrNull(rpe),
            notes: notes || null,
          };
    setSaving(true);
    const ok = await withToast(
      () => (editing ? api.put(`/api/workouts/logs/${editing.id}`, body) : api.post("/api/workouts/logs", body)),
      editing ? "Exercise updated" : kind === "cardio" ? "Cardio logged" : "Exercise logged",
    );
    setSaving(false);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Edit exercise" : kind === "cardio" ? "Log cardio" : "Log strength exercise"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {!editing && (
          <Segmented
            options={[
              { value: "strength", label: "Strength" },
              { value: "cardio", label: "Cardio" },
            ]}
            value={kind}
            onChange={setKind}
          />
        )}

        {kind === "strength" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pick from library">
                <Select value="" onChange={(e) => e.target.value && pickLibrary(e.target.value)}>
                  <option value="">Choose an exercise…</option>
                  {Object.entries(
                    (library ?? []).reduce<Record<string, string[]>>((acc, l) => {
                      (acc[l.split] ??= []).push(l.name);
                      return acc;
                    }, {}),
                  ).map(([split, names]) => (
                    <optgroup key={split} label={humanize(split)}>
                      {names.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              <Field label="Exercise name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pull-ups" />
              </Field>
              <Field label="Target muscle">
                <Input list="muscles" value={muscle} onChange={(e) => setMuscle(e.target.value)} />
                <datalist id="muscles">
                  {MUSCLE_GROUPS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
              <Field info="lifting_once" label="Session" hint={sessions.length ? undefined : "Create a session first so the lifting block calories are counted."}>
                <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                  <option value="">No session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {humanize(s.split)} · {s.lifting_duration_min ?? "?"} min
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="rounded-2xl border border-line bg-slate-50/60 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-800">
                  Sets <span className="num ml-1 font-normal text-slate-500">{sets.length}</span>
                </p>
                <Button size="sm" variant="outline" onClick={() => setSets((s) => [...s, { ...(s[s.length - 1] ?? emptySet()) }])}>
                  <Plus className="h-3.5 w-3.5" /> Add set
                </Button>
              </div>
              <div className="mb-1.5 grid grid-cols-[2rem_1fr_1fr_1fr_2.25rem] gap-2 px-0.5 text-[11px] font-medium text-slate-500" aria-hidden>
                <span className="text-center">#</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                <span>RPE</span>
                <span />
              </div>
              <div className="space-y-2">
                {sets.map((s, i) => (
                  <div key={i} className="grid grid-cols-[2rem_1fr_1fr_1fr_2.25rem] items-center gap-2">
                    <span className={cn("num flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold", ACCENT.weight.tint, ACCENT.weight.text)}>{i + 1}</span>
                    <Input className="px-2.5" aria-label={`Set ${i + 1} reps`} type="number" inputMode="numeric" placeholder="Reps" value={s.reps ?? ""} onChange={(e) => updateSet(i, "reps", e.target.value)} />
                    <Input className="px-2.5" aria-label={`Set ${i + 1} weight in kg`} type="number" inputMode="decimal" placeholder="kg (0 = BW)" value={s.weight_kg ?? ""} onChange={(e) => updateSet(i, "weight_kg", e.target.value)} />
                    <Input className="px-2.5" aria-label={`Set ${i + 1} RPE`} type="number" inputMode="decimal" step="0.5" placeholder="RPE" value={s.rpe ?? ""} onChange={(e) => updateSet(i, "rpe", e.target.value)} />
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-crit-bg hover:text-crit-fg" onClick={() => setSets((all) => all.filter((_, idx) => idx !== i))} aria-label="Remove set">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-xs text-slate-500">Weight 0 = bodyweight. RPE = how hard the set felt (10 = nothing left).</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rep range (summary)" hint="Optional, e.g. 10-15">
                <Input value={repsText} onChange={(e) => setRepsText(e.target.value)} />
              </Field>
              <Field label="Overall RPE" info="rpe">
                <Input type="number" step="0.5" value={rpe} onChange={(e) => setRpe(e.target.value)} />
              </Field>
            </div>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Activity">
              <Input list="cardio-list" value={name} onChange={(e) => setName(e.target.value)} placeholder="Treadmill walk (incline)" />
              <datalist id="cardio-list">
                {cardioMets.map((m) => (
                  <option key={m.key} value={m.activity} />
                ))}
              </datalist>
            </Field>
            <Field label="Duration (min)">
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
            <Field label="MET value" info="met">
              <Input type="number" step="0.1" value={met} onChange={(e) => setMet(e.target.value)} />
              <div className="mt-1 flex flex-wrap gap-1.5">
                {cardioMets.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setMet(String(m.default));
                      if (!name) setName(m.activity);
                    }}
                    aria-pressed={Number(met) === m.default}
                    className={cn(
                      "min-h-[32px] rounded-full border px-2.5 text-xs transition-colors",
                      Number(met) === m.default ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-line text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    {m.activity} <span className="num text-slate-400">{m.default}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="RPE" info="rpe">
              <Input type="number" step="0.5" value={rpe} onChange={(e) => setRpe(e.target.value)} />
            </Field>
            <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3 sm:col-span-2", ACCENT.burn.border, ACCENT.burn.tint)}>
              <IconBubble accent="burn" className="bg-card">
                <Flame className="h-4 w-4" />
              </IconBubble>
              <div>
                <p className="text-[13px] font-medium text-slate-600">Estimated burn</p>
                <p className="num text-lg font-semibold text-slate-900">
                  {cardioPreview !== null ? fmt(cardioPreview) : "—"} {cardioPreview !== null && <span className="text-sm font-normal text-slate-500">kcal</span>}
                </p>
              </div>
            </div>
          </div>
        )}
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
