"use client";

import { ChevronRight, Dumbbell, Moon, Scale, Utensils } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ACCENT, MiniBar, type Accent } from "@/components/ui/fx";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { fmt, humanize, prettyDate } from "@/lib/format";
import type { HistoryRow, HistoryStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<HistoryStatus, { tone: BadgeTone; label: string }> = {
  critical: { tone: "critical", label: "Needs attention" },
  warning: { tone: "warning", label: "Warning" },
  ok: { tone: "ok", label: "Good" },
};

/** Today isn't over yet: "Good" would be premature unless something already needs attention. */
function statusOf(r: HistoryRow) {
  return r.is_today && !r.complete && r.status === "ok" ? { tone: "neutral" as BadgeTone, label: "In progress" } : STATUS[r.status];
}

/** Each training split gets its own colour, so a week of workouts reads at a glance. */
const SPLIT_ACCENT: Record<string, Accent> = { push: "kcal", pull: "sleep", legs: "burn", cardio: "water", full_body: "balance", other: "weight" };

export function SplitChips({ row }: { row: HistoryRow }) {
  const w = row.workout;
  if (!w.splits.length && !w.exercise_count) return <span className="text-slate-400">{row.is_rest_day ? "Rest day" : "No workout"}</span>;
  const mins = (w.lifting_min ?? 0) + (w.cardio_min ?? 0);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {(w.splits.length ? w.splits : ["other"]).map((s) => {
        const a = ACCENT[SPLIT_ACCENT[s] ?? "weight"];
        return (
          <span key={s} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", a.tint, a.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", a.solid)} />
            {humanize(s)}
          </span>
        );
      })}
      {mins > 0 && <span className="text-xs text-slate-500">{fmt(mins)} min</span>}
    </span>
  );
}

export function balanceText(row: Pick<HistoryRow, "calorie_deficit">): string {
  const d = row.calorie_deficit;
  if (d === null) return "Burn pending";
  return d > 0 ? `${fmt(d)} deficit` : `${fmt(-d)} surplus`;
}

function WeightCell({ row }: { row: HistoryRow }) {
  if (row.morning_weight === null) return <span className="text-slate-400">—</span>;
  const ch = row.weight_change;
  return (
    <span className="whitespace-nowrap">
      {fmt(row.morning_weight, 1)} kg
      {ch !== null && ch !== 0 && (
        <span className={cn("ml-1 text-xs", ch < 0 ? "text-good-fg" : "text-warn-fg")}>
          {ch > 0 ? "+" : ""}
          {fmt(ch, 1)}
        </span>
      )}
    </span>
  );
}

function DateCell({ row }: { row: HistoryRow }) {
  return (
    <div>
      <p className="whitespace-nowrap font-medium text-slate-900">
        {prettyDate(row.date, { weekday: "short", day: "numeric", month: "short" })}
        {row.is_today && <Badge tone="brand" className="ml-1.5">Today</Badge>}
      </p>
      <p className="text-xs text-slate-500">Day {row.day_number}</p>
    </div>
  );
}

interface ListProps {
  rows: HistoryRow[];
  onOpen: (date: string) => void;
}

