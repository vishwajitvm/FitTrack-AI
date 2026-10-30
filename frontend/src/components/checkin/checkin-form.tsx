"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, Angry, Annoyed, BatteryMedium, BedDouble, Brain, CheckCircle2, ChevronDown, Droplets, Footprints, Frown, Gauge, History, Laugh, Meh, Moon, Save, Scale, Smile, Sunrise, Wind } from "lucide-react";
import { usePrefs } from "@/components/layout/prefs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { type Accent } from "@/components/ui/fx";
import { Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { Stepper } from "@/components/ui/touch";
import type { GlossaryKey } from "@/config/glossary";
import { BLOATING_OPTIONS, MUSCLE_GROUPS } from "@/config/constants";
import { useDaily } from "@/hooks/use-daily";
import { useProfile } from "@/hooks/use-profile";
import { api } from "@/lib/api";
import { addDays, fmt } from "@/lib/format";
import { withToast } from "@/lib/notify";
import type { BloatingStatus, CheckIn, DailySummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChoiceChips, FaceScale, FormSection, NumberScale, Question, ToggleChip, type FaceOption } from "./controls";

type Scale = "readiness_score" | "energy_level" | "sleep_quality" | "mood" | "stress";

/** Five faces mapped onto the 1–10 scale the backend stores. */
const FACES: FaceOption[] = [
  { value: 2, title: "Very bad", Icon: Frown },
  { value: 4, title: "Bad", Icon: Annoyed },
  { value: 6, title: "OK", Icon: Meh },
  { value: 8, title: "Good", Icon: Smile },
  { value: 10, title: "Great", Icon: Laugh },
];
/** Stress is the other way round: a calm face is a low number. */
const STRESS_FACES: FaceOption[] = [
  { value: 2, title: "Calm", Icon: Smile },
  { value: 4, title: "A little", Icon: Meh },
  { value: 6, title: "Some", Icon: Annoyed },
  { value: 8, title: "High", Icon: Frown },
  { value: 10, title: "Very high", Icon: Angry },
];
const snapToFace = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.min(10, Math.max(2, Math.round(v / 2) * 2)));

const BLOAT_DOT: Record<BloatingStatus, string> = { none: "bg-good-fg", mild: "bg-warn-fg/60", moderate: "bg-warn-fg", severe: "bg-crit-fg" };

interface CheckInFormProps {
  date: string;
  summary: DailySummary | undefined;
  onSaved: () => void;
}

interface State {
  morning_weight: number | null;
  sleep_hours: number | null;
  steps: number | null;
  water_ml: number | null;
  readiness_score: number | null;
  energy_level: number | null;
  sleep_quality: number | null;
  mood: number | null;
  stress: number | null;
  bloating_status: BloatingStatus | null;
  soreness_muscles: string[];
  soreness_notes: string;
  notes: string;
}

