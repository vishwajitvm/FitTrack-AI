"use client";

import { useState } from "react";
import { Copy, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useLongPress } from "@/components/ui/touch";
import { InfoTip } from "@/components/ui/info-tip";
import { Skeleton } from "@/components/ui/misc";
import { MEAL_LABEL } from "@/config/constants";
import { useQuickActions } from "@/hooks/use-quick-actions";
import { usePresets, useQuickPicks } from "@/hooks/use-quicklog";
import { addDays, fmt, nowTime, today } from "@/lib/format";
import { guessMeal } from "@/lib/meal-time";
import type { MealType, Preset, QuickPick } from "@/lib/types";
import { FoodSearch } from "./food-search";
import { LoggedForSlot, MealTabs, TodayMealsSummary } from "./today-meals";

/** The meal slots people actually use day-to-day, in day order. */
export const QUICK_MEALS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "morning_snack", label: "Snack (AM)" },
  { value: "lunch", label: "Lunch" },
  { value: "evening_snack", label: "Snack (PM)" },
  { value: "pre_workout", label: "Pre-gym" },
  { value: "dinner", label: "Dinner" },
  { value: "post_workout", label: "Post-gym" },
];

const PORTIONS = [0.5, 1, 1.5, 2];

interface MealQuickPanelProps {
  date?: string;
  /** Called after something was logged (e.g. to close a sheet). */
  onLogged?: () => void;
  /** Meal to start on; defaults to the meal for the current time of day. */
  initialSlot?: MealType;
}

/** Tap what you usually eat: quick picks, saved meals and "copy yesterday". */
export function MealQuickPanel({ date: dateProp, onLogged, initialSlot }: MealQuickPanelProps) {
  const date = dateProp ?? today();
  const [slot, setSlot] = useState<MealType>(() => initialSlot ?? guessMeal(nowTime()));
  const { data: picks, isLoading } = useQuickPicks(slot, 12);
  const { data: presets } = usePresets("meal");
  const { logPick, applyPreset, copyDay } = useQuickActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [portionFor, setPortionFor] = useState<QuickPick | null>(null);

  const slotPresets = (presets ?? []).filter((p) => !p.meal_type || p.meal_type === slot);
  const time = date === today() ? nowTime() : undefined;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    const ok = await fn();
    setBusy(null);
    if (ok) onLogged?.();
  };

  return (
    <div className="space-y-4">
      <TodayMealsSummary date={date} slots={QUICK_MEALS} slot={slot} onSelect={(v) => { setSlot(v); setPortionFor(null); }} />
      <MealTabs date={date} slots={QUICK_MEALS} value={slot} onChange={(v) => { setSlot(v); setPortionFor(null); }} />
      <FoodSearch key={slot} date={date} time={time} slot={slot} picks={picks ?? []} onLogged={onLogged} />
      <LoggedForSlot date={date} slot={slot} />

      <section>
        <p className="mb-2.5 flex items-center gap-1 text-[13px] font-medium text-slate-700">
          You usually have <InfoTip title="Quick picks">Your most frequent foods for this meal, newest habits first. Tap to add one portion; press and hold (or right-click) to pick ½, 1½ or 2 portions.</InfoTip>
        </p>
        {isLoading && <Skeleton className="h-24 rounded-2xl" />}
        {picks && picks.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm leading-relaxed text-slate-600">
            Nothing yet for {MEAL_LABEL[slot]?.toLowerCase()}. Log it once (type it below or snap a photo) and it will appear here for one-tap next time.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {picks?.map((p) => (
            <PickChip key={p.key} pick={p} busy={busy === p.key} onTap={() => run(p.key, () => logPick(p, { date, time, meal_type: slot }))} onLong={() => setPortionFor(p)} />
          ))}
        </div>
        {portionFor && (
          <div className="fade-up mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-acc-kcal/30 bg-acc-kcal/5 p-3">
            <span className="w-full text-sm font-medium text-slate-900">How much {portionFor.food_name}?</span>
            {PORTIONS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  const p = portionFor;
                  setPortionFor(null);
                  run(p.key, () => logPick(p, { date, time, meal_type: slot, scale: k }));
                }}
                className="min-h-[52px] min-w-[64px] rounded-xl border border-line bg-card px-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-acc-kcal/40 active:scale-95"
              >
                {k === 0.5 ? "½" : k === 1.5 ? "1½" : k}×
                <span className="num block text-[11px] font-normal text-acc-kcal">{fmt(portionFor.calories * k)} kcal</span>
              </button>
            ))}
            <button type="button" onClick={() => setPortionFor(null)} className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close portions">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      {slotPresets.length > 0 && (
        <section>
          <p className="mb-2.5 text-[13px] font-medium text-slate-700">Your saved meals</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {slotPresets.slice(0, 6).map((p) => (
              <PresetCard key={p.id} preset={p} busy={busy === `preset-${p.id}`} onTap={() => run(`preset-${p.id}`, () => applyPreset(p, { date, time }))} />
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() =>
          run("copy", () =>
            copyDay({ from_date: addDays(date, -1), to_date: date, include: ["food"], meal_types: [slot], label: `Copied yesterday's ${MEAL_LABEL[slot]?.toLowerCase() ?? slot}` }),
          )
        }
        disabled={busy !== null}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 text-sm font-medium text-slate-700 transition-colors hover:border-brand-500 hover:bg-brand-50/50 hover:text-brand-700 disabled:opacity-50"
      >
        {busy === "copy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        Same {MEAL_LABEL[slot]?.toLowerCase() ?? "meal"} as yesterday
      </button>
    </div>
  );
}

function PickChip({ pick, busy, onTap, onLong }: { pick: QuickPick; busy: boolean; onTap: () => void; onLong: () => void }) {
  const handlers = useLongPress(onTap, onLong);
  return (
    <button
      type="button"
      {...handlers}
      disabled={busy}
      title="Tap to add · hold for portion size"
      className="fade-up min-h-[52px] select-none rounded-2xl border border-line bg-card px-3.5 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-acc-kcal/40 hover:bg-acc-kcal/5 hover:shadow-card active:scale-[0.98] disabled:opacity-60"
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-acc-kcal" /> : <Plus className="h-3.5 w-3.5 text-acc-kcal" />}
        {pick.food_name}
      </span>
      <span className="num block text-[11px] text-slate-500">
        {pick.quantity !== null ? `${fmt(pick.quantity, pick.quantity % 1 ? 1 : 0)} ${pick.portion_unit ?? ""} · ` : ""}
        {fmt(pick.calories)} kcal · {fmt(pick.protein, 0)} g protein
      </span>
    </button>
  );
}

export function PresetCard({ preset, busy, onTap }: { preset: Preset; busy: boolean; onTap: () => void }) {
  const s = preset.summary ?? {};
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={busy}
      className="lift flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 text-left shadow-card hover:border-brand-500/40 active:scale-[0.99] disabled:opacity-60"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl" aria-hidden>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : preset.icon || <Sparkles className="h-4 w-4 text-slate-500" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-900">{preset.name}</span>
        <span className="num block text-xs text-slate-500">
          {[s.calories != null && `${fmt(s.calories)} kcal`, s.protein != null && `${fmt(s.protein)} g protein`, s.exercises != null && `${s.exercises} exercises`, s.cardio_min ? `${fmt(s.cardio_min)} min cardio` : null, s.lifting_min ? `${fmt(s.lifting_min)} min lifting` : null]
            .filter(Boolean)
            .join(" · ") || "Tap to log"}
        </span>
      </span>
    </button>
  );
}
