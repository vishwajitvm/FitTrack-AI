"use client";

import { Beef, Flame, Scale, TrendingDown } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { usePrefs } from "@/components/layout/prefs-provider";
import { Progress } from "@/components/ui/misc";
import { fmt } from "@/lib/format";
import { tdeeSourceText } from "@/lib/ml-labels";
import type { DailySummary, ProfileMetrics } from "@/lib/types";

interface SummaryCardsProps {
  today: DailySummary;
  /** Last days (oldest first) for the small trend lines. */
  week?: DailySummary[];
  metrics: ProfileMetrics;
  /** Adaptive-TDEE confidence from /api/insights/summary, shown next to the TDEE source. */
  confidence?: number | null;
}

export function SummaryCards({ today, week = [], metrics, confidence }: SummaryCardsProps) {
  const { t, simple } = usePrefs();
  const days = [...week].sort((a, b) => a.date.localeCompare(b.date));
  const series = (pick: (d: DailySummary) => number | null) => days.map((d) => ((d.food_count ?? 1) > 0 ? pick(d) : null));
  const source = tdeeSourceText(today.tdee_source, confidence);
  const proteinTarget = metrics.protein_target_g?.target ?? null;
  const proteinRatio = proteinTarget ? today.total_protein / proteinTarget : null;
  const crash = today.total_calories > 0 && today.total_calories < 1000;
  const intakeTone = crash ? "critical" : "default";
  const nothingYet = !(today.food_count ?? 0); // an empty day isn't "too low" protein or a "too big" deficit yet
  const proteinTone = proteinRatio === null || nothingYet ? "default" : proteinRatio >= 0.9 ? "ok" : proteinRatio >= 0.6 ? "warning" : "critical";
  const proteinWord = proteinRatio === null || nothingYet ? undefined : proteinRatio >= 0.9 ? "Good" : proteinRatio >= 0.6 ? "Almost" : "Too low";
  const deficit = today.calorie_deficit;
  const deficitTone = deficit === null ? "warning" : nothingYet ? "default" : deficit > 1000 ? "critical" : deficit > 0 ? "ok" : "warning";
  const deficitWord = deficit === null ? "Pending" : nothingYet ? "No food yet" : deficit > 1000 ? "Too big" : deficit > 0 ? "Good" : "Over";
  const tdee = today.estimated_tdee;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label={t("Eaten today", "Intake today")}
        value={fmt(today.total_calories)}
        unit="kcal"
        icon={<Flame className="h-4 w-4" />}
        accent="kcal"
        spark={series((d) => d.total_calories)}
        tone={intakeTone}
        status={crash ? "Too low" : undefined}
        sub={simple ? (tdee !== null ? `of ~${fmt(tdee)} kcal you burn` : crash ? "Eat a proper meal before the gym" : undefined) : `P ${fmt(today.total_protein)}g · C ${fmt(today.total_carbs)}g · F ${fmt(today.total_fat)}g`}
      />
      <StatCard
        label={t("Protein", "Protein vs target")}
        info="protein_target"
        value={fmt(today.total_protein)}
        unit={proteinTarget ? `/ ${fmt(proteinTarget)} g` : "g"}
        icon={<Beef className="h-4 w-4" />}
        accent="protein"
        tone={proteinTone}
        status={proteinWord}
        sub={
          simple
            ? proteinTarget && today.total_protein < proteinTarget
              ? `${fmt(proteinTarget - today.total_protein)} g to go — add a scoop or eggs`
              : undefined
            : today.protein_per_kg !== null
              ? `${fmt(today.protein_per_kg, 2)} g/kg body weight`
              : undefined
        }
      >
        {proteinTarget && <Progress value={today.total_protein} max={proteinTarget} className="mt-2 bg-card/70" barClassName="bg-acc-protein" />}
      </StatCard>
      <StatCard
        label={t("Calories burned today", "Estimated TDEE")}
        info="tdee"
        value={tdee !== null ? fmt(tdee) : "Not yet"}
        unit={tdee !== null ? "kcal" : undefined}
        icon={<Scale className="h-4 w-4" />}
        accent="burn"
        spark={series((d) => d.estimated_tdee)}
        sub={
          tdee !== null
            ? simple
              ? source && source !== "formula"
                ? `Learned from your data (${source})`
                : "Resting + moving + exercise"
              : today.tdee_source && today.tdee_source !== "formula"
                ? `Source: ${source}`
                : `BMR ${fmt(today.estimated_bmr)} + exercise ${fmt(today.estimated_exercise_calories)}`
            : "Add age & sex in your profile — or keep logging so your real burn can be learned"
        }
      />
      <StatCard
        label={t("Calories under your burn", "Calorie deficit")}
        info={deficit === null ? "pending_biometrics" : "deficit"}
        value={deficit !== null ? fmt(deficit) : "Not yet"}
        unit={deficit !== null ? "kcal" : undefined}
        icon={<TrendingDown className="h-4 w-4" />}
        accent="balance"
        spark={series((d) => d.calorie_deficit)}
        tone={deficitTone}
        status={deficitWord}
        sub={
          deficit === null
            ? t("Needs your age & sex (Profile)", "Pending Biometric Confirmation")
            : simple
              ? nothingYet
                ? "Log your first meal to see today's balance"
                : deficit > 1000
                ? "Too aggressive — eat ~300–500 kcal more"
                : deficit > 0
                  ? "Good for losing fat"
                  : "You ate more than you burned"
              : `${deficit > 0 ? "TDEE − food intake" : "Surplus today"}${source ? ` · ${source}` : ""}`
        }
      />
    </div>
  );
}
