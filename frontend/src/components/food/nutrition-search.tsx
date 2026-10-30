"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNutritionSearch } from "@/hooks/use-food";
import { fmt } from "@/lib/format";
import { MATCH_LABEL } from "@/lib/ml-labels";
import type { NutritionHit } from "@/lib/types";

interface NutritionSearchProps {
  onPick: (hit: NutritionHit) => void;
}

/** Autocomplete over local IFCT/USDA/Open Food Facts data (per 100 g). */
export function NutritionSearch({ onPick }: NutritionSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useNutritionSearch(query);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search nutrition database (e.g. paneer, oats, dahi chawal)…"
        className="h-11 pl-10 pr-10"
        aria-label="Search nutrition database"
      />
      {isLoading && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-600" />}
      {open && query.trim().length >= 2 && (
        <div className="glass-strong scrollbar-thin fade-up absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border p-1 shadow-pop">
          {error && <p className="px-3 py-2.5 text-[13px] text-crit-fg">Search failed: {String(error.message ?? error)}</p>}
          {!error && data && data.length === 0 && <p className="px-3 py-2.5 text-[13px] text-slate-500">No matches.</p>}
          {data?.map((hit, i) => (
            <button
              key={`${hit.source}-${hit.name}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(hit);
                setQuery("");
                setOpen(false);
              }}
              className="flex min-h-[48px] w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">{hit.name}</span>
                <span className="num mt-0.5 block text-xs text-slate-500">
                  per 100 g · <span className="font-medium text-acc-kcal">{fmt(hit.per_100g.calories)} kcal</span> · <span className="font-medium text-acc-protein">P {fmt(hit.per_100g.protein, 1)}</span> · C{" "}
                  {fmt(hit.per_100g.carbs, 1)} · F {fmt(hit.per_100g.fat, 1)}
                  {hit.serving_hint ? ` · ${hit.serving_hint}` : ""}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone="neutral">{hit.source}</Badge>
                {hit.match && <span className="text-[11px] text-slate-400">{MATCH_LABEL[hit.match] ?? hit.match}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
