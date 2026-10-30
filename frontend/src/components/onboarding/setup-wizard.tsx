"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock, Dumbbell, ExternalLink, Home, KeyRound, Milk, Moon, Sparkles, Sunrise, Target, User, type LucideIcon } from "lucide-react";
import { WIZARD_KEY } from "@/components/layout/prefs-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pills, Stepper } from "@/components/ui/touch";
import { useProviders } from "@/hooks/use-ai";
import { useProfile } from "@/hooks/use-profile";
import { usePresets } from "@/hooks/use-quicklog";
import { useRevalidatePrefix, useRevalidateTracking } from "@/hooks/use-revalidate";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["About you", "Your goal", "Your day", "Protein powder", "Free AI"] as const;
const STEP_ICONS: LucideIcon[] = [User, Target, Clock, Milk, Sparkles];

const GOALS = [
  { key: "lose", emoji: "🔥", title: "Lose fat", text: "Keep muscle and strength while the scale goes down", goal: "Lose fat while keeping muscle and strength", factor: 0.9 },
  { key: "build", emoji: "💪", title: "Build muscle", text: "Get stronger with a small calorie surplus", goal: "Build muscle and strength", factor: 1 },
  { key: "health", emoji: "🌿", title: "Stay healthy", text: "Eat well, move more, feel better", goal: "Stay healthy and energetic", factor: 1 },
];

const WAKE = ["05:30", "06:00", "06:30", "07:00", "07:30", "08:00"];
const GYM = ["06:00", "07:00", "17:00", "18:00", "19:00", "20:00"];
const BACK = ["07:30", "08:30", "19:00", "20:00", "21:10", "22:00"];
const BED = ["21:30", "22:00", "22:30", "23:00", "23:30", "00:00"];

const EVENT = "fittrack:setup";

/** Open the setup guide from anywhere (e.g. Settings). */
export function openSetupWizard() {
  window.dispatchEvent(new Event(EVENT));
}

function storedState() {
  try {
    return localStorage.getItem(WIZARD_KEY);
  } catch {
    return "done";
  }
}

function setStored(v: "done" | "skipped") {
  try {
    localStorage.setItem(WIZARD_KEY, v);
  } catch {
    /* storage unavailable */
  }
}

