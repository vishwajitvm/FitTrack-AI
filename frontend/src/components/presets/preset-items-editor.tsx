"use client";

import { useEffect, useState } from "react";
import { Bike, Dumbbell, Timer, Trash2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconBubble } from "@/components/ui/fx";
import { Modal } from "@/components/ui/modal";
import { Stepper } from "@/components/ui/touch";
import { api } from "@/lib/api";
import { fmt, humanize } from "@/lib/format";
import { withToast } from "@/lib/notify";
import type { MealPayload, Preset, WorkoutPayload } from "@/lib/types";

const r1 = (n: number) => Math.round(n * 10) / 10;

interface PresetItemsEditorProps {
  preset: Preset | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Edit what a routine / saved meal contains (portions, sets, minutes) or remove items. */
export function PresetItemsEditor({ preset, onClose, onSaved }: PresetItemsEditorProps) {
  const [payload, setPayload] = useState<WorkoutPayload | MealPayload | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPayload(preset ? (JSON.parse(JSON.stringify(preset.payload)) as WorkoutPayload | MealPayload) : null);
  }, [preset]);

  const save = async () => {
    if (!preset || !payload) return;
    setSaving(true);
    const ok = await withToast(() => api.put(`/api/presets/${preset.id}`, { payload }), "Saved");
    setSaving(false);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <Modal
      open={!!preset}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          {preset?.icon && <span aria-hidden>{preset.icon}</span>}
          {`Edit "${preset?.name ?? ""}"`}
        </span>
      }
      description="Change amounts or remove items. To add items, log them once and save the day/meal again."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      {preset?.kind === "meal" && payload && "items" in payload && <MealItems payload={payload} onChange={setPayload} />}
      {preset?.kind === "workout" && payload && "exercises" in payload && <WorkoutItems payload={payload} onChange={setPayload} />}
    </Modal>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="h-11 w-11 text-crit-fg hover:bg-crit-bg" onClick={onClick} aria-label={`Remove ${label}`}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

function MealItems({ payload, onChange }: { payload: MealPayload; onChange: (p: MealPayload) => void }) {
  /** Scale one item's portion and macros together. */
  const scaleItem = (i: number, qty: number) => {
    const it = payload.items[i];
    const k = it.quantity ? qty / it.quantity : 1;
    const items = payload.items.map((x, idx) =>
      idx === i
        ? { ...x, quantity: qty, weight_grams: x.weight_grams !== null ? r1(x.weight_grams * k) : null, calories: Math.round(x.calories * k), protein: r1(x.protein * k), carbs: r1(x.carbs * k), fat: r1(x.fat * k), fibre: r1(x.fibre * k) }
        : x,
    );
    onChange({ ...payload, items });
  };
  if (!payload.items.length) return <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No items.</p>;
  const total = payload.items.reduce((a, it) => ({ kcal: a.kcal + it.calories, p: a.p + it.protein }), { kcal: 0, p: 0 });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-[13px]">
        <span className="num rounded-full bg-acc-kcal/10 px-3 py-1 font-medium text-acc-kcal">{fmt(total.kcal)} kcal</span>
        <span className="num rounded-full bg-acc-protein/10 px-3 py-1 font-medium text-acc-protein">{fmt(total.p, 1)} g protein</span>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {payload.items.map((it, i) => (
          <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <IconBubble accent="kcal" className="hidden sm:flex">
              <Utensils className="h-4 w-4" />
            </IconBubble>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{it.food_name}</p>
              <p className="num text-xs text-slate-500">
                {fmt(it.calories)} kcal · {fmt(it.protein, 1)} g protein
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Stepper size="sm" value={it.quantity} fallback={1} min={0.25} max={20} step={0.25} unit={it.portion_unit ?? ""} label={`${it.food_name} amount`} onChange={(v) => scaleItem(i, v)} format={(v) => fmt(v, v % 1 ? 2 : 0)} />
              <RemoveButton label={it.food_name} onClick={() => onChange({ ...payload, items: payload.items.filter((_, idx) => idx !== i) })} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkoutItems({ payload, onChange }: { payload: WorkoutPayload; onChange: (p: WorkoutPayload) => void }) {
  if (!payload.session && !payload.cardio.length && !payload.exercises.length) return <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No items.</p>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {payload.session && (
        <li className="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <IconBubble accent="burn">
            <Timer className="h-4 w-4" />
          </IconBubble>
          <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{humanize(payload.session.split)} lifting time</span>
          <Stepper size="sm" value={payload.session.lifting_duration_min} fallback={60} step={5} min={0} max={240} unit="min" label="lifting minutes" onChange={(v) => onChange({ ...payload, session: { ...payload.session!, lifting_duration_min: v } })} />
        </li>
      )}
      {payload.cardio.map((c, i) => (
        <li key={`c${i}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <IconBubble accent="burn">
            <Bike className="h-4 w-4" />
          </IconBubble>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{c.exercise_name}</span>
          <div className="flex items-center gap-1">
            <Stepper size="sm" value={c.cardio_duration_min} fallback={20} step={5} min={0} max={240} unit="min" label={`${c.exercise_name} minutes`} onChange={(v) => onChange({ ...payload, cardio: payload.cardio.map((x, idx) => (idx === i ? { ...x, cardio_duration_min: v } : x)) })} />
            <RemoveButton label={c.exercise_name} onClick={() => onChange({ ...payload, cardio: payload.cardio.filter((_, idx) => idx !== i) })} />
          </div>
        </li>
      ))}
      {payload.exercises.map((ex, i) => {
        const set = (patch: Partial<typeof ex>) => onChange({ ...payload, exercises: payload.exercises.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
        return (
          <li key={`e${i}`} className="px-3 py-2.5">
            <div className="flex items-center gap-3">
              <IconBubble accent="burn">
                <Dumbbell className="h-4 w-4" />
              </IconBubble>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{ex.exercise_name}</span>
              <RemoveButton label={ex.exercise_name} onClick={() => onChange({ ...payload, exercises: payload.exercises.filter((_, idx) => idx !== i) })} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 sm:pl-12">
              <Stepper size="sm" value={ex.sets} fallback={3} min={1} max={10} unit="sets" label="sets" onChange={(v) => set({ sets: v })} />
              <Stepper size="sm" value={ex.weight_kg} fallback={0} min={0} max={500} step={2.5} unit="kg" label="weight" onChange={(v) => set({ weight_kg: v })} format={(v) => (v === 0 ? "BW" : fmt(v, v % 1 ? 1 : 0))} />
              <input
                value={ex.reps ?? ""}
                onChange={(e) => set({ reps: e.target.value || null })}
                aria-label="reps"
                placeholder="reps"
                className="h-9 w-20 rounded-xl border border-line bg-card px-2 text-center text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
