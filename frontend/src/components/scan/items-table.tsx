"use client";

import { Trash2 } from "lucide-react";
import { Badge, confidenceTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Progress } from "@/components/ui/misc";
import { fmt, pct } from "@/lib/format";
import type { AnalysisItem } from "@/lib/types";
import { CONF_BAR } from "./confidence";
import { scaleItem } from "./scale-item";

interface ItemsTableProps {
  items: AnalysisItem[];
  onChange: (items: AnalysisItem[]) => void;
}

type NumKey = "calories" | "protein" | "carbs" | "fat" | "fibre";

const cellInput =
  "num mt-1 h-9 w-full min-w-0 rounded-lg border border-line bg-card px-2 text-right text-sm font-normal text-slate-900 transition-colors hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const cellLabel = "min-w-0 text-xs font-medium text-slate-500";

const MACROS: { key: Exclude<NumKey, "calories">; label: string; accent?: string }[] = [
  { key: "protein", label: "Protein (g)", accent: "text-acc-protein" },
  { key: "carbs", label: "Carbs (g)" },
  { key: "fat", label: "Fat (g)" },
  { key: "fibre", label: "Fibre (g)" },
];

/** Editable breakdown of the AI-detected items. Editing weight rescales macros. */
export function ItemsTable({ items, onChange }: ItemsTableProps) {
  const update = (idx: number, next: AnalysisItem) => onChange(items.map((it, i) => (i === idx ? next : it)));
  const setNum = (idx: number, key: NumKey, raw: string) => update(idx, { ...items[idx], [key]: raw === "" ? 0 : Number(raw) });

  if (items.length === 0) return <p className="px-5 py-8 text-center text-[13px] text-slate-500">No items left — add one with the “Item” button.</p>;

  return (
    <ul className="divide-y divide-line">
      {items.map((item, idx) => {
        const tone = confidenceTone(item.confidence);
        return (
          <li key={idx} className="fade-up px-5 py-4 transition-colors hover:bg-slate-50/80" style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}>
            <div className="flex items-start gap-3">
              <span className="num mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-acc-kcal/10 text-xs font-semibold text-acc-kcal">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <input
                  value={item.name}
                  onChange={(e) => update(idx, { ...item, name: e.target.value })}
                  aria-label="Item name"
                  className="-ml-1.5 w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-slate-900 hover:border-line focus:border-brand-500 focus:outline-none"
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={tone}>{item.confidence !== null ? `${pct(item.confidence)} confidence` : "confidence n/a"}</Badge>
                  {item.confidence !== null && <Progress value={item.confidence * 100} className="h-1.5 w-14" barClassName={CONF_BAR[tone]} />}
                  <InfoTip term="confidence" />
                  {item.cooking_method && <Badge tone="neutral">{item.cooking_method}</Badge>}
                  {item.source && <Badge tone="info">{item.source}</Badge>}
                  {item.tags.map((t) => (
                    <Badge key={t} tone="warning">
                      {t}
                    </Badge>
                  ))}
                </div>
                {item.ingredients.length > 0 && <p className="mt-1.5 text-xs text-slate-500">Ingredients: {item.ingredients.join(", ")}</p>}
                {item.notes && <p className="mt-0.5 text-xs italic text-slate-500">{item.notes}</p>}
              </div>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-crit-bg hover:text-crit-fg" onClick={() => onChange(items.filter((_, i) => i !== idx))} aria-label="Remove item">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 sm:ml-11 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
              <label className={cellLabel}>
                Weight (g)
                <input type="number" inputMode="numeric" className={cellInput} value={item.estimated_weight_g || ""} onChange={(e) => update(idx, scaleItem(item, Number(e.target.value)))} />
                {item.weight_low_g !== null && item.weight_high_g !== null && (
                  <span className="num mt-0.5 block text-[11px] font-normal text-slate-400">
                    est. {fmt(item.weight_low_g)}–{fmt(item.weight_high_g)} g
                  </span>
                )}
              </label>
              <label className={cellLabel}>
                <span className="inline-flex items-center gap-1 text-acc-kcal">
                  Calories <InfoTip term="calorie_range" />
                </span>
                <input type="number" inputMode="numeric" className={cellInput} value={item.calories} onChange={(e) => setNum(idx, "calories", e.target.value)} />
                {item.calories_low !== null && item.calories_high !== null && (
                  <span className="num mt-0.5 block text-[11px] font-normal text-slate-400">
                    {fmt(item.calories_low)}–{fmt(item.calories_high)}
                  </span>
                )}
              </label>
              {MACROS.map((m) => (
                <label key={m.key} className={cellLabel}>
                  <span className={m.accent}>{m.label}</span>
                  <input type="number" step="0.1" inputMode="decimal" className={cellInput} value={item[m.key]} onChange={(e) => setNum(idx, m.key, e.target.value)} />
                </label>
              ))}
            </div>
            {item.per_100g && (
              <p className="num mt-2 text-[11px] text-slate-400 sm:ml-11">
                Per 100 g: {fmt(item.per_100g.calories)} kcal · P {fmt(item.per_100g.protein, 1)} · C {fmt(item.per_100g.carbs, 1)} · F {fmt(item.per_100g.fat, 1)} · Fibre{" "}
                {fmt(item.per_100g.fibre, 1)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
