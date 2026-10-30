import { useCallback } from "react";
import { api } from "@/lib/api";
import { fmt, nowTime, today } from "@/lib/format";
import { guessMeal } from "@/lib/meal-time";
import { notify, notifyUndo, undoEntries } from "@/lib/notify";
import type { AppliedEntries, FoodLog, MealType, NutritionHit, Preset, Profile, QuickPick, WorkoutPayload, MealPayload } from "@/lib/types";
import { scaleTo } from "@/lib/serving";
import { useRevalidateTracking } from "./use-revalidate";

const r1 = (n: number) => Math.round(n * 10) / 10;

interface When {
  date?: string;
  time?: string;
}

/**
 * One-tap logging actions. Every action shows a toast with "Undo" and refreshes all daily data.
 * Each returns the created ids (or undefined on failure — the error toast is already shown).
 */
export function useQuickActions() {
  const revalidate = useRevalidateTracking();

  const logPick = useCallback(
    async (pick: QuickPick, opts: When & { meal_type?: MealType; scale?: number } = {}) => {
      const k = opts.scale ?? 1;
      try {
        const created = await api.post<FoodLog>("/api/food", {
          date: opts.date ?? today(),
          time: opts.time ?? nowTime(),
          meal_type: opts.meal_type ?? pick.meal_type,
          food_name: pick.food_name,
          ingredients: pick.ingredients ?? [],
          quantity: pick.quantity !== null ? r1(pick.quantity * k) : k,
          portion_unit: pick.portion_unit,
          weight_grams: pick.weight_grams !== null ? r1(pick.weight_grams * k) : null,
          calories: Math.round(pick.calories * k),
          protein: r1(pick.protein * k),
          carbs: r1(pick.carbs * k),
          fat: r1(pick.fat * k),
          fibre: r1(pick.fibre * k),
          calories_low: null,
          calories_high: null,
          confidence_score: 0.95,
          research_source: "Quick pick (your history)",
          tags: pick.tags ?? [],
          notes: null,
        });
        revalidate();
        notifyUndo(`Added ${pick.food_name}${k !== 1 ? ` ×${k}` : ""}`, `${fmt(pick.calories * k)} kcal · ${fmt(pick.protein * k, 1)} g protein`, () => undoEntries({ food_ids: [created.id] }), revalidate);
        return created;
      } catch (err) {
        notify.error(err, "Could not add it");
        return undefined;
      }
    },
    [revalidate],
  );

  /** Logs `grams` of a nutrition-database food (from search). `quantity`/`unit` describe the portion in words. */
  const logFoodHit = useCallback(
    async (hit: NutritionHit, grams: number, opts: When & { meal_type: MealType; quantity: number; unit: string | null }) => {
      const m = scaleTo(hit.per_100g as unknown as Record<string, number>, grams);
      try {
        const created = await api.post<FoodLog>("/api/food", {
          date: opts.date ?? today(),
          time: opts.time ?? nowTime(),
          meal_type: opts.meal_type,
          food_name: hit.name,
          ingredients: [],
          quantity: opts.unit ? r1(opts.quantity) : Math.round(grams),
          portion_unit: opts.unit ?? "g",
          weight_grams: Math.round(grams),
          calories: Math.round(m.calories ?? 0),
          protein: r1(m.protein ?? 0),
          carbs: r1(m.carbs ?? 0),
          fat: r1(m.fat ?? 0),
          fibre: r1(m.fibre ?? 0),
          calories_low: null,
          calories_high: null,
          confidence_score: hit.confidence ?? 0.8,
          research_source: `Search: ${hit.source}`,
          tags: [],
          notes: null,
        });
        revalidate();
        notifyUndo(`Added ${hit.name}`, `${fmt(m.calories ?? 0)} kcal · ${fmt(m.protein ?? 0, 1)} g protein`, () => undoEntries({ food_ids: [created.id] }), revalidate);
        return created;
      } catch (err) {
        notify.error(err, "Could not add it");
        return undefined;
      }
    },
    [revalidate],
  );

  const applyPreset = useCallback(
    async (preset: Pick<Preset, "id" | "name">, opts: When & { payload?: WorkoutPayload | MealPayload; scale?: number } = {}) => {
      try {
        const res = await api.post<AppliedEntries>(`/api/presets/${preset.id}/apply`, {
          date: opts.date ?? today(),
          time: opts.time ?? nowTime(),
          payload: opts.payload,
          scale: opts.scale,
        });
        revalidate();
        notifyUndo(`Logged "${preset.name}"`, res.summary, () => undoEntries(res), revalidate);
        return res;
      } catch (err) {
        notify.error(err, `Could not log "${preset.name}"`);
        return undefined;
      }
    },
    [revalidate],
  );

  const copyDay = useCallback(
    async (opts: { from_date: string; to_date: string; include: ("food" | "workouts")[]; meal_types?: string[]; label: string }) => {
      try {
        const res = await api.post<AppliedEntries>("/api/days/copy", {
          from_date: opts.from_date,
          to_date: opts.to_date,
          include: opts.include,
          meal_types: opts.meal_types,
        });
        revalidate();
        const count = res.food_ids.length + res.workout_log_ids.length + res.session_ids.length;
        if (!count) {
          notify.info("Nothing to copy", "That day has no matching entries.");
          return res;
        }
        notifyUndo(opts.label, res.summary, () => undoEntries(res), revalidate);
        return res;
      } catch (err) {
        notify.error(err, "Could not copy");
        return undefined;
      }
    },
    [revalidate],
  );

  /** n scoops of the profile's protein powder. */
  const logScoops = useCallback(
    async (profile: Profile, n: number, opts: When & { meal_type?: MealType } = {}) => {
      const per = profile.protein_per_scoop_g ?? 0;
      const name = profile.protein_supplement_name || "Protein powder";
      const time = opts.time ?? nowTime();
      try {
        const created = await api.post<FoodLog>("/api/food", {
          date: opts.date ?? today(),
          time,
          meal_type: opts.meal_type ?? guessMeal(time),
          food_name: `${name} (${n} scoop${n > 1 ? "s" : ""})`,
          ingredients: [],
          quantity: n,
          portion_unit: "scoop",
          weight_grams: profile.scoop_size_g ? r1(profile.scoop_size_g * n) : null,
          calories: Math.round((profile.calories_per_scoop ?? 0) * n),
          protein: r1(per * n),
          carbs: r1((profile.carbs_per_scoop_g ?? 0) * n),
          fat: r1((profile.fat_per_scoop_g ?? 0) * n),
          fibre: 0,
          calories_low: null,
          calories_high: null,
          confidence_score: 1,
          research_source: "Your protein powder (Profile)",
          tags: profile.protein_supplement_type === "whey_concentrate" || profile.protein_supplement_type === "casein" ? ["whey", "lactose"] : ["whey"],
          notes: null,
        });
        revalidate();
        notifyUndo(`${n} scoop${n > 1 ? "s" : ""} logged`, `+${fmt(per * n, 1)} g protein · ${fmt((profile.calories_per_scoop ?? 0) * n)} kcal`, () => undoEntries({ food_ids: [created.id] }), revalidate);
        return created;
      } catch (err) {
        notify.error(err, "Could not log the scoop");
        return undefined;
      }
    },
    [revalidate],
  );

  return { logPick, logFoodHit, applyPreset, copyDay, logScoops, revalidate };
}
