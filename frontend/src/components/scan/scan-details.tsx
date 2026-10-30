"use client";

import { useState } from "react";
import { ChevronDown, Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Pills } from "@/components/ui/touch";
import { COOKING_METHODS, FILL_LEVELS, MEAL_TYPES, OIL_LEVELS } from "@/config/constants";
import { useContainers } from "@/hooks/use-food";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ScanDetails {
  description: string;
  ingredients: string;
  container_id: string;
  container_size_ml: string;
  plate_diameter_cm: string;
  fill_level: string;
  known_weight_g: string;
  servings: string;
  portion_eaten: string;
  cooking_method: string;
  oil_used: string;
  meal_type: string;
  date: string;
  time: string;
}

interface ScanDetailsFormProps {
  value: ScanDetails;
  onChange: (value: ScanDetails) => void;
}

const PORTIONS = [
  { value: "1", label: "All of it" },
  { value: "0.75", label: "¾" },
  { value: "0.5", label: "Half" },
  { value: "0.25", label: "¼" },
];

export function ScanDetailsForm({ value, onChange }: ScanDetailsFormProps) {
  const [showSize, setShowSize] = useState(false);
  const { data: containers } = useContainers();
  const set = <K extends keyof ScanDetails>(k: K, v: ScanDetails[K]) => onChange({ ...value, [k]: v });
  const selected = containers?.find((c) => c.id === value.container_id);

  const byCategory = (containers ?? []).reduce<Record<string, typeof containers>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  const filled = [
    value.container_id,
    value.container_size_ml,
    value.plate_diameter_cm,
    value.fill_level,
    value.known_weight_g,
    value.cooking_method,
    value.oil_used,
    value.servings !== "1" ? value.servings : "",
    value.portion_eaten !== "1" ? value.portion_eaten : "",
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Meal">
          <Select value={value.meal_type} onChange={(e) => set("meal_type", e.target.value)}>
            {MEAL_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={value.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Time">
          <Input type="time" value={value.time} onChange={(e) => set("time", e.target.value)} />
        </Field>
      </div>

      <Field label="What is it? (optional)" hint="Required only if you don't upload a photo.">
        <Textarea
          rows={2}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="e.g. Veg fried rice with peanuts and onions, home-cooked"
        />
      </Field>
      <Field info="hidden_calories" label="Ingredients you know (optional)" hint="Hidden items like oil, ghee, butter, cheese or sugar matter most.">
        <Textarea
          rows={2}
          value={value.ingredients}
          onChange={(e) => set("ingredients", e.target.value)}
          placeholder="rice, onion, peanuts, cumin, 1 tbsp oil…"
        />
      </Field>

      <div className={cn("overflow-hidden rounded-2xl border transition-colors", showSize ? "border-line bg-card" : "border-line bg-slate-50/70 hover:bg-slate-50")}>
        <button type="button" onClick={() => setShowSize((s) => !s)} aria-expanded={showSize} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Ruler className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">Portion & container</span>
            <span className="block text-xs text-slate-500">Improves weight accuracy</span>
          </span>
          {filled > 0 && <Badge tone="brand">{filled} added</Badge>}
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", showSize && "rotate-180")} />
        </button>
        {showSize && (
          <div className="fade-up grid gap-4 border-t border-line px-4 py-4 sm:grid-cols-2">
            <Field label="Container" hint={selected?.description} info="container">
              <Select value={value.container_id} onChange={(e) => set("container_id", e.target.value)}>
                <option value="">Not sure / let AI judge</option>
                {Object.entries(byCategory).map(([cat, list]) => (
                  <optgroup key={cat} label={humanize(cat)}>
                    {list?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} · {c.volume_ml} ml{c.diameter_cm ? ` · ⌀${c.diameter_cm} cm` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="How full?" info="fill_level">
              <Select value={value.fill_level} onChange={(e) => set("fill_level", e.target.value)}>
                <option value="">Not sure</option>
                {FILL_LEVELS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Custom container size (ml)" hint="Overrides the preset volume.">
              <Input type="number" inputMode="numeric" value={value.container_size_ml} onChange={(e) => set("container_size_ml", e.target.value)} />
            </Field>
            <Field label="Plate diameter (cm)">
              <Input type="number" inputMode="decimal" value={value.plate_diameter_cm} onChange={(e) => set("plate_diameter_cm", e.target.value)} />
            </Field>
            <Field info="known_weight" label="Known weight (g)" hint="If you weighed it, this beats every estimate.">
              <Input type="number" inputMode="numeric" value={value.known_weight_g} onChange={(e) => set("known_weight_g", e.target.value)} />
            </Field>
            <Field label="Servings in photo" info="servings">
              <Input type="number" step="0.5" min="0.5" inputMode="decimal" value={value.servings} onChange={(e) => set("servings", e.target.value)} />
            </Field>
            <Field label="How much did you eat?" info="servings" className="sm:col-span-2">
              <Pills options={PORTIONS} value={value.portion_eaten} onChange={(v) => set("portion_eaten", v)} ariaLabel="How much did you eat?" />
            </Field>
            <Field label="Cooking method" info="cooking_method">
              <Select value={value.cooking_method} onChange={(e) => set("cooking_method", e.target.value)}>
                {COOKING_METHODS.map((c) => (
                  <option key={c} value={c}>
                    {c ? humanize(c) : "Not sure"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Oil / ghee / butter used" info="hidden_calories">
              <Select value={value.oil_used} onChange={(e) => set("oil_used", e.target.value)}>
                {OIL_LEVELS.map((o) => (
                  <option key={o} value={o}>
                    {o ? humanize(o) : "Not sure"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}
