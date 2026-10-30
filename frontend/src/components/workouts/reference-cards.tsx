"use client";

import { BookOpen, ChevronRight, Dumbbell, History } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { IconBubble, MiniBar } from "@/components/ui/fx";
import { Skeleton } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useMetReference, useWorkoutHistory } from "@/hooks/use-workouts";
import { fmt, prettyDate } from "@/lib/format";
import { splitAccent, SplitChip } from "./split-style";

export function MetReferenceCard() {
  const { data, isLoading } = useMetReference();
  const top = Math.max(1, ...(data ?? []).map((m) => m.met_high));
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / top) * 100))}%`;
  return (
    <Card>
      <CardHeader title="MET reference" info="met" description="Calories ≈ MET × 3.5 × kg ÷ 200 × minutes" icon={<BookOpen className="h-4 w-4" />} />
      <CardBody className="px-0 pb-2 pt-3">
        {isLoading && <Skeleton className="mx-5 my-2 h-32 rounded-xl" />}
        {data && (
          <ul className="divide-y divide-line">
            {data.map((m, i) => (
              <li key={m.key} className="fade-up px-5 py-3 transition-colors hover:bg-slate-50/80" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-sm text-slate-800">{m.activity}</span>
                  <span className="num shrink-0 text-sm font-semibold text-slate-900">
                    {m.default} <span className="text-xs font-normal text-slate-500">MET</span>
                  </span>
                </div>
                <div className="relative mt-2 h-1.5 rounded-full bg-acc-burn/10" aria-hidden>
                  <div className="absolute inset-y-0 rounded-full bg-acc-burn/40" style={{ left: pct(m.met_low), width: `calc(${pct(m.met_high)} - ${pct(m.met_low)})` }} />
                  <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-acc-burn" style={{ left: pct(m.default) }} />
                </div>
                <p className="num mt-1 text-[11px] text-slate-500">
                  Range {m.met_low}–{m.met_high}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export function WorkoutHistoryCard({ onPickDate }: { onPickDate: (date: string) => void }) {
  const { data, isLoading } = useWorkoutHistory(30);
  const maxKcal = Math.max(1, ...(data ?? []).map((r) => r.total_calories));
  return (
    <Card>
      <CardHeader info="ppl_split" title="Last 30 days" description="Tap a row to open that day" icon={<History className="h-4 w-4" />} />
      <CardBody className="p-0 pt-3">
        {isLoading && <Skeleton className="m-5 h-32 rounded-xl" />}
        {data && data.length === 0 && (
          <div className="p-5">
            <EmptyState icon={<Dumbbell className="h-5 w-5" />} title="No workouts in the last 30 days" description="Logged sessions and cardio show up here, one row per day." />
          </div>
        )}
        {data && data.length > 0 && (
          <>
            {/* Desktop: table */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH className="pl-5">Date</TH>
                    <TH>Split</TH>
                    <TH className="text-right">Lifting</TH>
                    <TH className="text-right">Cardio</TH>
                    <TH className="text-right">Exercises</TH>
                    <TH className="pr-5 text-right">Burned</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.map((r) => (
                    <TR
                      key={r.date}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open ${prettyDate(r.date)}`}
                      className="cursor-pointer hover:bg-slate-50/80 focus-visible:bg-slate-50 focus-visible:outline-none"
                      onClick={() => onPickDate(r.date)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPickDate(r.date))}
                    >
                      <TD className="whitespace-nowrap pl-5 font-medium text-slate-900">{prettyDate(r.date)}</TD>
                      <TD>{r.split ? <SplitChip split={r.split} /> : <span className="text-slate-400">—</span>}</TD>
                      <TD className="num text-right">{fmt(r.lifting_min)} min</TD>
                      <TD className="num text-right">{fmt(r.cardio_min)} min</TD>
                      <TD className="num text-right">{r.exercises}</TD>
                      <TD className="min-w-[110px] pr-5 text-right">
                        <span className="num font-semibold text-slate-900">{fmt(r.total_calories)}</span> <span className="text-xs text-slate-500">kcal</span>
                        <MiniBar value={r.total_calories} max={maxKcal} accent="burn" className="mt-1" />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            {/* Phone: rows */}
            <ul className="divide-y divide-line border-t border-line md:hidden">
              {data.map((r) => (
                <li key={r.date}>
                  <button type="button" onClick={() => onPickDate(r.date)} className="flex min-h-[56px] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100">
                    <IconBubble accent={splitAccent(r.split)}>
                      <Dumbbell className="h-4 w-4" />
                    </IconBubble>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                        {prettyDate(r.date)}
                        {r.split && <SplitChip split={r.split} />}
                      </span>
                      <span className="num mt-0.5 block text-xs text-slate-500">
                        {fmt(r.lifting_min + r.cardio_min)} min · {r.exercises} exercise{r.exercises === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="num block text-sm font-semibold text-acc-burn">{fmt(r.total_calories)}</span>
                      <span className="block text-[11px] text-slate-500">kcal</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}
