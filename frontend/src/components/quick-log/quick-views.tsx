"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Droplets, Dumbbell, HeartPulse, Loader2, Milk, Save, Scale, Settings2 } from "lucide-react";
import { ScoopButton } from "@/components/food/scoop-button";
import { Button } from "@/components/ui/button";
import { IconBubble, Sparkline, type Accent } from "@/components/ui/fx";
import { Skeleton } from "@/components/ui/misc";
import { Pills, Stepper } from "@/components/ui/touch";
import { SEVERITY_LABELS, SYMPTOMS } from "@/config/constants";
import { useDaily, useDailyRange } from "@/hooks/use-daily";
import { useProfile } from "@/hooks/use-profile";
import { usePresets, useToday } from "@/hooks/use-quicklog";
import { useRevalidateTracking } from "@/hooks/use-revalidate";
import { api } from "@/lib/api";
import { addDays, fmt, humanize, nowTime, today } from "@/lib/format";
import { notify, notifyUndo } from "@/lib/notify";
import type { BioFeedback, Preset, SymptomType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PresetCard } from "./meal-quick-panel";

/** "Already done today" line shown at the top of a quick-log view. */
function TodayNote({ accent, children }: { accent: Accent; children: ReactNode }) {
  const ring: Record<Accent, string> = {
    kcal: "border-acc-kcal/30 bg-acc-kcal/10",
    protein: "border-acc-protein/30 bg-acc-protein/10",
    burn: "border-acc-burn/30 bg-acc-burn/10",
    balance: "border-acc-balance/30 bg-acc-balance/10",
    weight: "border-acc-weight/30 bg-acc-weight/10",
    sleep: "border-acc-sleep/30 bg-acc-sleep/10",
    water: "border-acc-water/30 bg-acc-water/10",
  };
  return (
    <div className={cn("fade-up flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left text-sm text-slate-700", ring[accent])}>
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-good-fg text-white dark:text-slate-950">
        <Check className="h-3 w-3" />
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Save part of today's check-in and offer Undo that restores the previous value. */
async function saveCheckinField<K extends "morning_weight" | "water_ml">(field: K, value: number, previous: number | null, label: string, desc: string, refresh: () => void) {
  const date = today();
  try {
    await api.put(`/api/daily/${date}/checkin`, { [field]: value });
    refresh();
    notifyUndo(label, desc, () => api.put(`/api/daily/${date}/checkin`, { [field]: previous }), refresh);
    return true;
  } catch (err) {
    notify.error(err, "Could not save");
    return false;
  }
}

export function WeightQuick({ onDone }: { onDone: () => void }) {
  const date = today();
  const { data: todayDetail } = useDaily(date);
  const { data: yesterday } = useDaily(addDays(date, -1));
  const { data: profile } = useProfile();
  const refresh = useRevalidateTracking();
  const [value, setValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: week } = useDailyRange(addDays(date, -6), date);
  const current = todayDetail?.summary.morning_weight ?? null;
  const start = current ?? yesterday?.summary.morning_weight ?? profile?.current_weight_kg ?? null;
  const trend = (week ?? []).map((d) => d.morning_weight);

  useEffect(() => {
    if (value === null && start !== null) setValue(start);
  }, [start, value]);

  if (value === null) return <Skeleton className="h-40 rounded-2xl" />;
  return (
    <div className="space-y-5 text-center">
      {current !== null && (
        <TodayNote accent="weight">
          Already weighed in today: <b className="num">{fmt(current, 1)} kg</b>. Saving again replaces it.
        </TodayNote>
      )}
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-acc-weight/10 px-4 py-5">
        <IconBubble accent="weight" className="h-11 w-11 bg-card shadow-sm">
          <Scale className="h-5 w-5" />
        </IconBubble>
        <p className="num text-[40px] font-semibold leading-none tracking-tight text-slate-900">
          {fmt(value, 1)}
          <span className="ml-1 text-base font-normal text-slate-500">kg</span>
        </p>
        <p className="text-[13px] text-slate-600">Morning weight, after the toilet and before eating.</p>
        {trend.filter((v) => v !== null).length > 1 && (
          <div className="w-full max-w-xs">
            <Sparkline values={trend} accent="weight" height={36} />
            <p className="text-[11px] text-slate-500">Last 7 days</p>
          </div>
        )}
        {current !== null && current !== value && <p className="num text-xs text-slate-500">Saved today: {fmt(current, 1)} kg</p>}
      </div>
      <div className="flex justify-center">
        <Stepper value={value} onChange={setValue} step={0.1} min={30} max={300} unit="kg" label="weight" format={(v) => fmt(v, 1)} />
      </div>
      <div className="flex justify-center gap-2">
        {[-0.5, +0.5].map((d) => (
          <button key={d} type="button" onClick={() => setValue(Math.round((value + d) * 10) / 10)} className="num min-h-[44px] rounded-xl border border-line bg-card px-5 text-sm font-medium text-slate-700 transition hover:border-acc-weight/40 hover:bg-acc-weight/5 active:scale-95">
            {d > 0 ? "+" : "−"}0.5
          </button>
        ))}
      </div>
      <Button
        size="lg"
        className="w-full"
        loading={saving}
        onClick={async () => {
          setSaving(true);
          const ok = await saveCheckinField("morning_weight", value, current, `Weight ${fmt(value, 1)} kg saved`, current !== null ? `Was ${fmt(current, 1)} kg` : "Today's weigh-in", refresh);
          setSaving(false);
          if (ok) onDone();
        }}
      >
        <Save className="h-4 w-4" /> Save {fmt(value, 1)} kg
      </Button>
    </div>
  );
}

export function WaterQuick({ onDone }: { onDone: () => void }) {
  const date = today();
  const { data } = useDaily(date);
  const { data: profile } = useProfile();
  const refresh = useRevalidateTracking();
  const [busy, setBusy] = useState<number | null>(null);
  const current = data?.summary.water_ml ?? 0;
  const target = profile?.water_target_ml ?? Math.round(((profile?.current_weight_kg ?? 70) * 35) / 100) * 100;

  const add = async (ml: number) => {
    setBusy(ml);
    const ok = await saveCheckinField("water_ml", current + ml, data?.summary.water_ml ?? null, `+${ml} ml water`, `${fmt(current + ml)} of ~${fmt(target)} ml today`, refresh);
    setBusy(null);
    if (ok) onDone();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-acc-water/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <IconBubble accent="water" className="h-11 w-11 bg-card shadow-sm">
            <Droplets className="h-5 w-5" />
          </IconBubble>
          <p className="num text-sm text-slate-600">
            <span className="text-2xl font-semibold tracking-tight text-slate-900">{fmt(current)}</span> of ~{fmt(target)} ml today
          </p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-acc-water transition-[width] duration-700" style={{ width: `${Math.min(100, (current / Math.max(1, target)) * 100)}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[250, 500, 750].map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={() => add(ml)}
            disabled={busy !== null}
            className="lift num min-h-[76px] rounded-2xl border border-line bg-card text-base font-semibold shadow-card hover:border-acc-water/40 disabled:opacity-50"
          >
            {busy === ml ? <Loader2 className="mx-auto h-4 w-4 animate-spin text-acc-water" /> : <span className="text-acc-water">+{ml} ml</span>}
            <span className="block text-[11px] font-normal text-slate-500">{ml === 250 ? "1 glass" : ml === 500 ? "1 bottle" : "large bottle"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const QUICK_SYMPTOMS: SymptomType[] = ["bloating", "gas", "acid_reflux", "low_energy", "weakness", "headache", "soreness", "cramps"];

export function SymptomQuick({ onDone }: { onDone: () => void }) {
  const refresh = useRevalidateTracking();
  const { data: todayDetail } = useDaily(today());
  const noted = todayDetail?.biofeedback ?? [];
  const [symptom, setSymptom] = useState<SymptomType | null>(null);
  const [severity, setSeverity] = useState(1);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!symptom) return;
    setSaving(true);
    try {
      const created = await api.post<BioFeedback>("/api/biofeedback", { timestamp: `${today()}T${nowTime()}:00`, symptom_type: symptom, severity, trigger_suspect: null, body_part: null, notes: null });
      refresh();
      notifyUndo(`${humanize(symptom)} noted`, SEVERITY_LABELS[severity], () => api.del(`/api/biofeedback/${created.id}`), refresh);
      onDone();
    } catch (err) {
      notify.error(err, "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {noted.length > 0 && (
        <TodayNote accent="sleep">
          Noted today: {noted.map((b) => `${humanize(b.symptom_type)} (${b.severity_label})`).join(", ")}
        </TodayNote>
      )}
      <div className="flex items-center gap-3">
        <IconBubble accent="sleep">
          <HeartPulse className="h-4 w-4" />
        </IconBubble>
        <p className="text-[13px] text-slate-600">Pick what you feel right now — it helps spot food triggers over time.</p>
      </div>
      <Pills options={SYMPTOMS.filter((s) => QUICK_SYMPTOMS.includes(s.value)).map((s) => ({ value: s.value, label: s.label }))} value={symptom} onChange={setSymptom} ariaLabel="Symptom" />
      <div>
        <p className="mb-2 text-[13px] font-medium text-slate-700">How bad?</p>
        <Pills options={[1, 2, 3].map((v) => ({ value: v, label: SEVERITY_LABELS[v] }))} value={severity} onChange={setSeverity} ariaLabel="Severity" />
      </div>
      <Button size="lg" className="w-full" onClick={save} loading={saving} disabled={!symptom}>
        <Save className="h-4 w-4" /> Save
      </Button>
      <Link href="/checkin" className="flex min-h-[44px] items-center justify-center text-[13px] font-medium text-brand-600 hover:underline">
        Add a suspected cause or notes on Check-in →
      </Link>
    </div>
  );
}

export function ScoopQuick() {
  const { data: profile } = useProfile();
  const { data: todayDetail } = useDaily(today());
  const scoops = todayDetail?.summary.whey_scoops ?? 0;
  return (
    <div className="space-y-4">
    {scoops > 0 && (
      <TodayNote accent="protein">
        <b className="num">{fmt(scoops, scoops % 1 ? 1 : 0)}</b> scoop{scoops === 1 ? "" : "s"} already logged today
        {profile?.protein_per_scoop_g ? ` · ${fmt(scoops * profile.protein_per_scoop_g, 1)} g protein` : ""}.
      </TodayNote>
    )}
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-acc-protein/10 px-4 py-6 text-center">
      <IconBubble accent="protein" className="h-12 w-12 bg-card shadow-sm">
        <Milk className="h-6 w-6" />
      </IconBubble>
      <div>
        <p className="text-[15px] font-semibold text-slate-900">{profile?.protein_supplement_name ?? "Your protein powder"}</p>
        {profile?.protein_per_scoop_g ? <p className="num mt-0.5 text-[13px] text-acc-protein">1 scoop = {fmt(profile.protein_per_scoop_g, 1)} g protein</p> : null}
      </div>
      <ScoopButton className="h-14 text-base" />
    </div>
    </div>
  );
}

/** List of workout routines, today's suggested split first. */
export function WorkoutPicker({ onPick }: { onPick: (p: Preset) => void }) {
  const { data: presets, isLoading } = usePresets("workout");
  const { data: plan } = useToday();
  const { data: todayDetail } = useDaily(today());
  const split = plan?.workout.split;
  const sessions = todayDetail?.sessions ?? [];
  const exercises = todayDetail?.workouts ?? [];
  const minutes = sessions.reduce((n, s) => n + (s.lifting_duration_min ?? 0), 0) + exercises.reduce((n, w) => n + (w.cardio_duration_min ?? 0), 0);
  const sorted = [...(presets ?? [])].sort((a, b) => Number(b.split === split) - Number(a.split === split));

  return (
    <div className="space-y-3">
      {(sessions.length > 0 || exercises.length > 0) && (
        <TodayNote accent="burn">
          Already logged today: <b>{sessions.map((s) => humanize(s.split)).join(" + ") || "Workout"}</b>
          {minutes ? ` · ${fmt(minutes)} min` : ""} · {exercises.length} exercise{exercises.length === 1 ? "" : "s"}. Adding a routine logs another session.
        </TodayNote>
      )}
      {plan?.workout.message && (
        <div className="flex items-start gap-3 rounded-2xl bg-acc-burn/10 px-4 py-3">
          <Dumbbell className="mt-0.5 h-4 w-4 shrink-0 text-acc-burn" />
          <p className="text-sm text-slate-700">{plan.workout.message}</p>
        </div>
      )}
      {isLoading && <Skeleton className="h-32 rounded-2xl" />}
      {presets && presets.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm leading-relaxed text-slate-600">
          No routines yet. Log a workout once on the Workouts page, then tap &ldquo;Save as routine&rdquo; — next time it&apos;s one tap.
        </p>
      )}
      <div className="grid gap-2">
        {sorted.map((p, i) => (
          <div key={p.id} className={cn("fade-up relative", p.split === split && "[&>button]:border-brand-500/40 [&>button]:pr-20")} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <PresetCard preset={p} busy={false} onTap={() => onPick(p)} />
            {p.split === split && (
              <span className="pointer-events-none absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-good-bg px-2 py-0.5 text-[11px] font-semibold text-good-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-good-fg" aria-hidden />
                Today
              </span>
            )}
          </div>
        ))}
      </div>
      <Link href="/workouts?custom=1" className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 text-sm font-medium text-slate-700 transition-colors hover:border-brand-500 hover:bg-brand-50/50 hover:text-brand-700">
        <Settings2 className="h-4 w-4" /> Custom workout…
      </Link>
    </div>
  );
}
