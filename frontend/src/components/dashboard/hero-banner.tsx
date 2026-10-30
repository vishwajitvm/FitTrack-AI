"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Flame, MessageCircle, Scale, Sparkles } from "lucide-react";
import { AnimatedNumber, MetricRing, useTilt } from "@/components/ui/fx";
import { useProfile } from "@/hooks/use-profile";
import { fmt } from "@/lib/format";
import type { Dashboard, DailySummary } from "@/lib/types";
import { cn } from "@/lib/utils";

function greeting(hour: number) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Days in a row with something logged, counting back from today (or yesterday if today is still empty). */
export function streakOf(week: DailySummary[]): number {
  const days = [...week].sort((a, b) => b.date.localeCompare(a.date));
  const logged = (d: DailySummary) => (d.food_count ?? 0) > 0 || !!d.has_workout || d.morning_weight !== null;
  let i = days.length && !logged(days[0]) ? 1 : 0;
  let n = 0;
  for (; i < days.length && logged(days[i]); i++) n++;
  return n;
}

/** The colourful top of the dashboard: who, which day, three rings for today and quick links. */
export function HeroBanner({ data, className }: { data: Dashboard; className?: string }) {
  const { data: profile } = useProfile();
  const tilt = useTilt<HTMLElement>(2);
  const t = data.today;
  const m = data.profile_metrics;
  const proteinTarget = m.protein_target_g?.target ?? null;
  const calorieTarget = m.calorie_target;
  const streak = streakOf(data.week);
  const first = profile?.name?.split(" ")[0];
  const name = first ? first.charAt(0).toUpperCase() + first.slice(1) : null;
  const deficit = t.calorie_deficit;

  return (
    <section ref={tilt} className={cn("tilt relative flex flex-col justify-center overflow-hidden rounded-[28px] bg-hero p-6 text-white shadow-pop sm:p-8", className)}>
      {/* drifting colour inside the hero only */}
      <div className="blob -right-10 -top-16 h-64 w-64 bg-[rgb(255_255_255/0.22)]" aria-hidden />
      <div className="blob -bottom-24 left-1/4 h-64 w-64 bg-[rgb(var(--acc-water)/0.45)] [animation-delay:-5s]" aria-hidden />
      <div className="blob right-1/3 top-1/3 h-40 w-40 bg-[rgb(var(--acc-kcal)/0.35)] [animation-delay:-10s]" aria-hidden />

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/80">
            <CalendarDays className="h-3.5 w-3.5" /> {t.weekday} · Day {t.day_number ?? "—"}
            {t.is_rest_day ? " · Rest day" : ""}
          </p>
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {greeting(new Date().getHours())}
            {name ? `, ${name}` : ""} <span aria-hidden>👋</span>
          </h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <Chip icon={<Flame className="h-3.5 w-3.5" />}>
              {streak > 0 ? `${streak}-day logging streak` : "Start your streak today"}
            </Chip>
            {t.morning_weight !== null && (
              <Chip icon={<Scale className="h-3.5 w-3.5" />}>
                {fmt(t.morning_weight, 1)} kg{m.weight_change_kg ? ` (${m.weight_change_kg > 0 ? "+" : ""}${fmt(m.weight_change_kg, 1)})` : ""}
              </Chip>
            )}
            {(t.has_workout || t.is_rest_day) && <Chip>{t.is_rest_day ? "Recovery day" : "Trained today ✓"}</Chip>}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/ask" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-semibold text-[rgb(var(--hero-from))] shadow-sm transition hover:scale-[1.02] active:scale-95">
              <MessageCircle className="h-4 w-4" /> Ask about your progress
            </Link>
            <Link href="/history" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white/15 px-3.5 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25">
              <Sparkles className="h-4 w-4" /> See your history
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-3xl bg-white/10 p-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] ring-1 ring-white/20 backdrop-blur-md sm:gap-4 sm:p-4">
          <HeroRing label="Eaten" value={t.total_calories} max={calorieTarget} unit="kcal" sub={calorieTarget ? `of ${fmt(calorieTarget)}` : "kcal"} />
          <HeroRing label="Protein" value={t.total_protein} max={proteinTarget} unit="g" sub={proteinTarget ? `of ${fmt(proteinTarget)} g` : "g"} />
          <HeroRing
            label={deficit !== null && deficit < 0 ? "Surplus" : "Deficit"}
            value={deficit !== null ? Math.abs(deficit) : null}
            max={750}
            unit="kcal"
            sub={deficit === null ? "needs profile" : !t.food_count ? "nothing logged yet" : deficit > 1000 ? "too big" : deficit > 0 ? "goal 500–750" : "over burn"}
          />
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

function HeroRing({ label, value, max, unit, sub }: { label: string; value: number | null; max: number | null; unit: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <MetricRing value={value !== null && max ? value / max : 0} accent="balance" onHero size={84} stroke={8} label={`${label}: ${fmt(value)} ${unit}`}>
        <span className="text-base font-bold leading-none">
          <AnimatedNumber value={value} />
        </span>
        <span className="text-[10px] text-white/80">{unit}</span>
      </MetricRing>
      <span className="text-xs font-semibold">{label}</span>
      <span className="-mt-1 text-[10px] text-white/75">{sub}</span>
    </div>
  );
}
