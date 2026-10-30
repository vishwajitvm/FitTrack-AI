"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ACCENT, IconBubble } from "@/components/ui/fx";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SPLITS } from "@/config/constants";
import { useProfile } from "@/hooks/use-profile";
import { useMetReference } from "@/hooks/use-workouts";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { withToast } from "@/lib/notify";
import type { Split, WorkoutSession } from "@/lib/types";
import { cn, toNumberOrNull } from "@/lib/utils";
import { metCalories } from "./met";
import { splitAccent } from "./split-style";

interface SessionModalProps {
  open: boolean;
  onClose: () => void;
  date: string;
  editing: WorkoutSession | null;
  defaultSplit?: string | null;
  onSaved: () => void;
}

export function SessionModal({ open, onClose, date, editing, defaultSplit, onSaved }: SessionModalProps) {
  const { data: profile } = useProfile();
  const { data: mets } = useMetReference();
  const [split, setSplit] = useState<Split>("pull");
  const [duration, setDuration] = useState("60");
  const [met, setMet] = useState("4");
  const [startedAt, setStartedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [rpe, setRpe] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSplit((editing?.split ?? (SPLITS.some((s) => s.value === defaultSplit) ? defaultSplit : "pull")) as Split);
    setDuration(String(editing?.lifting_duration_min ?? 60));
    setMet(String(editing?.lifting_met ?? 4));
    setStartedAt(editing?.started_at ?? "");
    setNotes(editing?.notes ?? "");
    setRpe(editing?.session_rpe ? String(editing.session_rpe) : "");
  }, [open, editing, defaultSplit]);

  const preview = metCalories(Number(met), profile?.current_weight_kg, Number(duration));
  const liftingMets = (mets ?? []).filter((m) => /lift|resist|circuit|weight|strength/i.test(`${m.key} ${m.activity}`));

  const save = async () => {
    const body = {
      date,
      split,
      lifting_duration_min: toNumberOrNull(duration),
      lifting_met: toNumberOrNull(met),
      started_at: startedAt || null,
      notes: notes || null,
      session_rpe: toNumberOrNull(rpe),
    };
    setSaving(true);
    const ok = await withToast(
      () => (editing ? api.put(`/api/workouts/sessions/${editing.id}`, body) : api.post("/api/workouts/sessions", body)),
      editing ? "Session updated" : "Session added",
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
      title={editing ? "Edit training session" : "New training session"}
      description="The lifting block's calories are counted once for the whole duration — individual exercises never add extra calories."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save session
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Split" info="ppl_split" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Split">
            {SPLITS.map((s) => {
              const a = ACCENT[splitAccent(s.value)];
              const on = split === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSplit(s.value)}
                  className={cn(
                    "inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-all active:scale-95",
                    on ? cn(a.border, a.tint, a.text, "shadow-sm") : "border-line bg-card text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", a.solid, !on && "opacity-60")} aria-hidden />
                  {s.label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Start time">
          <Input type="time" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </Field>
        <Field info="lifting_once" label="Lifting duration (min)" hint="Whole block incl. rest between sets; exclude cardio.">
          <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <Field info="met" label="MET value" hint="General resistance training 3.5–4.5; vigorous/circuit 5–6.">
          <Input type="number" step="0.1" value={met} onChange={(e) => setMet(e.target.value)} />
          {liftingMets.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {liftingMets.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMet(String(m.default))}
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
          )}
        </Field>
        <Field label="Session RPE — how hard did the whole session feel?" info="session_rpe" className="sm:col-span-2" hint="1 = very easy · 5 = steady · 7 = hard · 9–10 = maximal. Leave unset if unsure (7 is assumed).">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={rpe || 7}
              onChange={(e) => setRpe(e.target.value)}
              aria-label="Session RPE"
              className={`h-2 flex-1 cursor-pointer accent-brand-600 ${rpe ? "" : "opacity-40"}`}
            />
            <span className={cn("num w-16 text-right text-sm font-semibold", rpe ? "text-slate-900" : "text-slate-400")}>{rpe ? `${rpe}/10` : "not set"}</span>
            {rpe && (
              <button type="button" onClick={() => setRpe("")} className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                Clear
              </button>
            )}
          </div>
          {rpe && Number(duration) > 0 && <p className="num text-xs text-slate-500">Training load: {Number(duration)} min × RPE {rpe} = {Number(duration) * Number(rpe)} units</p>}
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className={cn("mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3", ACCENT.burn.border, ACCENT.burn.tint)}>
        <IconBubble accent="burn" className="bg-card">
          <Flame className="h-4 w-4" />
        </IconBubble>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-slate-600">Estimated lifting burn</p>
          <p className="num text-lg font-semibold text-slate-900">
            {preview !== null ? (
              <>
                {fmt(preview)} <span className="text-sm font-normal text-slate-500">kcal</span>
              </>
            ) : (
              <span className="text-sm font-normal text-slate-500">— set your weight in Profile</span>
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
}
