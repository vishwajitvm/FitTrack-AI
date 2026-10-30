"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { HistoryFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

export const DEFAULT_FILTERS: HistoryFilters = {
  q: "",
  start: "",
  end: "",
  workout: "any",
  split: "",
  balance: "any",
  status: "any",
  weighed: "",
  sort: "date",
  order: "desc",
  page: 1,
  page_size: 10,
};

const SPLITS = ["push", "pull", "legs", "cardio", "full_body", "other"] as const;

/** How many filters (besides search and sort) are switched on. */
export function activeFilterCount(f: HistoryFilters): number {
  return [f.start, f.end, f.split, f.weighed].filter(Boolean).length + [f.workout, f.balance, f.status].filter((v) => v !== "any").length;
}

interface Props {
  value: HistoryFilters;
  onChange: (patch: Partial<HistoryFilters>) => void;
}

export function HistoryFiltersBar({ value, onChange }: Props) {
  const [q, setQ] = useState(value.q);
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(value);

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => q !== value.q && onChange({ q }), 300);
    return () => clearTimeout(t);
  }, [q, value.q, onChange]);
  useEffect(() => {
    setQ(value.q);
  }, [value.q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search foods, exercises, notes, weekday… e.g. “paneer”, “squat”, “monday”"
            className="pl-9 pr-9"
            aria-label="Search history"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Select
            value={`${value.sort}:${value.order}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split(":");
              onChange({ sort: sort as HistoryFilters["sort"], order: order as HistoryFilters["order"] });
            }}
            className="sm:w-[190px]"
            aria-label="Sort"
          >
            <option value="date:desc">Newest first</option>
            <option value="date:asc">Oldest first</option>
            <option value="calories:desc">Most calories</option>
            <option value="calories:asc">Fewest calories</option>
            <option value="protein:desc">Most protein</option>
            <option value="deficit:desc">Biggest deficit</option>
            <option value="weight:desc">Heaviest weigh-in</option>
            <option value="weight:asc">Lightest weigh-in</option>
            <option value="exercise:desc">Most exercise</option>
          </Select>
          <Button variant={open || count ? "secondary" : "outline"} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {count > 0 && <span className="rounded-full bg-navy px-1.5 text-[10px] text-white">{count}</span>}
          </Button>
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-slate-50/60 p-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="From">
            <Input type="date" value={value.start} max={value.end || undefined} onChange={(e) => onChange({ start: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="date" value={value.end} min={value.start || undefined} onChange={(e) => onChange({ end: e.target.value })} />
          </Field>
          <Field label="Training">
            <Select value={value.workout} onChange={(e) => onChange({ workout: e.target.value as HistoryFilters["workout"] })}>
              <option value="any">Any day</option>
              <option value="trained">Trained</option>
              <option value="rest">No workout</option>
            </Select>
          </Field>
          <Field label="Workout type">
            <Select value={value.split} onChange={(e) => onChange({ split: e.target.value as HistoryFilters["split"] })}>
              <option value="">Any</option>
              {SPLITS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Calories">
            <Select value={value.balance} onChange={(e) => onChange({ balance: e.target.value as HistoryFilters["balance"] })}>
              <option value="any">Any</option>
              <option value="deficit">In a deficit</option>
              <option value="surplus">At or above maintenance</option>
              <option value="pending">Burn not known yet</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={value.status} onChange={(e) => onChange({ status: e.target.value as HistoryFilters["status"] })}>
              <option value="any">Any</option>
              <option value="critical">Needs attention</option>
              <option value="warning">Warnings</option>
              <option value="ok">All good</option>
            </Select>
          </Field>
          <Field label="Weigh-in" className="col-span-2 sm:col-span-1">
            <Select value={value.weighed} onChange={(e) => onChange({ weighed: e.target.value as HistoryFilters["weighed"] })}>
              <option value="">Any</option>
              <option value="true">Weighed in</option>
              <option value="false">No weigh-in</option>
            </Select>
          </Field>
          <div className="col-span-2 flex items-end sm:col-span-2 lg:col-span-5 lg:justify-end">
            <Button
              variant="ghost"
              size="sm"
              disabled={!count}
              onClick={() => onChange({ start: "", end: "", workout: "any", split: "", balance: "any", status: "any", weighed: "" })}
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
