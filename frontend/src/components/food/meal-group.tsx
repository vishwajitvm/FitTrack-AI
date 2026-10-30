import { Apple, BookmarkPlus, Coffee, Cookie, Dumbbell, Moon, Pencil, Soup, Trash2, Utensils, Zap, type LucideIcon } from "lucide-react";
import { Badge, confidenceTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CollapseBody, CollapseButton } from "@/components/ui/collapse";
import { IconBubble } from "@/components/ui/fx";
import { MEAL_LABEL } from "@/config/constants";
import { fileUrl } from "@/lib/api";
import { fmt, pct, range } from "@/lib/format";
import type { FoodLog } from "@/lib/types";

interface MealGroupProps {
  mealType: string;
  items: FoodLog[];
  onEdit: (item: FoodLog) => void;
  onDelete: (item: FoodLog) => void;
  /** Save this whole meal as a one-tap preset. */
  onSavePreset?: () => void;
}

const MEAL_ICON: Record<string, LucideIcon> = {
  breakfast: Coffee,
  morning_snack: Apple,
  lunch: Soup,
  evening_snack: Cookie,
  pre_workout: Zap,
  post_workout: Dumbbell,
  dinner: Moon,
};

export function MealGroup({ mealType, items, onEdit, onDelete, onSavePreset }: MealGroupProps) {
  const total = items.reduce(
    (acc, i) => ({ kcal: acc.kcal + i.calories, p: acc.p + i.protein }),
    { kcal: 0, p: 0 },
  );
  const Icon = MEAL_ICON[mealType] ?? Utensils;
  return (
    <Card collapsible={`meal-${mealType}`} className="overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5">
        <IconBubble accent="kcal">
          <Icon className="h-4 w-4" />
        </IconBubble>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">{MEAL_LABEL[mealType] ?? mealType}</h3>
          <p className="num mt-0.5 text-[13px] text-slate-500">
            <span className="font-medium text-acc-kcal">{fmt(total.kcal)} kcal</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="font-medium text-acc-protein">{fmt(total.p, 1)} g protein</span>
          </p>
        </div>
        {onSavePreset && (
          <Button variant="ghost" size="sm" className="min-h-[44px] text-slate-600 hover:text-brand-600" onClick={onSavePreset} title="Save this meal for one-tap logging" aria-label="Save as preset">
            <BookmarkPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Save as preset</span>
          </Button>
        )}
        <CollapseButton label={`${MEAL_LABEL[mealType] ?? mealType} items`} />
      </div>
      <CollapseBody>
      <ul className="divide-y divide-line border-t border-line">
        {items.map((item) => {
          const img = fileUrl(item.image_url);
          const kcalRange = range(item.calories_low, item.calories_high);
          const portion = [
            item.time,
            item.quantity !== null ? `${fmt(item.quantity, item.quantity % 1 ? 2 : 0)} ${item.portion_unit ?? ""}`.trim() : null,
            item.weight_grams !== null ? `${fmt(item.weight_grams)} g` : null,
          ].filter(Boolean);
          return (
            <li key={item.id} className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80">
              {img ? (
                <img src={img} alt={item.food_name} className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-line" />
              ) : (
                <span className="num flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-semibold text-slate-500">
                  {item.time ?? <Utensils className="h-4 w-4 text-slate-400" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-slate-900">{item.food_name}</p>
                  {item.confidence_score !== null && item.confidence_score < 0.95 && (
                    <Badge tone={confidenceTone(item.confidence_score)}>{pct(item.confidence_score)} conf.</Badge>
                  )}
                  {item.tags.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                </div>
                {portion.length > 0 && <p className="num mt-0.5 text-xs text-slate-500">{portion.join(" · ")}</p>}
                <p className="num mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span>
                    <span className="font-semibold text-acc-protein">P</span> {fmt(item.protein, 1)}
                  </span>
                  <span>
                    <span className="font-medium text-slate-700">C</span> {fmt(item.carbs, 1)}
                  </span>
                  <span>
                    <span className="font-medium text-slate-700">F</span> {fmt(item.fat, 1)}
                  </span>
                  <span>
                    <span className="font-medium text-slate-700">Fibre</span> {fmt(item.fibre, 1)}
                  </span>
                </p>
                {item.research_source && <p className="mt-0.5 text-[11px] text-slate-400">Source: {item.research_source}</p>}
              </div>
              <div className="flex shrink-0 items-start gap-1 sm:gap-2">
                <div className="pt-0.5 text-right">
                  <p className="num text-[15px] font-semibold leading-tight text-slate-900">{fmt(item.calories)}</p>
                  <p className="num text-[11px] text-slate-400">{kcalRange ? `${kcalRange} kcal` : "kcal"}</p>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row">
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900" onClick={() => onEdit(item)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-crit-bg hover:text-crit-fg" onClick={() => onDelete(item)} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      </CollapseBody>
    </Card>
  );
}