/** ~10-second morning check-in: faces, chips and steppers, prefilled from yesterday. */
export function CheckInForm({ date, summary, onSaved }: CheckInFormProps) {
  const { simple, t } = usePrefs();
  const { data: yesterday } = useDaily(addDays(date, -1));
  const { data: profile } = useProfile();
  const [s, setS] = useState<State | null>(null);
  const [fromYesterday, setFromYesterday] = useState(false);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);

  const y = yesterday?.summary;
  const hasToday = useMemo(() => !!summary && [summary.energy_level, summary.sleep_hours, summary.morning_weight, summary.mood].some((v) => v !== null), [summary]);

  useEffect(() => {
    if (!summary) return;
    const src = hasToday ? summary : y;
    setFromYesterday(!hasToday && !!y);
    setS({
      morning_weight: summary.morning_weight ?? y?.morning_weight ?? profile?.current_weight_kg ?? null,
      sleep_hours: src?.sleep_hours ?? 7,
      steps: summary.steps ?? null,
      water_ml: summary.water_ml ?? null,
      readiness_score: src?.readiness_score ?? null,
      energy_level: src?.energy_level ?? null,
      sleep_quality: src?.sleep_quality ?? null,
      mood: src?.mood ?? null,
      stress: src?.stress ?? null,
      bloating_status: summary.bloating_status ?? null,
      soreness_muscles: summary.soreness_muscles ?? [],
      soreness_notes: summary.soreness_notes ?? "",
      notes: summary.notes ?? "",
    });
    // Re-initialise only when the day or its saved data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, date, y?.date]);

  if (!s) return null;
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => (p ? { ...p, [k]: v } : p));

  const save = async () => {
    const body: CheckIn = {
      morning_weight: s.morning_weight,
      sleep_hours: s.sleep_hours,
      steps: s.steps,
      water_ml: s.water_ml,
      readiness_score: s.readiness_score,
      energy_level: s.energy_level,
      sleep_quality: s.sleep_quality,
      mood: s.mood,
      stress: s.stress,
      bloating_status: s.bloating_status,
      soreness_muscles: s.soreness_muscles,
      soreness_notes: s.soreness_notes || null,
      notes: s.notes || null,
    };
    setSaving(true);
    const ok = await withToast(() => api.put(`/api/daily/${date}/checkin`, body), "Check-in saved");
    setSaving(false);
    if (ok) {
      setFromYesterday(false);
      onSaved();
    }
  };

  // Progress through the core questions (display only).
  const core = [s.morning_weight, s.sleep_hours, s.sleep_quality, s.energy_level, s.mood, s.stress, s.bloating_status];
  const answered = core.filter((v) => v !== null).length;
  const complete = answered === core.length;

  const answerOf = (k: Scale, faces: FaceOption[]) => {
    const v = s[k];
    if (v === null) return null;
    return simple ? (faces.find((f) => f.value === snapToFace(v))?.title ?? null) : `${v}/10`;
  };

  const scale = (k: Scale, label: string, info: GlossaryKey, icon: ReactNode, faces = FACES, accent: Accent = "sleep") => (
    <Question icon={icon} accent={accent} label={label} info={info} answer={answerOf(k, faces)}>
      {simple ? (
        <FaceScale options={faces} value={snapToFace(s[k])} onChange={(v) => set(k, v)} accent={accent} ariaLabel={label} />
      ) : (
        <NumberScale value={s[k]} onChange={(v) => set(k, v)} accent={accent} ariaLabel={label} />
      )}
    </Question>
  );

  return (
    <Card className="fade-up">
      <CardHeader
        title="Morning check-in"
        icon={<Sunrise className="h-4 w-4" />}
        description={t("About 10 seconds. Tap what fits — it shapes today's training plan.", "Drives readiness, auto-regulated training and the gut-health engine.")}
        action={
          <span className={cn("num inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", complete ? "bg-good-bg text-good-fg" : "bg-slate-100 text-slate-600")}>
            {complete && <CheckCircle2 className="h-3.5 w-3.5" />}
            {answered}/{core.length}
          </span>
        }
      />
      <CardBody className="space-y-7">
        <div className="space-y-2">
          <Progress value={answered} max={core.length} className="h-1.5" barClassName={complete ? "bg-good-fg" : "bg-brand-500"} />
          {fromYesterday && (
            <p className="flex items-start gap-2 rounded-xl border border-info-border bg-info-bg px-3 py-2 text-xs leading-relaxed text-info-fg">
              <History className="mt-px h-3.5 w-3.5 shrink-0" />
              Filled in from yesterday — change anything that&apos;s different and press Save.
            </p>
          )}
        </div>

        <FormSection title="Body" hint="Weigh in after the bathroom, before food">
          <div className="grid gap-5 sm:grid-cols-2">
            <Question icon={<Scale className="h-4 w-4" />} accent="weight" label="Weight" info="morning_weight">
              <Stepper value={s.morning_weight} fallback={profile?.current_weight_kg ?? 70} step={0.1} min={30} max={300} unit="kg" label="weight" format={(v) => fmt(v, 1)} onChange={(v) => set("morning_weight", v)} />
            </Question>
            <Question icon={<BedDouble className="h-4 w-4" />} accent="sleep" label="Hours slept" info="sleep_quality">
              <Stepper value={s.sleep_hours} fallback={7} step={0.5} min={0} max={14} unit="h" label="sleep hours" format={(v) => fmt(v, v % 1 ? 1 : 0)} onChange={(v) => set("sleep_hours", v)} />
            </Question>
          </div>
        </FormSection>

        <FormSection title="How you feel" hint={simple ? "Tap a face" : "1 = worst, 10 = best"}>
          {scale("sleep_quality", "How well did you sleep?", "sleep_quality", <Moon className="h-4 w-4" />)}
          {scale("energy_level", "Energy right now", "checkin_energy", <BatteryMedium className="h-4 w-4" />)}
          {scale("mood", "Mood", "mood", <Smile className="h-4 w-4" />)}
          {scale("stress", "Stress", "stress", <Brain className="h-4 w-4" />, STRESS_FACES)}
        </FormSection>

        <FormSection title="Gut & muscles">
          <Question icon={<Wind className="h-4 w-4" />} accent="balance" label="Bloated?" info="bloating" answer={s.bloating_status ? BLOATING_OPTIONS.find((o) => o.value === s.bloating_status)?.label : null}>
            <ChoiceChips options={BLOATING_OPTIONS} value={s.bloating_status} onChange={(v) => set("bloating_status", v)} ariaLabel="Bloating" dot={(v) => BLOAT_DOT[v]} />
          </Question>
          <Question
            icon={<Activity className="h-4 w-4" />}
            accent="burn"
            label="Sore anywhere?"
            info="soreness"
            answer={s.soreness_muscles.length ? `${s.soreness_muscles.length} area${s.soreness_muscles.length === 1 ? "" : "s"}` : "None"}
          >
            <div className="flex flex-wrap gap-2">
              {MUSCLE_GROUPS.map((m) => (
                <ToggleChip key={m} active={s.soreness_muscles.includes(m)} onClick={() => set("soreness_muscles", s.soreness_muscles.includes(m) ? s.soreness_muscles.filter((x) => x !== m) : [...s.soreness_muscles, m])}>
                  {m}
                </ToggleChip>
              ))}
            </div>
          </Question>
        </FormSection>

        <div className="rounded-2xl border border-line">
          <button
            type="button"
            onClick={() => setMore((o) => !o)}
            aria-expanded={more}
            className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-2xl px-4 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span>{more ? "Less" : "More (steps, water, notes)"}</span>
            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", more && "rotate-180")} />
          </button>
          {more && (
            <div className="fade-up space-y-6 border-t border-line p-4">
              <div className="grid gap-5 sm:grid-cols-2">
                <Question icon={<Footprints className="h-4 w-4" />} accent="water" label="Steps yesterday" info="steps">
                  <Stepper value={s.steps} fallback={6000} step={500} min={0} max={60000} label="steps" format={(v) => fmt(v)} onChange={(v) => set("steps", v)} />
                </Question>
                <Question icon={<Droplets className="h-4 w-4" />} accent="water" label="Water so far" info="water">
                  <Stepper value={s.water_ml} fallback={0} step={250} min={0} max={8000} unit="ml" label="water" format={(v) => fmt(v)} onChange={(v) => set("water_ml", v)} />
                </Question>
              </div>
              {scale("readiness_score", t("Ready to train? (your gut feeling)", "Readiness (1 = wrecked, 10 = ready to PR)"), "checkin_readiness", <Gauge className="h-4 w-4" />)}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Soreness notes">
                  <Textarea rows={2} value={s.soreness_notes} onChange={(e) => set("soreness_notes", e.target.value)} />
                </Field>
                <Field label="Other notes">
                  <Textarea rows={2} value={s.notes} onChange={(e) => set("notes", e.target.value)} />
                </Field>
              </div>
            </div>
          )}
        </div>
      </CardBody>
      <CardFooter className="flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-[13px] text-slate-500 sm:text-left">
          {complete ? "All set — save to update today's plan." : `${answered} of ${core.length} answered · skip anything you're unsure about`}
        </p>
        <Button size="lg" className="w-full sm:w-auto" onClick={save} loading={saving}>
          <Save className="h-4 w-4" /> Save check-in
        </Button>
      </CardFooter>
    </Card>
  );
}
