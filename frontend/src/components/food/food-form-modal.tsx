"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { TagInput } from "@/components/common/tag-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { Modal } from "@/components/ui/modal";
import { MEAL_TYPES } from "@/config/constants";
import { api } from "@/lib/api";
import { nowTime } from "@/lib/format";
import { withToast } from "@/lib/notify";
import type { FoodLog, FoodLogCreate, MealType, NutritionHit, Per100g } from "@/lib/types";
import { cn, toNumberOrNull } from "@/lib/utils";
import { useMacroColors } from "./macro";
import { NutritionSearch } from "./nutrition-search";

interface FoodFormModalProps {
  open: boolean;
  onClose: () => void;
  date: string;
  editing: FoodLog | null;
  onSaved: () => void;
}

type Form = {
  food_name: string;
  meal_type: MealType;
  time: string;
  quantity: string;
  portion_unit: string;
  weight_grams: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  research_source: string;
  ingredients: string[];
  tags: string[];
  notes: string;
};

const empty = (): Form => ({
  food_name: "",
  meal_type: "breakfast",
  time: nowTime(),
  quantity: "1",
  portion_unit: "serving",
  weight_grams: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fibre: "",
  research_source: "manual",
  ingredients: [],
  tags: [],
  notes: "",
});

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

const TAG_SUGGESTIONS = ["lactose", "gluten", "refined_flour", "fried", "late_night", "high_sodium", "spicy", "whey"];

export function FoodFormModal({ open, onClose, date, editing, onSaved }: FoodFormModalProps) {
  const [form, setForm] = useState<Form>(empty);
  const [per100, setPer100] = useState<Per100g | null>(null);
  const [saving, setSaving] = useState(false);
  const colors = useMacroColors();

  useEffect(() => {
    if (!open) return;
    setPer100(null);
    if (editing) {
      setForm({
        food_name: editing.food_name,
        meal_type: editing.meal_type,
        time: editing.time ?? "",
        quantity: str(editing.quantity),
        portion_unit: editing.portion_unit ?? "",
        weight_grams: str(editing.weight_grams),
        calories: str(editing.calories),
        protein: str(editing.protein),
        carbs: str(editing.carbs),
        fat: str(editing.fat),
        fibre: str(editing.fibre),
        research_source: editing.research_source ?? "",
        ingredients: editing.ingredients ?? [],
        tags: editing.tags ?? [],
        notes: editing.notes ?? "",
      });
    } else {
      setForm(empty());
    }
  }, [open, editing]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  /** Scale per-100 g values to the given weight. */
  const applyPer100 = (p: Per100g, grams: number) => {
    const k = grams / 100;
    setForm((f) => ({
      ...f,
      weight_grams: String(grams),
      calories: String(Math.round(p.calories * k)),
      protein: (p.protein * k).toFixed(1),
      carbs: (p.carbs * k).toFixed(1),
      fat: (p.fat * k).toFixed(1),
      fibre: (p.fibre * k).toFixed(1),
    }));
  };

  const pick = (hit: NutritionHit) => {
    setPer100(hit.per_100g);
    setForm((f) => ({ ...f, food_name: hit.name, research_source: hit.source, portion_unit: "g" }));
    applyPer100(hit.per_100g, Number(form.weight_grams) || 100);
  };

  const submit = async () => {
    if (!form.food_name.trim()) return;
    const body: Omit<FoodLogCreate, "date"> & { date: string } = {
      date,
      meal_type: form.meal_type,
      time: form.time || null,
      food_name: form.food_name.trim(),
      ingredients: form.ingredients,
      quantity: toNumberOrNull(form.quantity),
      portion_unit: form.portion_unit || null,
      weight_grams: toNumberOrNull(form.weight_grams),
      calories: toNumberOrNull(form.calories) ?? 0,
      protein: toNumberOrNull(form.protein) ?? 0,
      carbs: toNumberOrNull(form.carbs) ?? 0,
      fat: toNumberOrNull(form.fat) ?? 0,
      fibre: toNumberOrNull(form.fibre) ?? 0,
      calories_low: null,
      calories_high: null,
      confidence_score: editing?.confidence_score ?? 0.9,
      research_source: form.research_source || null,
      tags: form.tags,
      notes: form.notes || null,
    };
    setSaving(true);
    const ok = await withToast(
      () => (editing ? api.put(`/api/food/${editing.id}`, body) : api.post("/api/food", body)),
      editing ? "Food entry updated" : "Food logged",
    );
    setSaving(false);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Edit food entry" : "Add food manually"}
      description="Search the database to auto-fill macros, or type your own values."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!form.food_name.trim()}>
            {editing ? "Save changes" : "Add to log"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {!editing && (
          <section className="rounded-2xl border border-line bg-slate-50/70 p-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
              <Search className="h-4 w-4 text-brand-600" /> Find it in the nutrition database
              <InfoTip term="semantic_match" />
            </p>
            <NutritionSearch onPick={pick} />
          </section>
        )}

        <section>
          <SectionTitle>What and when</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Food name" className="sm:col-span-2">
              <Input value={form.food_name} onChange={(e) => set("food_name", e.target.value)} placeholder="e.g. Paneer bhurji" />
            </Field>
            <Field label="Meal">
              <Select value={form.meal_type} onChange={(e) => set("meal_type", e.target.value as MealType)}>
                {MEAL_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Time">
              <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
            </Field>
            <Field label="Quantity">
              <Input type="number" step="0.25" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </Field>
            <Field label="Unit">
              <Input value={form.portion_unit} onChange={(e) => set("portion_unit", e.target.value)} placeholder="serving, scoop, cup, g" />
            </Field>
            <Field label="Weight (g)" className="sm:col-span-2" hint={per100 ? "Changing weight rescales the macros from the database values." : undefined}>
              <Input
                type="number"
                value={form.weight_grams}
                onChange={(e) => {
                  set("weight_grams", e.target.value);
                  const g = Number(e.target.value);
                  if (per100 && g > 0) applyPer100(per100, g);
                }}
              />
            </Field>
          </div>
        </section>

        <section>
          <SectionTitle>Calories and macros</SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Field label={<Dotted className="bg-acc-kcal">Calories (kcal)</Dotted>} className="col-span-2 sm:col-span-1">
              <Input type="number" value={form.calories} onChange={(e) => set("calories", e.target.value)} />
            </Field>
            {(["protein", "carbs", "fat", "fibre"] as const).map((k) => (
              <Field key={k} label={<Dotted color={colors[k]}>{`${k[0].toUpperCase()}${k.slice(1)} (g)`}</Dotted>}>
                <Input type="number" step="0.1" value={form[k]} onChange={(e) => set(k, e.target.value)} />
              </Field>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>Extras</SectionTitle>
          <div className="space-y-4">
            <Field label="Ingredients">
              <TagInput value={form.ingredients} onChange={(v) => set("ingredients", v)} placeholder="rice, onion, peanuts…" />
            </Field>
            <Field label="Tags" info="bloating" hint="Tags feed the gut-health correlation engine (e.g. lactose, gluten).">
              <TagInput value={form.tags} onChange={(v) => set("tags", v)} suggestions={TAG_SUGGESTIONS} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Source" info="data_source">
                <Input value={form.research_source} onChange={(e) => set("research_source", e.target.value)} />
              </Field>
              <Field label="Notes">
                <Textarea rows={1} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-[13px] font-semibold text-slate-900">{children}</h3>;
}

/** Label with a small metric-colour dot (class for accents, inline colour for chart-theme macros). */
function Dotted({ children, className, color }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", className)} style={color ? { background: color } : undefined} aria-hidden />
      {children}
    </span>
  );
}
