"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Trash2 } from "lucide-react";
import { AnimatedNumber, MetricRing } from "@/components/ui/fx";
import { Skeleton } from "@/components/ui/misc";
import { MEAL_LABEL } from "@/config/constants";
import { useDaily } from "@/hooks/use-daily";
import { useProfileMetrics } from "@/hooks/use-profile";
import { useRevalidateTracking } from "@/hooks/use-revalidate";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { confirmDelete, notify } from "@/lib/notify";
import type { DailyDetail, FoodLog, MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SlotOption {
  value: MealType;
  label: string;
}

/** kcal / protein / items logged per meal slot today. */
export function slotTotals(detail: DailyDetail | undefined) {
  const by = new Map<string, { kcal: number; protein: number; items: number }>();
  for (const f of detail?.foods ?? []) {
    const t = by.get(f.meal_type) ?? { kcal: 0, protein: 0, items: 0 };
    t.kcal += f.calories;
    t.protein += f.protein;
    t.items += 1;
    by.set(f.meal_type, t);
  }
  return by;
}

/**
 * The top of the meal sheet: today's rings (eaten vs goal, protein vs target) and a bar per meal — logged meals
 * are coloured, the selected one is outlined, tapping a bar selects that meal.
 */
export function TodayMealsSummary({ date, slots, slot, onSelect }: { date: string; slots: SlotOption[]; slot: MealType; onSelect: (s: MealType) => void }) {
  const { data: detail, isLoading } = useDaily(date);
  const { data: metrics } = useProfileMetrics();
  if (isLoading && !detail) return <Skeleton className="h-40 rounded-3xl" />;

  const totals = slotTotals(detail);
  const eaten = detail?.summary.total_calories ?? 0;
  const protein = detail?.summary.total_protein ?? 0;
  const kcalGoal = metrics?.calorie_target ?? null;
  const proteinGoal = metrics?.protein_target_g?.target ?? null;
  const logged = slots.filter((s) => totals.has(s.value)).length;
  const max = Math.max(1, ...slots.map((s) => totals.get(s.value)?.kcal ?? 0));

  return (
    <section className="rounded-3xl border border-line bg-slate-50/70 p-4">
      <div className="flex items-center gap-4">
        <MetricRing value={kcalGoal ? eaten / kcalGoal : 0} accent="kcal" size={78} stroke={8} label={`Eaten ${fmt(eaten)} kcal`}>
          <span className="text-sm font-bold leading-none text-slate-900">
            <AnimatedNumber value={eaten} />
          </span>
          <span className="text-[10px] text-slate-500">kcal</span>
        </MetricRing>
        <MetricRing value={proteinGoal ? protein / proteinGoal : 0} accent="protein" size={78} stroke={8} label={`Protein ${fmt(protein)} g`}>
          <span className="text-sm font-bold leading-none text-slate-900">
            <AnimatedNumber value={protein} />
          </span>
          <span className="text-[10px] text-slate-500">g protein</span>
        </MetricRing>
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="font-semibold text-slate-900">Today so far</p>
          <p className="num text-[13px] text-slate-600">
            {kcalGoal ? (eaten <= kcalGoal ? `${fmt(kcalGoal - eaten)} kcal left of ${fmt(kcalGoal)}` : `${fmt(eaten - kcalGoal)} kcal over ${fmt(kcalGoal)}`) : `${fmt(eaten)} kcal eaten`}
          </p>
          <p className="num text-[13px] text-slate-600">{proteinGoal ? (protein < proteinGoal ? `${fmt(proteinGoal - protein)} g protein to go` : "Protein target reached") : `${fmt(protein)} g protein`}</p>
          <p className="text-xs text-slate-500">
            {logged} of {slots.length} meals logged
          </p>
        </div>
      </div>

      {/* calories per meal; tap a bar to pick that meal */}
      <div className="mt-4 grid items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }} role="group" aria-label="Calories per meal today">
        {slots.map((s) => {
          const t = totals.get(s.value);
          const h = t ? Math.max(14, (t.kcal / max) * 64) : 6;
          const active = s.value === slot;
          return (
            <button key={s.value} type="button" onClick={() => onSelect(s.value)} className="group flex flex-col items-center gap-1" aria-label={`${s.label}: ${t ? `${fmt(t.kcal)} kcal` : "not logged"}`} aria-pressed={active}>
              <span className={cn("num text-[10px] font-medium", t ? "text-acc-kcal" : "text-slate-400")}>{t ? fmt(t.kcal) : "–"}</span>
              <span
                className={cn(
                  "w-full rounded-lg transition-all duration-500 group-hover:opacity-90",
                  t ? "bg-gradient-to-t from-acc-kcal/70 to-acc-kcal" : "bg-slate-200",
                  active && "ring-2 ring-brand-500 ring-offset-2 ring-offset-card",
                )}
                style={{ height: h }}
              />
              <span className={cn("w-full truncate text-center text-[10px]", active ? "font-semibold text-slate-900" : "text-slate-500")}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Meal tabs that show which meals are already logged today (tick + kcal). */
export function MealTabs({ date, slots, value, onChange }: { date: string; slots: SlotOption[]; value: MealType; onChange: (s: MealType) => void }) {
  const { data: detail } = useDaily(date);
  const totals = slotTotals(detail);
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div role="radiogroup" aria-label="Meal" className="flex w-max gap-2">
        {slots.map((s) => {
          const t = totals.get(s.value);
          const active = s.value === value;
          return (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(s.value)}
              className={cn(
                "flex min-h-[48px] items-center gap-2 rounded-2xl border px-3.5 text-sm font-medium transition-all active:scale-95",
                active ? "btn-3d border-transparent text-white" : t ? "border-acc-kcal/40 bg-acc-kcal/10 text-slate-900" : "border-line bg-card text-slate-700 hover:bg-slate-50",
              )}
            >
              {t && (
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", active ? "bg-white/25" : "bg-acc-kcal text-white")}>
                  <Check className="h-3 w-3" />
                </span>
              )}
              <span className="text-left leading-tight">
                {s.label}
                {t && <span className={cn("num block text-[10px] font-normal", active ? "text-white/80" : "text-acc-kcal")}>{fmt(t.kcal)} kcal</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** What is already logged for the selected meal today, with remove. */
export function LoggedForSlot({ date, slot }: { date: string; slot: MealType }) {
  const { data: detail } = useDaily(date);
  const refresh = useRevalidateTracking();
  const [busy, setBusy] = useState<number | null>(null);
  const foods = (detail?.foods ?? []).filter((f) => f.meal_type === slot);
  if (!foods.length) return null;
  const kcal = foods.reduce((n, f) => n + f.calories, 0);
  const protein = foods.reduce((n, f) => n + f.protein, 0);

  const remove = async (f: FoodLog) => {
    if (!(await confirmDelete(`"${f.food_name}"`, `Removes it from today's ${MEAL_LABEL[slot]?.toLowerCase() ?? "meal"}.`))) return;
    setBusy(f.id);
    try {
      await api.del(`/api/food/${f.id}`);
      refresh();
      notify.success(`Removed ${f.food_name}`);
    } catch (err) {
      notify.error(err, "Could not remove it");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="fade-up overflow-hidden rounded-2xl border border-good-border bg-good-bg/40">
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-good-fg">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-good-fg text-white dark:text-slate-950">
            <Check className="h-3 w-3" />
          </span>
          Already logged for {MEAL_LABEL[slot]?.toLowerCase() ?? "this meal"} today
        </p>
        <span className="num text-xs text-slate-600">
          <span className="font-semibold text-acc-kcal">{fmt(kcal)} kcal</span> · <span className="font-semibold text-acc-protein">{fmt(protein, 1)} g</span>
        </span>
      </div>
      <ul className="divide-y divide-line">
        {foods.map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-4 py-2">
            <span className="num w-11 shrink-0 text-xs text-slate-500">{f.time ?? "—"}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">{f.food_name}</span>
              <span className="num block text-xs text-slate-500">
                {f.quantity !== null ? `${fmt(f.quantity, f.quantity % 1 ? 1 : 0)} ${f.portion_unit ?? ""} · ` : ""}
                {fmt(f.calories)} kcal · {fmt(f.protein, 1)} g protein
              </span>
            </span>
            <button type="button" onClick={() => remove(f)} disabled={busy !== null} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-crit-bg hover:text-crit-fg disabled:opacity-50" aria-label={`Remove ${f.food_name}`}>
              {busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </li>
        ))}
      </ul>
      <Link href="/food" className="block px-4 pb-3 pt-1 text-xs font-medium text-brand-600 hover:underline">
        Edit portions on the Food log →
      </Link>
    </section>
  );
}
