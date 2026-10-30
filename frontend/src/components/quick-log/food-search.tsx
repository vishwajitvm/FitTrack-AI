"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Database, History, Loader2, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MEAL_LABEL } from "@/config/constants";
import { useNutritionSearch } from "@/hooks/use-food";
import { useQuickActions } from "@/hooks/use-quick-actions";
import { fmt } from "@/lib/format";
import { parseServing } from "@/lib/serving";
import type { MealType, NutritionHit, QuickPick } from "@/lib/types";

const SERVINGS = [0.5, 1, 1.5, 2];

interface Props {
  date: string;
  time?: string;
  slot: MealType;
  /** The slot's usual foods (searched first, logged as before). */
  picks: QuickPick[];
  onLogged?: () => void;
}

/**
 * Search any food and log it to the selected meal: your usual foods first, then the nutrition database.
 * A database food asks how much (servings from its hint, or 100 g); once logged it becomes a usual food.
 */
export function FoodSearch({ date, time, slot, picks, onLogged }: Props) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<NutritionHit | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { data: hits, isLoading } = useNutritionSearch(chosen ? "" : query);
  const { logPick, logFoodHit } = useQuickActions();
  const q = query.trim().toLowerCase();

  const usual = useMemo(() => (q.length < 2 ? [] : picks.filter((p) => p.food_name.toLowerCase().includes(q)).slice(0, 4)), [picks, q]);
  // don't repeat a database row for a food that is already one of your usual ones
  const usualNames = new Set(usual.map((p) => p.food_name.toLowerCase()));
  const database = (hits ?? []).filter((h) => !usualNames.has(h.name.toLowerCase())).slice(0, 6);

  const done = (ok: unknown) => {
    setBusy(null);
    if (ok) {
      setQuery("");
      setChosen(null);
      onLogged?.();
    }
  };

  return (
    <section className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setChosen(null);
          }}
          placeholder={`Search any food for ${MEAL_LABEL[slot]?.toLowerCase() ?? "this meal"} — e.g. maggi, paneer, dal`}
          className="h-12 rounded-2xl pl-10 pr-10 text-[15px]"
          aria-label="Search food to add"
          autoComplete="off"
        />
        {isLoading && q.length >= 2 ? (
          <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-600" />
        ) : (
          query && (
            <button type="button" onClick={() => { setQuery(""); setChosen(null); }} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {chosen && <PortionPicker hit={chosen} busy={busy} onCancel={() => setChosen(null)} onPick={(grams, quantity, unit) => {
        setBusy("portion");
        void logFoodHit(chosen, grams, { date, time, meal_type: slot, quantity, unit }).then(done);
      }} />}

      {!chosen && q.length >= 2 && (
        <div className="fade-up overflow-hidden rounded-2xl border border-line bg-card">
          {usual.length > 0 && (
            <Group icon={<History className="h-3.5 w-3.5" />} title="Your usual">
              {usual.map((p) => (
                <Row
                  key={p.key}
                  name={p.food_name}
                  sub={`${p.quantity !== null ? `${fmt(p.quantity, p.quantity % 1 ? 1 : 0)} ${p.portion_unit ?? ""} · ` : ""}${fmt(p.calories)} kcal · ${fmt(p.protein, 0)} g protein`}
                  busy={busy === p.key}
                  onClick={() => {
                    setBusy(p.key);
                    void logPick(p, { date, time, meal_type: slot }).then(done);
                  }}
                />
              ))}
            </Group>
          )}
          <Group icon={<Database className="h-3.5 w-3.5" />} title="Food database">
            {database.map((h, i) => {
              const s = parseServing(h.serving_hint);
              return (
                <Row
                  key={`${h.name}-${i}`}
                  name={h.name}
                  sub={`${s.label}${s.unit ? ` (${fmt(s.grams)} g)` : ""} · ${fmt((h.per_100g.calories * s.grams) / 100)} kcal · ${fmt((h.per_100g.protein * s.grams) / 100, 1)} g protein`}
                  busy={false}
                  onClick={() => setChosen(h)}
                />
              );
            })}
            {!isLoading && database.length === 0 && usual.length === 0 && (
              <p className="px-4 py-3 text-[13px] text-slate-500">No match. Try another word, snap a photo, or type the whole meal on the Food log page.</p>
            )}
          </Group>
        </div>
      )}
    </section>
  );
}

function Group({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="border-b border-line last:border-0">
      <p className="flex items-center gap-1.5 px-4 pb-1 pt-2.5 text-xs font-medium text-slate-500">
        {icon} {title}
      </p>
      <div className="pb-1">{children}</div>
    </div>
  );
}

function Row({ name, sub, busy, onClick }: { name: string; sub: string; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-acc-kcal/5 disabled:opacity-60">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-acc-kcal/10 text-acc-kcal">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900">{name}</span>
        <span className="num block truncate text-xs text-slate-500">{sub}</span>
      </span>
    </button>
  );
}

function PortionPicker({ hit, busy, onPick, onCancel }: { hit: NutritionHit; busy: string | null; onPick: (grams: number, quantity: number, unit: string | null) => void; onCancel: () => void }) {
  const s = parseServing(hit.serving_hint);
  const options = s.unit
    ? [...SERVINGS.map((k) => ({ key: `s${k}`, label: `${k === 0.5 ? "½" : k === 1.5 ? "1½" : k} ${s.unit}`, grams: s.grams * k, quantity: k, unit: s.unit })), { key: "g100", label: "100 g", grams: 100, quantity: 100, unit: null }]
    : [50, 100, 150, 200].map((g) => ({ key: `g${g}`, label: `${g} g`, grams: g, quantity: g, unit: null }));
  return (
    <div className="fade-up rounded-2xl border border-acc-kcal/30 bg-acc-kcal/5 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span>
          <span className="block text-sm font-semibold text-slate-900">How much {hit.name}?</span>
          <span className="text-xs text-slate-500">{hit.serving_hint ?? "per 100 g"} · {hit.source}</span>
        </span>
        <button type="button" onClick={onCancel} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Back to results">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={busy !== null}
            onClick={() => onPick(o.grams, o.quantity, o.unit)}
            className="min-h-[56px] min-w-[76px] rounded-xl border border-line bg-card px-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-acc-kcal/40 active:scale-95 disabled:opacity-60"
          >
            {o.label}
            <span className="num block text-[11px] font-normal text-acc-kcal">{fmt((hit.per_100g.calories * o.grams) / 100)} kcal</span>
          </button>
        ))}
        {busy && <Loader2 className="h-5 w-5 animate-spin self-center text-acc-kcal" />}
      </div>
    </div>
  );
}
