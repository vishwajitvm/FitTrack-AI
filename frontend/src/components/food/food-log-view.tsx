"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Plus, Sparkles, Utensils } from "lucide-react";
import { StickyDateNav } from "@/components/common/date-nav";
import { PresetsManager } from "@/components/presets/presets-manager";
import { MealQuickPanel } from "@/components/quick-log/meal-quick-panel";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { usePrefs } from "@/components/layout/prefs-provider";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { MEAL_TYPES } from "@/config/constants";
import { useFood } from "@/hooks/use-food";
import { useProfileMetrics } from "@/hooks/use-profile";
import { useRevalidatePrefix, useRevalidateTracking } from "@/hooks/use-revalidate";
import { api } from "@/lib/api";
import { fmt, humanize, today } from "@/lib/format";
import { askText, confirmDelete, withToast } from "@/lib/notify";
import type { FoodLog, MealType } from "@/lib/types";
import { DaySummary } from "./day-summary";
import { FoodFormModal } from "./food-form-modal";
import { MealGroup } from "./meal-group";
import { QuickAddText } from "./quick-add-text";
import { ScoopButton } from "./scoop-button";

export function FoodLogView() {
  const [date, setDate] = useState(today);
  const { data, error, isLoading, mutate } = useFood(date);
  // Read-only: daily targets for the summary rings (null while biometrics are pending).
  const { data: metrics } = useProfileMetrics();
  const revalidate = useRevalidateTracking();
  const revalidatePrefix = useRevalidatePrefix();
  const { t } = usePrefs();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FoodLog | null>(null);

  const totals = (data ?? []).reduce(
    (a, f) => ({ kcal: a.kcal + f.calories, p: a.p + f.protein, c: a.c + f.carbs, f: a.f + f.fat, fib: a.fib + f.fibre }),
    { kcal: 0, p: 0, c: 0, f: 0, fib: 0 },
  );

  const groups = MEAL_TYPES.map((m) => ({ meal: m.value, items: (data ?? []).filter((f) => f.meal_type === m.value) })).filter((g) => g.items.length);

  const remove = async (item: FoodLog) => {
    if (!(await confirmDelete(`"${item.food_name}"`))) return;
    await withToast(() => api.del(`/api/food/${item.id}`), "Entry deleted");
    revalidate();
  };

  const savePreset = async (meal: MealType) => {
    const name = await askText("Save this meal", { label: "Next time it's one tap.", value: `My usual ${humanize(meal).toLowerCase()}`, confirmText: "Save meal" });
    if (!name) return;
    const icon = meal === "breakfast" ? "🍳" : meal === "lunch" ? "🍛" : meal === "dinner" ? "🍚" : meal === "post_workout" ? "🥛" : "🥪";
    const ok = await withToast(() => api.post("/api/presets/from-day", { kind: "meal", date, name, meal_type: meal, icon }), `Saved "${name}"`);
    if (ok) revalidatePrefix("/api/presets", "/api/today");
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Food log"
        page="food"
        description="Everything you ate, grouped by meal. Photo entries keep their calorie range and confidence."
        actions={
          <>
            <ScoopButton date={date} />
            <Link href="/food/scan">
              <Button variant="outline" className="min-h-[44px]">
                <Camera className="h-4 w-4" /> Snap a meal
              </Button>
            </Link>
            <Button className="min-h-[44px]" onClick={openNew}>
              <Plus className="h-4 w-4" /> {t("Add by hand", "Add food manually")}
            </Button>
          </>
        }
      />
      <StickyDateNav value={date} onChange={setDate} />

      <DaySummary
        totals={totals}
        kcalLabel={t("Eaten", "Calories")}
        itemCount={data?.length ?? 0}
        mealCount={groups.length}
        calorieTarget={metrics?.calorie_target ?? null}
        proteinTarget={metrics?.protein_target_g?.target ?? null}
      />

      <Card className="fade-up mb-5" style={{ animationDelay: "60ms" }}>
        <CardHeader title="Add what you usually eat" description="Tap once to add · hold for a different portion" icon={<Sparkles className="h-4 w-4" />} />
        <CardBody>
          <MealQuickPanel key={date} date={date} />
        </CardBody>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-5">
        <div className="fade-up xl:order-2 xl:col-span-2" style={{ animationDelay: "120ms" }}>
          <QuickAddText date={date} onSaved={revalidate} />
        </div>

        <CollapsibleSection
          id="meals"
          title="Meals"
          className="xl:order-1 xl:col-span-3"
          bodyClassName="space-y-4 pt-4"
          description={
            data && data.length > 0 ? (
              <span className="num">
                {data.length} item{data.length === 1 ? "" : "s"} · {fmt(totals.kcal)} kcal
              </span>
            ) : undefined
          }
        >

          {error && <ErrorState error={error} onRetry={() => mutate()} />}
          {isLoading && <ListSkeleton rows={5} />}
          {data && groups.length === 0 && (
            <EmptyState
              icon={<Utensils className="h-5 w-5" />}
              title="Nothing logged for this day yet"
              description="Tap a usual food above, type what you ate in plain words, or snap a photo of your plate."
              action={
                <Link href="/food/scan">
                  <Button className="min-h-[44px]">
                    <Camera className="h-4 w-4" /> Snap a meal
                  </Button>
                </Link>
              }
            />
          )}
          {groups.map((g, i) => (
            <div key={g.meal} className="fade-up" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
              <MealGroup
                mealType={g.meal}
                items={g.items}
                onEdit={(item) => {
                  setEditing(item);
                  setModalOpen(true);
                }}
                onDelete={remove}
                onSavePreset={() => savePreset(g.meal)}
              />
            </div>
          ))}
        </CollapsibleSection>
      </div>

      <div className="mt-6">
        <PresetsManager kind="meal" />
      </div>

      <FoodFormModal open={modalOpen} onClose={() => setModalOpen(false)} date={date} editing={editing} onSaved={revalidate} />
    </>
  );
}
