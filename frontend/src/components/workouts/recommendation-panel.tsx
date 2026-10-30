"use client";

import { BedDouble, Gauge, Utensils } from "lucide-react";
import { usePrefs } from "@/components/layout/prefs-provider";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { AnimatedNumber, IconBubble, MetricRing } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import { fmt, humanize } from "@/lib/format";
import { ACWR_ZONE, READINESS_MODE } from "@/lib/ml-labels";
import type { WorkoutRecommendation } from "@/lib/types";
import { SplitChip } from "./split-style";

export function readinessTone(score: number | null): BadgeTone {
  if (score === null) return "neutral";
  if (score >= 70) return "ok";
  if (score >= 45) return "warning";
  return "critical";
}

/** Plain words for the training-load zone (ACWR). */
const ACWR_PLAIN: Record<string, string> = {
  low: "Training load: lighter than usual",
  optimal: "Training load: steady",
  high: "Training load: higher than usual",
  very_high: "Training load: much higher than usual",
};

/** Plain words for readiness with the status in text, not colour alone. */
export function readinessWord(score: number | null) {
  if (score === null) return "No check-in yet";
  if (score >= 70) return "Ready to train";
  if (score >= 45) return "Train lighter";
  return "Recover today";
}

const dotClass: Record<BadgeTone, string> = {
  ok: "bg-good-fg",
  warning: "bg-warn-fg",
  critical: "bg-crit-fg",
  info: "bg-info-fg",
  neutral: "bg-slate-400",
  dark: "bg-white",
  brand: "bg-brand-600",
};

/** Status pill with a dot so meaning never relies on colour alone. */
export function ReadinessBadge({ rec }: { rec: WorkoutRecommendation }) {
  const { simple } = usePrefs();
  const tone = readinessTone(rec.readiness_score);
  return (
    <Badge tone={tone}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass[tone]}`} aria-hidden />
      {simple
        ? `${readinessWord(rec.readiness_score)}${rec.readiness_score !== null ? ` (${fmt(rec.readiness_score)}/100)` : ""}`
        : `Readiness ${rec.readiness_score !== null ? `${fmt(rec.readiness_score)}/100` : "—"}${rec.readiness_label ? ` · ${rec.readiness_label}` : ""}`}
    </Badge>
  );
}

/** Readiness ring + today's split + the plan in one sentence. */
export function ReadinessSummary({ rec }: { rec: WorkoutRecommendation }) {
  const score = rec.readiness_score;
  return (
    <div className="flex items-start gap-4">
      <MetricRing value={score !== null ? score / 100 : 0} accent="sleep" size={84} stroke={8} label={`Readiness ${score ?? "not available"} out of 100`}>
        <span className="text-xl font-semibold leading-none text-slate-900">
          <AnimatedNumber value={score} />
        </span>
        <span className="mt-0.5 text-[10px] text-slate-500">of 100</span>
      </MetricRing>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {rec.is_rest_day ? (
            <Badge tone="info">
              <BedDouble className="h-3 w-3" /> Rest & recovery day
            </Badge>
          ) : (
            <SplitChip split={rec.split_today}>{humanize(rec.split_today)} day</SplitChip>
          )}
          <ReadinessBadge rec={rec} />
          <InfoTip term="readiness" />
        </div>
        <p className="text-sm leading-relaxed text-slate-700">{rec.recommendation}</p>
      </div>
    </div>
  );
}

/** Adjustments, suggested exercises and nutrition timing (everything below the headline). */
export function PlanDetails({ rec, compact = false }: { rec: WorkoutRecommendation; compact?: boolean }) {
  const { simple } = usePrefs();
  const hasAcwr = rec.acwr !== null && rec.acwr !== undefined;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {rec.volume_modifier !== null && (
          <Badge tone="brand">
            <Gauge className="h-3 w-3" />
            {simple ? (rec.volume_modifier < 1 ? `Do ~${Math.round((1 - rec.volume_modifier) * 100)}% fewer sets` : "Normal number of sets") : `Volume ×${fmt(rec.volume_modifier, 2)}`}
          </Badge>
        )}
        {rec.rpe_cap !== null && <Badge tone="neutral">{simple ? `Effort limit ${rec.rpe_cap}/10` : `RPE cap ${rec.rpe_cap}`}</Badge>}
        {hasAcwr && (
          <Badge tone={rec.acwr_zone ? ACWR_ZONE[rec.acwr_zone].tone : "neutral"}>
            {simple && rec.acwr_zone ? ACWR_PLAIN[rec.acwr_zone] : `ACWR ${fmt(rec.acwr, 2)}${rec.acwr_zone ? ` · ${ACWR_ZONE[rec.acwr_zone].label}` : ""}`}
          </Badge>
        )}
        {!simple && rec.readiness_mode && <Badge tone={rec.readiness_mode === "personal_model" ? "ok" : "neutral"}>{READINESS_MODE[rec.readiness_mode]}</Badge>}
        <span className="flex items-center gap-1">
          <InfoTip term="volume_modifier" />
          <InfoTip term="rpe" />
          {hasAcwr && <InfoTip term="acwr" />}
          {rec.readiness_mode && <InfoTip term="readiness_model" />}
        </span>
      </div>

      {rec.adjustments.length > 0 && (
        <ul className="space-y-1.5 text-[13px] leading-relaxed text-slate-600">
          {rec.adjustments.map((a, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
              {a}
            </li>
          ))}
        </ul>
      )}

      {!compact && rec.suggested_exercises.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-500">Suggested exercises</p>
          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {rec.suggested_exercises.map((e, i) => (
              <li key={i} className="fade-up flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-slate-50/80" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{e.name}</p>
                  {e.notes && <p className="mt-0.5 text-xs text-slate-500">{e.notes}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="num whitespace-nowrap text-sm font-semibold text-slate-900">
                    {e.sets} × {e.reps}
                  </span>
                  <span className="num whitespace-nowrap text-[11px] text-slate-500">RPE {e.rpe ?? "—"}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {rec.nutrition_timing.length > 0 && (
        <div className="rounded-xl border border-line bg-slate-50/70 p-3.5">
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-800">
            <IconBubble accent="kcal" className="h-7 w-7 rounded-lg">
              <Utensils className="h-3.5 w-3.5" />
            </IconBubble>
            Nutrition timing
          </p>
          <ul className="space-y-1.5 text-[13px] leading-relaxed text-slate-600">
            {rec.nutrition_timing.map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-acc-kcal" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RecommendationPanel({ rec, compact = false }: { rec: WorkoutRecommendation; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <ReadinessSummary rec={rec} />
      <PlanDetails rec={rec} compact={compact} />
    </div>
  );
}
