"use client";

import type { ReactNode } from "react";
import { BedDouble, CalendarDays, CheckCircle2, Circle, Dumbbell } from "lucide-react";
import { usePrefs } from "@/components/layout/prefs-provider";
import { AnimatedNumber, MetricRing } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import { Skeleton } from "@/components/ui/misc";
import { humanize, prettyDate, today } from "@/lib/format";
import { READINESS_MODE } from "@/lib/ml-labels";
import type { WorkoutRecommendation } from "@/lib/types";
import { readinessWord } from "./recommendation-panel";

interface WorkoutHeroProps {
  date: string;
  rec: WorkoutRecommendation | undefined;
  loading: boolean;
  /** Splits actually logged on this day (sessions + "cardio" if any cardio). */
  loggedSplits: string[];
}

/** The one gradient block on the page: which day it is, the plan in one sentence and a readiness ring. */
export function WorkoutHero({ date, rec, loading, loggedSplits }: WorkoutHeroProps) {
  const { simple } = usePrefs();
  if (loading) return <Skeleton className="mb-5 h-48 rounded-3xl" />;

  const score = rec?.readiness_score ?? null;
  const isToday = date === today();
  const trained = loggedSplits.length > 0;
  const title = !rec ? "Your training day" : rec.is_rest_day ? "Rest & recovery day" : `${humanize(rec.split_today)} day`;

  return (
    <section className="fade-up relative mb-5 overflow-hidden rounded-3xl bg-hero p-6 text-white shadow-card sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-white/10 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/80">
            <CalendarDays className="h-3.5 w-3.5" />
            {prettyDate(date, { weekday: "long", day: "numeric", month: "long" })}
            {isToday ? " · Today" : ""}
          </p>
          <h2 className="flex items-center gap-2 text-2xl font-bold leading-tight sm:text-3xl">
            {rec?.is_rest_day ? <BedDouble className="h-6 w-6 shrink-0" /> : <Dumbbell className="h-6 w-6 shrink-0" />}
            {title}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-white/85">{rec ? rec.recommendation : "The plan is unavailable right now — you can still log your workout as usual."}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Chip icon={trained ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}>
              {trained ? `Logged: ${loggedSplits.map(humanize).join(", ")}` : rec?.is_rest_day ? "Recovery counts as training" : "Nothing logged yet"}
            </Chip>
          </div>
        </div>

        <div className="flex items-center gap-4 self-start rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur md:self-auto">
          <MetricRing value={score !== null ? score / 100 : 0} accent="sleep" onHero size={104} stroke={9} label={`Readiness ${score ?? "not available"} out of 100`}>
            <span className="text-2xl font-bold leading-none">
              <AnimatedNumber value={score} />
            </span>
            <span className="mt-0.5 text-[11px] text-white/80">of 100</span>
          </MetricRing>
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-1 text-[13px] font-medium text-white/80">
              Readiness
              <InfoTip term="readiness" tone="light" className="text-white/70 hover:text-white" />
            </p>
            <p className="text-lg font-bold leading-tight">{readinessWord(score)}</p>
            <p className="text-xs text-white/75">
              {simple || !rec?.readiness_mode ? (score === null ? "Do a check-in to personalise this" : "From your sleep, soreness and energy") : `${READINESS_MODE[rec.readiness_mode]}${rec.readiness_label ? ` · ${rec.readiness_label}` : ""}`}
            </p>
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