export function HistoryTable({ rows, onOpen }: ListProps) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Date</TH>
          <TH className="text-right">Eaten</TH>
          <TH className="text-right">Protein</TH>
          <TH>Workout</TH>
          <TH className="text-right">Burned</TH>
          <TH className="text-right">Balance</TH>
          <TH className="text-right">Weight</TH>
          <TH>Sleep · Energy</TH>
          <TH>Status</TH>
          <TH className="w-8" />
        </TR>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR
            key={r.date}
            tabIndex={0}
            role="button"
            aria-label={`Open ${prettyDate(r.date)}`}
            onClick={() => onOpen(r.date)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(r.date))}
            className="fade-up cursor-pointer transition-[background-color,box-shadow] hover:bg-acc-balance/5 hover:shadow-[inset_3px_0_0_0_rgb(var(--acc-balance))] focus-visible:bg-acc-balance/5 focus-visible:outline-none"
          >
            <TD>
              <DateCell row={r} />
            </TD>
            <TD className="min-w-[110px] whitespace-nowrap text-right">
              <span className="font-semibold text-slate-900">{fmt(r.total_calories)}</span> <span className="text-xs text-slate-500">kcal</span>
              <MiniBar value={r.total_calories} max={r.estimated_tdee} accent="kcal" className="mt-1" />
              <p className="mt-0.5 text-[11px] text-slate-500">{r.food_count} item{r.food_count === 1 ? "" : "s"}</p>
            </TD>
            <TD className="min-w-[96px] whitespace-nowrap text-right">
              <span className="font-semibold text-slate-900">{fmt(r.total_protein, 0)}</span> <span className="text-xs text-slate-500">g</span>
              <MiniBar value={r.protein_per_kg} max={1.6} accent="protein" className="mt-1" />
              {r.protein_per_kg !== null && <p className="mt-0.5 text-[11px] text-slate-500">{fmt(r.protein_per_kg, 2)} of 1.6 g/kg</p>}
            </TD>
            <TD className="max-w-[240px]">
              <SplitChips row={r} />
              {r.workout.exercise_count > 0 && <p className="mt-1 text-[11px] text-slate-500">{r.workout.exercise_count} exercises</p>}
            </TD>
            <TD className="whitespace-nowrap text-right">{r.estimated_tdee !== null ? `${fmt(r.estimated_tdee)} kcal` : "—"}</TD>
            <TD className={cn("whitespace-nowrap text-right font-medium", r.calorie_deficit === null ? "text-slate-400" : r.calorie_deficit > 0 ? "text-good-fg" : "text-warn-fg")}>
              {balanceText(r)}
            </TD>
            <TD className="text-right">
              <WeightCell row={r} />
            </TD>
            <TD className="whitespace-nowrap text-xs">
              {r.sleep_hours !== null ? `${fmt(r.sleep_hours, 1)} h` : "—"} · {r.energy_level !== null ? `${r.energy_level}/10` : "—"}
            </TD>
            <TD>
              <Badge tone={statusOf(r).tone} title={r.top_alert ?? undefined}>
                {statusOf(r).label}
              </Badge>
            </TD>
            <TD className="text-slate-400">
              <ChevronRight className="h-4 w-4" />
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export function HistoryCards({ rows, onOpen }: ListProps) {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((r, i) => (
        <li key={r.date} className="fade-up" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          <button
            type="button"
            onClick={() => onOpen(r.date)}
            className="lift w-full rounded-2xl border border-line bg-card p-4 text-left shadow-card hover:border-acc-balance/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc-balance"
          >
            <div className="flex items-start justify-between gap-3">
              <DateCell row={r} />
              <Badge tone={statusOf(r).tone}>{statusOf(r).label}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Tile label="Eaten" value={fmt(r.total_calories)} unit="kcal" accent="kcal" />
              <Tile label="Protein" value={fmt(r.total_protein)} unit="g" accent="protein" />
              <Tile
                label="Balance"
                value={r.calorie_deficit === null ? "—" : fmt(Math.abs(r.calorie_deficit))}
                unit={r.calorie_deficit === null ? "" : r.calorie_deficit > 0 ? "deficit" : "surplus"}
                accent={r.calorie_deficit !== null && r.calorie_deficit <= 0 ? "kcal" : "balance"}
              />
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <Utensils className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acc-kcal" />
                <span className="line-clamp-1">{r.foods_preview.length ? r.foods_preview.join(", ") : "No food logged"}</span>
              </li>
              <li className="flex items-start gap-2">
                <Dumbbell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acc-burn" />
                <SplitChips row={r} />
              </li>
              <li className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-2">
                  <Scale className="h-3.5 w-3.5 text-acc-weight" />
                  <WeightCell row={r} />
                </span>
                <span className="flex items-center gap-2">
                  <Moon className="h-3.5 w-3.5 text-acc-sleep" />
                  {r.sleep_hours !== null ? `${fmt(r.sleep_hours, 1)} h sleep` : "No sleep logged"}
                  {r.energy_level !== null && ` · energy ${r.energy_level}/10`}
                </span>
              </li>
            </ul>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Tile({ label, value, unit, accent }: { label: string; value: string; unit: string; accent: Accent }) {
  return (
    <div className={cn("rounded-xl px-2 py-2", ACCENT[accent].tint)}>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={cn("text-base font-bold", ACCENT[accent].text)}>{value}</p>
      <p className="text-[11px] text-slate-500">{unit}</p>
    </div>
  );
}
