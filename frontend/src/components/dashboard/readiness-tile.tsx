"use client";

import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { EnergyOrb, useTilt } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import { readinessInsight } from "@/lib/insights";
import type { WorkoutRecommendation } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "Ready to train?" — a dark tile with the 3D energy orb showing today's readiness. */
export function ReadinessTile({ rec, className }: { rec: WorkoutRecommendation | null; className?: string }) {
  const tilt = useTilt<HTMLElement>(4);
  const score = rec?.readiness_score ?? null;
  // the score and label are shown big already; keep just the advice
  const insight = readinessInsight(score, rec?.readiness_label ?? null)?.replace(/^\d+\/100 \([^)]*\): /, "");

  return (
    <section
      ref={tilt}
      className={cn("tilt relative flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[rgb(14_11_34)] p-6 text-white shadow-pop", className)}
    >
      <div className="blob -left-10 -top-10 h-40 w-40 bg-[rgb(var(--hero-from)/0.55)]" aria-hidden />
      <div className="blob -bottom-12 -right-8 h-44 w-44 bg-[rgb(var(--hero-to)/0.4)] [animation-delay:-6s]" aria-hidden />

      <div className="relative flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/90">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Zap className="h-4 w-4" />
          </span>
          Ready to train?
          <InfoTip term="chart_readiness" tone="light" />
        </p>
        {rec?.split_today && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-white/15">{rec.split_today.replace("_", " ")} day</span>}
      </div>

      <div className="relative my-4 flex flex-1 items-center justify-center">
        <EnergyOrb value={score !== null ? score / 100 : 0} size={176} label={`Readiness ${score ?? "unknown"} of 100`}>
          <span className="text-4xl font-bold leading-none drop-shadow">{score ?? "—"}</span>
          <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/80">of 100</span>
        </EnergyOrb>
      </div>

      <div className="relative space-y-1 text-center">
        <p className="text-lg font-semibold">{rec?.readiness_label ?? "No check-in yet"}</p>
        {insight && <p className="text-[13px] leading-snug text-white/70">{insight}</p>}
      </div>
      <Link
        href="/workouts"
        className="relative mt-4 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-white/10 px-4 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/20"
      >
        Today&apos;s plan <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
