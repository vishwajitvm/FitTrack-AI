import type { AnalysisItem } from "@/lib/types";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Rescale an item's nutrition to a new weight. Uses per-100 g data when present,
 * otherwise scales proportionally from the current weight.
 */
export function scaleItem(item: AnalysisItem, newWeight: number): AnalysisItem {
  if (!(newWeight > 0)) return { ...item, estimated_weight_g: newWeight };
  const p = item.per_100g;
  if (p) {
    const k = newWeight / 100;
    const kcal = Math.round(p.calories * k);
    const spread = item.calories > 0 && item.calories_low !== null && item.calories_high !== null ? [item.calories_low / item.calories, item.calories_high / item.calories] : [0.85, 1.15];
    return {
      ...item,
      estimated_weight_g: newWeight,
      calories: kcal,
      calories_low: Math.round(kcal * spread[0]),
      calories_high: Math.round(kcal * spread[1]),
      protein: round1(p.protein * k),
      carbs: round1(p.carbs * k),
      fat: round1(p.fat * k),
      fibre: round1(p.fibre * k),
    };
  }
  const old = item.estimated_weight_g || 0;
  if (!old) return { ...item, estimated_weight_g: newWeight };
  const r = newWeight / old;
  return {
    ...item,
    estimated_weight_g: newWeight,
    calories: Math.round(item.calories * r),
    calories_low: item.calories_low !== null ? Math.round(item.calories_low * r) : null,
    calories_high: item.calories_high !== null ? Math.round(item.calories_high * r) : null,
    protein: round1(item.protein * r),
    carbs: round1(item.carbs * r),
    fat: round1(item.fat * r),
    fibre: round1(item.fibre * r),
  };
}

export function sumItems(items: AnalysisItem[]) {
  return items.reduce(
    (t, i) => ({
      calories: t.calories + (i.calories || 0),
      calories_low: t.calories_low + (i.calories_low ?? i.calories ?? 0),
      calories_high: t.calories_high + (i.calories_high ?? i.calories ?? 0),
      protein: t.protein + (i.protein || 0),
      carbs: t.carbs + (i.carbs || 0),
      fat: t.fat + (i.fat || 0),
      fibre: t.fibre + (i.fibre || 0),
      weight_grams: t.weight_grams + (i.estimated_weight_g || 0),
    }),
    { calories: 0, calories_low: 0, calories_high: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, weight_grams: 0 },
  );
}
