"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Beef, CalendarDays, Flame, Ruler, Scale, Target, User, Utensils } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { AnimatedNumber } from "@/components/ui/fx";
import { fmt, humanize } from "@/lib/format";
import type { Profile, ProfileMetrics } from "@/lib/types";

function initials(name: string | null | undefined): string | null {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const BMI_TONE: Record<string, { tone: "ok" | "warning" | "critical"; status: string }> = {
  Underweight: { tone: "warning", status: "Underweight" },
  Normal: { tone: "ok", status: "Healthy" },
  Overweight: { tone: "warning", status: "Overweight" },
  Obese: { tone: "critical", status: "Obese" },
};

/** Friendly top block: who you are, your weight journey and the four targets the app works out for you. */
export function ProfileSummary({ draft, metrics }: { draft: Profile; metrics: ProfileMetrics | undefined }) {
  const ini = initials(draft.name);
  const start = draft.starting_weight_kg;
  const now = draft.current_weight_kg;
  const target = draft.target_weight_kg;
  const span = start !== null && target !== null ? start - target : null;
  const progress = span && now !== null ? Math.max(0, Math.min(1, (start! - now) / span)) : null;
  const pending = metrics?.bmr_status === "pending";
  const bmi = metrics?.bmi_category ? BMI_TONE[metrics.bmi_category] : undefined;

  return (
    <div className="space-y-4">
      <section className="fade-up relative overflow-hidden rounded-3xl bg-hero p-5 text-white shadow-card sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-semibold ring-1 ring-white/30 backdrop-blur" aria-hidden>
              {ini ?? <User className="h-7 w-7" />}
            </span>
            <div className="min-w-0 space-y-2">
              <h2 className="truncate text-xl font-semibold leading-tight sm:text-2xl">{draft.name?.trim() || "Your profile"}</h2>
              <p className="line-clamp-2 text-sm text-white/85">{draft.goal || "Add a goal below so every tip points the same way."}</p>
              <div className="flex flex-wrap gap-1.5">
                {draft.age !== null && <Chip>{draft.age} yrs</Chip>}
                {draft.sex && <Chip>{humanize(draft.sex)}</Chip>}
                {draft.height_cm !== null && (
                  <Chip icon={<Ruler className="h-3.5 w-3.5" />}>{fmt(draft.height_cm, 0)} cm</Chip>
                )}
                {metrics?.days_tracked ? <Chip icon={<CalendarDays className="h-3.5 w-3.5" />}>{metrics.days_tracked} days tracked</Chip> : null}
                {pending && (
                  <Chip icon={<AlertTriangle className="h-3.5 w-3.5" />}>Needs {metrics!.missing_fields.map(humanize).join(", ").toLowerCase()}</Chip>
                )}
              </div>
            </div>
          </div>

          <div className="w-full rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur lg:max-w-sm">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/85">
              <Target className="h-4 w-4" /> Weight journey
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Journey label="Start" value={start} />
              <Journey label="Now" value={now} strong />
              <Journey label="Target" value={target} />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Progress to target weight" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress !== null ? Math.round(progress * 100) : undefined}>
              <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${(progress ?? 0) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-white/80">
              {progress === null
                ? "Add start, current and target weight to see progress."
                : now !== null && target !== null
                  ? `${Math.round(progress * 100)}% of the way · ${fmt(Math.abs(now - target), 1)} kg to go`
                  : ""}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="fade-up" style={{ animationDelay: "40ms" }}>
          <StatCard
            label="BMI"
            info="bmi"
            accent="weight"
            icon={<Scale className="h-4 w-4" />}
            value={metrics?.bmi != null ? <AnimatedNumber value={metrics.bmi} digits={1} /> : "—"}
            tone={bmi?.tone}
            status={bmi?.status}
            sub={metrics?.bmi == null ? "Needs height and weight" : undefined}
          />
        </div>
        <div className="fade-up" style={{ animationDelay: "90ms" }}>
          <StatCard
            label="Maintenance"
            info="tdee"
            accent="burn"
            icon={<Flame className="h-4 w-4" />}
            value={metrics?.tdee_estimate != null ? <AnimatedNumber value={metrics.tdee_estimate} /> : "—"}
            unit={metrics?.tdee_estimate != null ? "kcal" : undefined}
            sub={metrics?.tdee_estimate == null ? "Pending age and sex" : "Calories you burn a day"}
          />
        </div>
        <div className="fade-up" style={{ animationDelay: "140ms" }}>
          <StatCard
            label="Suggested intake"
            info="deficit"
            accent="kcal"
            icon={<Utensils className="h-4 w-4" />}
            value={metrics?.calorie_target != null ? <AnimatedNumber value={metrics.calorie_target} /> : "—"}
            unit={metrics?.calorie_target != null ? "kcal" : undefined}
            sub={metrics?.calorie_target == null ? "Pending age and sex" : "To lose weight steadily"}
          />
        </div>
        <div className="fade-up" style={{ animationDelay: "190ms" }}>
          <StatCard
            label="Protein target"
            info="protein_target"
            accent="protein"
            icon={<Beef className="h-4 w-4" />}
            value={metrics?.protein_target_g ? <AnimatedNumber value={metrics.protein_target_g.target} /> : "—"}
            unit={metrics?.protein_target_g ? "g / day" : undefined}
            sub={metrics?.protein_target_g ? `Range ${fmt(metrics.protein_target_g.min)}–${fmt(metrics.protein_target_g.max)} g` : "Needs your weight"}
          />
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium ring-1 ring-white/25 backdrop-blur">
      {icon}
      {children}
    </span>
  );
}

function Journey({ label, value, strong }: { label: string; value: number | null; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-xl bg-white/15 px-1 py-1.5" : "px-1 py-1.5"}>
      <p className="text-[11px] text-white/75">{label}</p>
      <p className="num text-lg font-semibold leading-tight">{value !== null ? fmt(value, 1) : "—"}</p>
      <p className="text-[10px] text-white/70">kg</p>
    </div>
  );
}
