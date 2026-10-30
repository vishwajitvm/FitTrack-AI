"use client";

import { Battery, Flame, Scale, SearchCheck } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { AnimatedNumber } from "@/components/ui/fx";
import { useAnomalies, useExpenditureInsight, useReadinessModel, useWeightInsight } from "@/hooks/use-insights";
import { fmt, pct } from "@/lib/format";
import { RATE_STATUS, READINESS_MODE } from "@/lib/ml-labels";
import { statTone } from "./key-stat";

/**
 * Four headline numbers at the top of the page. Uses the same hooks and arguments as the
 * sections below, so SWR serves them from one shared request each.
 */
export function InsightsSummary() {
  const { data: w } = useWeightInsight(90);
  const { data: e } = useExpenditureInsight(90);
  const { data: r } = useReadinessModel();
  const { data: a } = useAnomalies(30);

  const rate = w ? (RATE_STATUS[w.rate_status] ?? RATE_STATUS.insufficient_data) : null;
  const burn = e ? (e.adaptive_tdee ?? e.blended_tdee ?? e.formula_tdee) : null;
  const warnings = a?.filter((x) => x.severity === "warning").length ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="fade-up">
        <StatCard
          label="Trend weight"
          info="trend_weight"
          accent="weight"
          icon={<Scale className="h-4 w-4" />}
          value={w?.trend_weight != null ? <AnimatedNumber value={w.trend_weight} digits={1} /> : "—"}
          unit={w?.trend_weight != null ? "kg" : undefined}
          tone={statTone(rate?.tone)}
          status={rate && w?.rate_status !== "insufficient_data" ? rate.label.split(" —")[0] : undefined}
          sub={w?.rate_kg_per_week != null ? `${w.rate_kg_per_week > 0 ? "+" : ""}${fmt(w.rate_kg_per_week, 2)} kg a week` : "needs a few weigh-ins"}
          spark={w?.points.slice(-30).map((p) => p.trend)}
        />
      </div>
      <div className="fade-up" style={{ animationDelay: "50ms" }}>
        <StatCard
          label="Real calorie burn"
          info="adaptive_tdee"
          accent="burn"
          icon={<Flame className="h-4 w-4" />}
          value={burn != null ? <AnimatedNumber value={burn} /> : "—"}
          unit={burn != null ? "kcal" : undefined}
          sub={e ? (e.adaptive_tdee !== null ? `${pct(e.confidence)} confidence` : "still learning from your log") : undefined}
          spark={e?.points.slice(-30).map((p) => p.expenditure)}
        />
      </div>
      <div className="fade-up" style={{ animationDelay: "100ms" }}>
        <StatCard
          label="Predicted energy"
          info="readiness_model"
          accent="sleep"
          icon={<Battery className="h-4 w-4" />}
          value={r?.prediction_today != null ? <AnimatedNumber value={r.prediction_today} digits={1} /> : "—"}
          unit={r?.prediction_today != null ? "/ 10" : undefined}
          sub={r ? (r.mode === "personal_model" ? `${READINESS_MODE[r.mode]} · today` : `${r.samples}/${r.min_samples} check-ins to unlock`) : undefined}
        />
      </div>
      <div className="fade-up" style={{ animationDelay: "150ms" }}>
        <StatCard
          label="Data checks"
          info="anomalies"
          icon={<SearchCheck className="h-4 w-4" />}
          value={a ? a.length : "—"}
          unit={a ? (a.length === 1 ? "finding" : "findings") : undefined}
          tone={a ? (warnings ? "warning" : "ok") : "default"}
          status={a ? (warnings ? "Review" : "Looks clean") : undefined}
          sub="last 30 days"
        />
      </div>
    </div>
  );
}
