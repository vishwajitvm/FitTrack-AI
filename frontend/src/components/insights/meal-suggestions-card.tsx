"use client";

import { useState, type ReactNode } from "react";
import { Beef, Check, ChefHat, Flame, Plus } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ACCENT, IconBubble, type Accent } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import { Segmented, Skeleton } from "@/components/ui/misc";
import { useMealSuggestions } from "@/hooks/use-insights";
import { useRevalidatePrefix, useRevalidateTracking } from "@/hooks/use-revalidate";
import { api } from "@/lib/api";
import { fmt, nowTime, today } from "@/lib/format";
import { MEAL_LABEL } from "@/config/constants";
import { mealForSlot } from "@/lib/meal-time";
import { slotLabel } from "@/lib/ml-insights";
import { confirmAction, notify } from "@/lib/notify";
import type { MealSlot, MealSuggestion } from "@/lib/types";
import { cn } from "@/lib/utils";

const SLOTS: { value: MealSlot; label: string }[] = [
  { value: "now", label: "Next meal" },
  { value: "dinner", label: "Dinner" },
  { value: "post_workout", label: "Post-workout" },
  { value: "snack", label: "Snack" },
];

export function MealSuggestionsCard() {
  const [slot, setSlot] = useState<MealSlot>("now");
  const date = today();
  const { data, error, isLoading, mutate } = useMealSuggestions(date, slot);
  const revalidateTracking = useRevalidateTracking();
  const revalidatePrefix = useRevalidatePrefix();
  const [logging, setLogging] = useState<number | null>(null);

  const logSuggestion = async (s: MealSuggestion, idx: number) => {
    const time = nowTime();
    const meal = mealForSlot(slot, time);
    const ok = await confirmAction({
      title: `Log "${s.title}"?`,
      text: `${s.items.length} item(s), ~${fmt(s.totals.calories)} kcal and ${fmt(s.totals.protein)} g protein will be added to ${MEAL_LABEL[meal] ?? meal} today.`,
      confirmText: "Log it",
    });
    if (!ok) return;
    setLogging(idx);
    try {
      for (const it of s.items) {
        await api.post("/api/food", {
          date,
          time,
          meal_type: meal,
          food_name: it.food,
          ingredients: [],
          quantity: it.servings,
          portion_unit: "serving",
          weight_grams: it.grams,
          calories: it.calories,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
          fibre: it.fibre,
          calories_low: null,
          calories_high: null,
          confidence_score: 0.9,
          research_source: "Meal optimizer",
          tags: [],
          notes: s.reason,
        });
      }
      notify.success("Logged", `${s.items.length} item(s) added to your food log`);
      revalidateTracking();
      revalidatePrefix("/api/insights");
    } catch (err) {
      notify.error(err, "Could not log the suggestion");
    } finally {
      setLogging(null);
    }
  };

  return (
    <Card className="fade-up">
      <CardHeader title="Meal suggestions" description="Foods that best close today's protein & calorie gap" icon={<ChefHat className="h-4 w-4" />} info="meal_optimizer" />
      <CardBody className="space-y-5">
        <Segmented options={SLOTS} value={slot} onChange={setSlot} />
        {error && <ErrorState error={error} onRetry={() => mutate()} />}
        {isLoading && (
          <div className="grid gap-3 lg:grid-cols-3">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="hidden h-56 rounded-2xl lg:block" />
            <Skeleton className="hidden h-56 rounded-2xl lg:block" />
          </div>
        )}
        {data && (
          <>
            <div className="space-y-2">
              <p className="flex items-center gap-1 text-[13px] font-medium text-slate-500">
                Remaining today <InfoTip term="remaining_macros" />
              </p>
              <div className="flex flex-wrap items-stretch gap-2">
                {data.remaining.calories !== null && <Remaining accent="kcal" icon={<Flame className="h-4 w-4" />} value={fmt(data.remaining.calories)} unit="kcal" />}
                {data.remaining.protein !== null && (
                  <Remaining
                    accent="protein"
                    icon={<Beef className="h-4 w-4" />}
                    value={fmt(data.remaining.protein)}
                    unit="g protein"
                    status={data.remaining.protein > 20 ? <Badge tone="warning">Still needed</Badge> : <Badge tone="ok">Nearly there</Badge>}
                  />
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {data.remaining.carbs !== null && <Badge tone="neutral">{fmt(data.remaining.carbs)} g carbs</Badge>}
                  {data.remaining.fat !== null && <Badge tone="neutral">{fmt(data.remaining.fat)} g fat</Badge>}
                  {data.remaining.fibre !== null && <Badge tone="neutral">{fmt(data.remaining.fibre)} g fibre</Badge>}
                </div>
              </div>
            </div>
            {data.constraints.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1 text-[13px] font-medium text-slate-500">
                  Rules applied <InfoTip term="meal_constraints" />
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.constraints.map((c) => (
                    <Badge key={c} tone="info">
                      <Check className="h-3 w-3" />
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {data.suggestions.length === 0 ? (
              <EmptyState
                icon={<ChefHat className="h-5 w-5" />}
                title={`No ${slotLabel(slot).toLowerCase()} suggestion needed`}
                description="You're close to your targets for today, or nothing in the library fits the rules."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {data.suggestions.map((s, idx) => (
                  <div key={idx} className="fade-up lift flex flex-col rounded-2xl border border-line bg-card p-4 shadow-card" style={{ animationDelay: `${idx * 60}ms` }}>
                    <p className="text-[15px] font-semibold tracking-tight text-slate-900">{s.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.reason}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="num inline-flex items-center gap-1 rounded-full bg-acc-kcal/10 px-2.5 py-0.5 text-xs font-semibold text-acc-kcal">
                        <Flame className="h-3 w-3" /> {fmt(s.totals.calories)} kcal
                      </span>
                      <span className="num inline-flex items-center gap-1 rounded-full bg-acc-protein/10 px-2.5 py-0.5 text-xs font-semibold text-acc-protein">
                        <Beef className="h-3 w-3" /> {fmt(s.totals.protein, 1)} g protein
                      </span>
                    </div>
                    <ul className="mt-3 divide-y divide-line border-y border-line text-xs">
                      {s.items.map((it, i) => (
                        <li key={i} className="flex items-start justify-between gap-2 py-2">
                          <span className="min-w-0 text-slate-800">
                            <span className="font-medium">{it.food}</span>
                            <span className="block text-[11px] text-slate-500">
                              {fmt(it.servings, it.servings % 1 ? 1 : 0)} serving · {fmt(it.grams)} g
                            </span>
                          </span>
                          <span className="num shrink-0 text-right text-slate-600">
                            {fmt(it.calories)} kcal
                            <span className="block text-[11px] text-slate-500">P {fmt(it.protein, 1)} g</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="num mb-3 mt-2 text-[11px] text-slate-500">
                      C {fmt(s.totals.carbs, 1)} · F {fmt(s.totals.fat, 1)} · Fibre {fmt(s.totals.fibre, 1)} g
                    </p>
                    <Button className="mt-auto w-full" onClick={() => logSuggestion(s, idx)} loading={logging === idx} disabled={logging !== null}>
                      <Plus className="h-4 w-4" /> Log this
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Remaining({ accent, icon, value, unit, status }: { accent: Accent; icon: ReactNode; value: string; unit: string; status?: ReactNode }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card px-3 py-2", ACCENT[accent].border)}>
      <IconBubble accent={accent} className="h-8 w-8">
        {icon}
      </IconBubble>
      <div>
        <p className="num text-lg font-semibold leading-tight text-slate-900">
          {value} <span className="text-xs font-normal text-slate-500">{unit}</span>
        </p>
        {status && <div className="mt-0.5">{status}</div>}
      </div>
    </div>
  );
}
