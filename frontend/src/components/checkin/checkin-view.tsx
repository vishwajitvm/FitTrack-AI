"use client";

import { useState, type ReactNode } from "react";
import { BatteryMedium, BedDouble, CalendarDays, Check, HeartPulse, Scale, Smile } from "lucide-react";
import { DateNav } from "@/components/common/date-nav";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { MetricRing } from "@/components/ui/fx";
import { Skeleton } from "@/components/ui/misc";
import { useBioFeedback } from "@/hooks/use-biofeedback";
import { useDaily } from "@/hooks/use-daily";
import { useRevalidatePrefix, useRevalidateTracking } from "@/hooks/use-revalidate";
import { fmt, prettyDate, today } from "@/lib/format";
import type { BioFeedback, DailySummary } from "@/lib/types";
import { CheckInForm } from "./checkin-form";
import { CorrelationsCard } from "./correlations-card";
import { SymptomLogger } from "./symptom-logger";

export function CheckInView() {
  const [date, setDate] = useState(today);
  const { data: daily, error, isLoading, mutate } = useDaily(date);
  const { data: symptoms, mutate: mutateSymptoms } = useBioFeedback(date, date);
  const revalidate = useRevalidateTracking();
  const revalidatePrefix = useRevalidatePrefix();

  const refresh = () => {
    mutate();
    mutateSymptoms();
    revalidate();
    revalidatePrefix("/api/biofeedback/correlations");
  };

  return (
    <>
      <PageHeader
        title="Check-in & gut health"
        page="checkin"
        description="Log how you feel each morning and any symptoms during the day. Late gym return (~21:10) and early bedtime (~21:30) make heavy late meals a common trigger for reflux and morning bloating."
        actions={<DateNav value={date} onChange={setDate} />}
      />
      <div className="space-y-6">
        {error && <ErrorState error={error} onRetry={() => mutate()} />}
        {isLoading ? <Skeleton className="h-44 rounded-3xl" /> : <CheckInHero date={date} summary={daily?.summary} symptoms={symptoms} />}
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">{isLoading ? <Skeleton className="h-96 rounded-2xl" /> : <CheckInForm date={date} summary={daily?.summary} onSaved={refresh} />}</div>
          <div className="lg:col-span-2">
            <SymptomLogger date={date} entries={symptoms} onChanged={refresh} />
          </div>
        </div>
        <div className="pt-2">
          <CorrelationsCard />
        </div>
      </div>
    </>
  );
}

/** Summary of what is already saved for the day: a ring for how complete it is, plus the key answers. */
function CheckInHero({ date, summary, symptoms }: { date: string; summary: DailySummary | undefined; symptoms: BioFeedback[] | undefined }) {
  const saved = summary ? [summary.morning_weight, summary.sleep_hours, summary.sleep_quality, summary.energy_level, summary.mood, summary.stress, summary.bloating_status] : [];
  const total = 7;
  const done = saved.filter((v) => v !== null && v !== undefined).length;
  const checkedIn = !!summary && [summary.energy_level, summary.sleep_hours, summary.morning_weight, summary.mood].some((v) => v !== null);
  const isToday = date === today();
  const symptomCount = symptoms?.length ?? 0;

  return (
    <section className="fade-up relative overflow-hidden rounded-3xl bg-hero p-6 text-white shadow-card sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/80">
            <CalendarDays className="h-3.5 w-3.5" />
            {isToday ? "Today · " : ""}
            {prettyDate(date, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">
            {checkedIn ? (isToday ? "You're checked in for today" : "Check-in saved for this day") : isToday ? "How are you feeling this morning?" : "No check-in for this day yet"}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-white/85">
            {checkedIn
              ? "Nice work. Change anything below and save again — your plan and readiness update straight away."
              : "It takes about 10 seconds: weight, sleep and a few taps on how you feel. Skip anything you're unsure about."}
          </p>
          {checkedIn && (
            <div className="flex flex-wrap gap-2 pt-1">
              {summary?.sleep_hours != null && <Chip icon={<BedDouble className="h-3.5 w-3.5" />}>{fmt(summary.sleep_hours, summary.sleep_hours % 1 ? 1 : 0)} h sleep</Chip>}
              {summary?.energy_level != null && (
<Chip icon={<BatteryMedium className="h-3.5 w-3.5" />}>Energy {summary.energy_level}/10</Chip>
              )}
              {summary?.mood != null && <Chip icon={<Smile className="h-3.5 w-3.5" />}>Mood {summary.mood}/10</Chip>}
              {summary?.morning_weight != null && <Chip icon={<Scale className="h-3.5 w-3.5" />}>{fmt(summary.morning_weight, 1)} kg</Chip>}
              <Chip icon={<HeartPulse className="h-3.5 w-3.5" />}>{symptomCount ? `${symptomCount} symptom${symptomCount === 1 ? "" : "s"}` : "No symptoms"}</Chip>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 self-start rounded-2xl bg-white/10 p-3 pr-5 ring-1 ring-white/20 backdrop-blur sm:self-auto">
          <MetricRing value={done / total} accent="balance" onHero size={88} stroke={8} label={`${done} of ${total} check-in answers saved`}>
            {done === total ? (
              <Check className="h-7 w-7" strokeWidth={2.5} />
            ) : (
              <span className="num text-lg font-semibold leading-none">
                {done}/{total}
              </span>
            )}
          </MetricRing>
          <div className="text-sm">
            <p className="font-semibold">{done === total ? "All done" : done === 0 ? "Not started" : "In progress"}</p>
            <p className="text-white/75">{done === total ? "Every answer saved" : `${total - done} left to answer`}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25 backdrop-blur">
      {icon}
      {children}
    </span>
  );
}