/** First-run guide. Shows once when age/sex, an AI key or routines are missing; resumable from Settings. */
export function SetupWizard() {
  const { data: profile, mutate } = useProfile();
  const { data: providers } = useProviders();
  const { data: presets } = usePresets("workout");
  const revalidate = useRevalidateTracking();
  const revalidatePrefix = useRevalidatePrefix();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [goalKey, setGoalKey] = useState<string | null>(null);
  const [usesPowder, setUsesPowder] = useState<boolean | null>(null);
  const [aiKey, setAiKey] = useState("");
  const [saving, setSaving] = useState(false);

  // Auto-open once, if something important is missing.
  useEffect(() => {
    if (!profile || !providers || !presets || storedState()) return;
    const needs = profile.age === null || profile.sex === null || !providers.some((p) => p.requires_key && p.has_key) || presets.length === 0;
    if (needs) setOpen(true);
  }, [profile, providers, presets]);

  useEffect(() => {
    const onOpen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open || !profile) return;
    setDraft({
      age: profile.age,
      sex: profile.sex,
      height_cm: profile.height_cm,
      current_weight_kg: profile.current_weight_kg,
      target_weight_kg: profile.target_weight_kg,
      goal: profile.goal,
      wake_time: profile.wake_time,
      gym_start_time: profile.gym_start_time,
      gym_return_time: profile.gym_return_time,
      bedtime: profile.bedtime,
      protein_supplement_name: profile.protein_supplement_name,
      protein_per_scoop_g: profile.protein_per_scoop_g,
      calories_per_scoop: profile.calories_per_scoop,
      scoop_size_g: profile.scoop_size_g,
    });
    setUsesPowder(profile.protein_per_scoop_g ? true : null);
  }, [open, profile]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const gemini = providers?.find((p) => p.id === "gemini");

  const saveProfile = async (fields: (keyof Profile)[]) => {
    const body = Object.fromEntries(fields.map((f) => [f, draft[f] ?? null]));
    await api.put<Profile>("/api/profile", body);
  };

  const next = async () => {
    setSaving(true);
    try {
      if (step === 0) await saveProfile(["age", "sex", "height_cm", "current_weight_kg"]);
      if (step === 1) await saveProfile(["goal", "target_weight_kg"]);
      if (step === 2) await saveProfile(["wake_time", "gym_start_time", "gym_return_time", "bedtime"]);
      if (step === 3 && usesPowder) await saveProfile(["protein_supplement_name", "protein_per_scoop_g", "calories_per_scoop", "scoop_size_g"]);
      if (step === 4 && aiKey.trim()) {
        await api.put("/api/ai/providers/gemini", { api_key: aiKey.trim(), enabled: true });
        notify.success("Google Gemini connected", "Meal photos will now be analysed with AI.");
        revalidatePrefix("/api/ai");
      }
      mutate();
      revalidate();
      if (step < STEPS.length - 1) setStep(step + 1);
      else finish("done");
    } catch (err) {
      notify.error(err, "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const finish = (how: "done" | "skipped") => {
    setStored(how);
    setOpen(false);
    if (how === "done") notify.success("You're all set", "Tip: the green “+ Log” button logs anything in one or two taps.");
  };

  const weight = draft.current_weight_kg ?? 70;
  const last = step === STEPS.length - 1;

  return (
    <Modal
      open={open}
      onClose={() => finish("skipped")}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Sparkles className="h-4 w-4" />
          </span>
          Quick setup · {STEPS[step]}
        </span>
      }
      description={`Step ${step + 1} of ${STEPS.length} · about 2 minutes · you can change everything later`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" className="min-h-[44px]" onClick={() => finish("skipped")}>
            Skip setup
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" className="min-h-[44px]" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            <Button className="min-h-[44px]" onClick={next} loading={saving}>
              {last ? (
                <>
                  <Check className="h-4 w-4" /> {aiKey.trim() ? "Save & finish" : "Finish"}
                </>
              ) : (
                <>
                  Next <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      }
    >
      <ol className="mb-6 flex items-start" aria-label="Progress">
        {STEPS.map((s, i) => {
          const Icon = STEP_ICONS[i];
          const done = i < step;
          const current = i === step;
          return (
            <li key={s} className="relative flex flex-1 flex-col items-center gap-1.5 text-center" aria-current={current ? "step" : undefined}>
              {i > 0 && <span className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", i <= step ? "bg-brand-500" : "bg-slate-200")} aria-hidden />}
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  done && "border-navy bg-navy text-white",
                  current && "border-brand-500 bg-card text-brand-600 shadow-sm ring-4 ring-brand-500/15",
                  !done && !current && "border-line bg-card text-slate-400",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span className={cn("hidden text-[11px] font-medium sm:block", current ? "text-slate-900" : "text-slate-500")}>{s}</span>
              <span className="sr-only">
                {s}
                {done ? " (done)" : current ? " (current step)" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <div key={step} className="fade-up">
        {step === 0 && (
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-2xl bg-hero p-5 text-white">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" aria-hidden />
              <p className="relative text-lg font-semibold">
                Welcome to FitTrack <span aria-hidden>👋</span>
              </p>
              <p className="relative mt-1 max-w-md text-sm text-white/85">Five quick steps and the app can work out your calories, protein and the best times to eat. Nothing here is final.</p>
            </div>
            <p className="text-sm text-slate-600">These four numbers let the app work out how many calories you burn each day.</p>
            <div className="divide-y divide-line rounded-2xl border border-line">
              <Row label="Age">
                <Stepper value={draft.age ?? null} fallback={30} min={14} max={99} unit="yrs" label="age" onChange={(v) => set("age", v)} />
              </Row>
              <Row label="Sex (for the calorie formula)">
                <Pills
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ]}
                  value={draft.sex ?? null}
                  onChange={(v) => set("sex", v)}
                  ariaLabel="Sex"
                />
              </Row>
              <Row label="Height" hint={draft.height_cm ? `≈ ${Math.floor(draft.height_cm / 30.48)}′${Math.round((draft.height_cm / 2.54) % 12)}″` : undefined}>
                <Stepper value={draft.height_cm ?? null} fallback={170} min={120} max={230} unit="cm" label="height" onChange={(v) => set("height_cm", v)} />
              </Row>
              <Row label="Weight today">
                <Stepper value={draft.current_weight_kg ?? null} fallback={70} min={30} max={300} step={0.5} unit="kg" label="weight" format={(v) => fmt(v, 1)} onChange={(v) => set("current_weight_kg", v)} />
              </Row>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">What matters most to you right now?</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {GOALS.map((g) => {
                const active = goalKey === g.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setGoalKey(g.key);
                      set("goal", g.goal);
                      set("target_weight_kg", Math.round(weight * g.factor));
                    }}
                    className={cn(
                      "lift relative min-h-[112px] rounded-2xl border p-4 text-left",
                      active ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/25" : "border-line bg-card hover:border-slate-300",
                    )}
                  >
                    {active && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-navy text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <span className="text-3xl" aria-hidden>
                      {g.emoji}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-slate-900">{g.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{g.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-2xl border border-line">
              <Row label="Target weight" hint={goalKey === "lose" ? "Suggested: about 10% below today — a realistic first goal. Adjust if you like." : "You can change this any time."}>
                <Stepper value={draft.target_weight_kg ?? null} fallback={Math.round(weight)} min={30} max={300} step={0.5} unit="kg" label="target weight" format={(v) => fmt(v, 1)} onChange={(v) => set("target_weight_kg", v)} />
              </Row>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">Used to remind you when to eat and to keep late meals light before bed.</p>
            <TimeChips icon={<Sunrise className="h-4 w-4" />} label="I usually wake up at" options={WAKE} value={draft.wake_time ?? null} onChange={(v) => set("wake_time", v)} />
            <TimeChips icon={<Dumbbell className="h-4 w-4" />} label="I start training at" options={GYM} value={draft.gym_start_time ?? null} onChange={(v) => set("gym_start_time", v)} />
            <TimeChips icon={<Home className="h-4 w-4" />} label="I'm back home at" options={BACK} value={draft.gym_return_time ?? null} onChange={(v) => set("gym_return_time", v)} />
            <TimeChips icon={<Moon className="h-4 w-4" />} label="I go to bed at" options={BED} value={draft.bedtime ?? null} onChange={(v) => set("bedtime", v)} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Save your powder once and a scoop is one tap from then on.</p>
            <Pills
              options={[
                { value: "yes", label: "I use protein powder" },
                { value: "no", label: "I don't use one" },
              ]}
              value={usesPowder === null ? null : usesPowder ? "yes" : "no"}
              onChange={(v) => setUsesPowder(v === "yes")}
              ariaLabel="Protein powder"
            />
            {usesPowder && (
              <div className="fade-up space-y-1 rounded-2xl border border-line bg-slate-50/60 p-4">
                <p className="pb-2 text-xs text-slate-500">Copy these from the nutrition label on your tub, per scoop.</p>
                <Input value={draft.protein_supplement_name ?? ""} onChange={(e) => set("protein_supplement_name", e.target.value || null)} placeholder="Name, e.g. MuscleBlaze Biozyme Whey" aria-label="Protein powder name" className="h-11" />
                <div className="divide-y divide-line">
                  <Row label="Protein per scoop" flush>
                    <Stepper value={draft.protein_per_scoop_g ?? null} fallback={24} min={0} max={60} step={0.5} unit="g" label="protein per scoop" format={(v) => fmt(v, 1)} onChange={(v) => set("protein_per_scoop_g", v)} />
                  </Row>
                  <Row label="Calories per scoop" flush>
                    <Stepper value={draft.calories_per_scoop ?? null} fallback={120} min={0} max={500} step={5} unit="kcal" label="calories per scoop" onChange={(v) => set("calories_per_scoop", v)} />
                  </Row>
                  <Row label="Scoop size" flush>
                    <Stepper value={draft.scoop_size_g ?? null} fallback={33} min={5} max={100} unit="g" label="scoop size" onChange={(v) => set("scoop_size_g", v)} />
                  </Row>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Optional. Everything works without AI. A <b className="text-slate-900">free</b> Google key makes meal-photo analysis much better — no credit card needed.
            </p>
            {gemini?.has_key ? (
              <p className="flex items-center gap-2.5 rounded-2xl border border-good-border bg-good-bg px-4 py-3 text-sm font-medium text-good-fg">
                <Check className="h-4 w-4" /> Google Gemini is already connected.
              </p>
            ) : (
              <>
                <ol className="space-y-3 text-sm text-slate-700">
                  <AiStep n={1}>
                    Open Google AI Studio and sign in with your Google account.{" "}
                    <a href={gemini?.key_url ?? "https://aistudio.google.com/apikey"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-brand-600 hover:underline">
                      Open it <ExternalLink className="h-3 w-3" />
                    </a>
                  </AiStep>
                  <AiStep n={2}>
                    Tap <b>“Create API key”</b> and copy it.
                  </AiStep>
                  <AiStep n={3}>Paste it here:</AiStep>
                </ol>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input type="password" autoComplete="off" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder="Paste your Google key (starts with AIza…)" aria-label="Google Gemini API key" className="h-11 pl-9" />
                </div>
                <p className="text-xs text-slate-500">Saved encrypted on your own server. Prefer no AI? Just press Finish — the app uses on-device ML only.</p>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, hint, flush, children }: { label: string; hint?: string; flush?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", flush ? "py-3" : "px-4 py-3")}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function AiStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white">{n}</span>
      <span className="min-w-0 pt-1 leading-relaxed">{children}</span>
    </li>
  );
}

function TimeChips({ icon, label, options, value, onChange }: { icon: React.ReactNode; label: string; options: string[]; value: string | null; onChange: (v: string) => void }) {
  const custom = value && !options.includes(value);
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Pills options={options.map((o) => ({ value: o, label: o }))} value={value} onChange={onChange} ariaLabel={label} />
        <input
          type="time"
          value={custom ? value : ""}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label={`${label} (other time)`}
          className={cn(
            "h-11 rounded-xl border bg-card px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
            custom ? "border-navy ring-2 ring-brand-500/20" : "border-line",
          )}
        />
      </div>
    </div>
  );
}
