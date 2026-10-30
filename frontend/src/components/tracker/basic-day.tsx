"use client";

import type { ReactNode } from "react";
import { Beef, CalendarDays, CheckCircle2, Dumbbell, Scale, TrendingDown, Utensils, XCircle } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { usePrefs } from "@/components/layout/prefs-provider";
import { AnimatedNumber, MetricRing, MiniBar } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import { fmt, humanize, prettyDate, today } from "@/lib/format";
import { tdeeSourceText } from "@/lib/ml-labels";
import type { DailyDetail } from "@/lib/types";

type Tone = "default" | "critical" | "warning" | "ok";

export function BasicDay({ detail }: { detail: DailyDetail }) {
  const { t } = usePrefs();
  const s = detail.summary;
  const trained = detail.sessions.length > 0 || detail.workouts.length > 0;
  const split = detail.sessions[0]?.split;
  const d = s.calorie_deficit;

  const eatenTone: Tone = s.total_calories > 0 && s.total_calories < 1000 ? "critical" : "default";
  const proteinTone: Tone = s.protein_per_kg === null ? "default" : s.protein_per_kg >= 1.6 ? "ok" : s.protein_per_kg >= 1.2 ? "warning" : "critical";
  const proteinStatus = s.protein_per_kg === null ? undefined : s.protein_per_kg >= 1.6 ? "On target" : s.protein_per_kg >= 1.2 ? "A bit low" : "Too low";
  // The crash-deficit warning only applies to completed days; today is still in progress.
  const completed = s.date < today();
  const deficitTone: Tone = d === null ? "warning" : d > 1000 ? (completed ? "critical" : "default") : d > 0 ? "ok" : "warning";
  const deficitStatus = d === null ? "Pending" : d > 1000 ? (completed ? "Too big" : "Day in progress") : d > 0 ? t("Good", "In deficit") : "Surplus";

  const cards: { key: string; node: ReactNode; wide?: boolean }[] = [
    {
      key: "eaten",
      node: (
        <StatCard
          label={t("Eaten", "Calories eaten")}
          value={<AnimatedNumber value={s.total_calories} />}
          unit="kcal"
          icon={<Utensils className="h-4 w-4" />}
          accent="kcal"
          tone={eatenTone}
          status={eatenTone === "critical" ? "Very low" : undefined}
          sub={`${detail.foods.length} item${detail.foods.length === 1 ? "" : "s"} logged`}
        />
      ),
    },
    {
      key: "protein",
      node: (
        <StatCard
          label="Protein"
          info="protein_per_kg"
          value={<AnimatedNumber value={s.total_protein} digits={1} />}
          unit="g"
          icon={<Beef className="h-4 w-4" />}
          accent="protein"
          sub={s.protein_per_kg !== null ? `${fmt(s.protein_per_kg, 2)} g/kg · goal 1.6+` : undefined}
          tone={proteinTone}
          status={proteinStatus}
        >
          {s.protein_per_kg !== null && <MiniBar value={s.protein_per_kg} max={1.6} accent="protein" className="mt-3" />}
        </StatCard>
      ),
    },
    {
      key: "weight",
      node: (
        <StatCard
          label="Morning weight"
          info="morning_weight"
          value={s.morning_weight !== null ? <AnimatedNumber value={s.morning_weight} digits={1} /> : "—"}
          unit={s.morning_weight !== null ? "kg" : undefined}
          icon={<Scale className="h-4 w-4" />}
          accent="weight"
          sub={s.morning_weight === null ? "Not logged — use Check-in" : undefined}
        />
      ),
    },
    {
      key: "deficit",
      node: (
        <StatCard
          label={t("Under your burn", "Deficit")}
          info={d === null ? "pending_biometrics" : "deficit"}
          value={d !== null ? <AnimatedNumber value={d} /> : "Pending"}
          unit={d !== null ? "kcal" : undefined}
          icon={<TrendingDown className="h-4 w-4" />}
          accent="balance"
          tone={deficitTone}
          status={deficitStatus}
          sub={d === null ? "Pending Biometric Confirmation" : `TDEE ${fmt(s.estimated_tdee)} kcal${s.tdee_source ? ` · ${tdeeSourceText(s.tdee_source)}` : ""}`}
        />
      ),
    },
    {
      key: "workout",
      wide: true,
      node: (
        <StatCard
          label="Workout"
          info="lifting_once"
          value={
            s.is_rest_day && !trained ? (
              "Rest day"
            ) : trained ? (
              <span className="flex items-center gap-1.5 text-good-fg">
                <CheckCircle2 className="h-5 w-5" /> Done
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-400">
                <XCircle className="h-5 w-5" /> Not yet
              </span>
            )
          }
          icon={<Dumbbell className="h-4 w-4" />}
          accent="burn"
          sub={trained ? `${split ? humanize(split) + " · " : ""}${fmt(s.estimated_exercise_calories)} kcal burned` : undefined}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <DayHero detail={detail} trained={trained} split={split} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c, i) => (
          <div key={c.key} className={`fade-up [&>div]:h-full ${c.wide ? "col-span-2 md:col-span-1" : ""}`} style={{ animationDelay: `${80 + i * 50}ms` }}>
            {c.node}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The one gradient block: the day's energy balance in a sentence plus two progress rings. */
function DayHero({ detail, trained, split }: { detail: DailyDetail; trained: boolean; split: string | undefined }) {
  const { t } = usePrefs();
  const s = detail.summary;
  const d = s.calorie_deficit;
  const tdee = s.estimated_tdee;
  const eatenShare = tdee ? s.total_calories / tdee : null;

  return (
    <section className="fade-up relative overflow-hidden rounded-3xl bg-hero p-6 text-white shadow-card sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-white/80">
            <CalendarDays className="h-3.5 w-3.5" />
            {prettyDate(s.date, { weekday: "long", day: "numeric", month: "long" })}
            {s.day_number !== null && ` · Day ${s.day_number}`}
            {s.is_rest_day && " · Rest day"}
          </p>
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-2xl font-bold leading-tight sm:text-3xl">
            {d === null ? (
              "Burn not calculated yet"
            ) : d === 0 ? (
              "Right at your burn"
            ) : (
              <>
                <span className="num">
                  <AnimatedNumber value={Math.abs(d)} />
                </span>
                <span>
                  kcal {d > 0 ? t("under your burn", "deficit") : t("over your burn", "surplus")}
                </span>
              </>
            )}
            <InfoTip term={d === null ? "pending_biometrics" : "deficit"} tone="light" className="self-center text-white/70 hover:text-white" />
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-white/85">
            {d === null
              ? "Add your age and sex in Profile so the app can work out how much you burn (Pending Biometric Confirmation)."
              : `You ate ${fmt(s.total_calories)} of the ${fmt(tdee)} kcal you burned${s.tdee_source ? ` (${tdeeSourceText(s.tdee_source)})` : ""}.`}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Chip icon={trained ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Dumbbell className="h-3.5 w-3.5" />}>
              {trained ? `Trained${split ? ` · ${humanize(split)}` : ""}` : s.is_rest_day ? "Recovery day" : "No workout yet"}
            </Chip>
            {s.morning_weight !== null && <Chip icon={<Scale className="h-3.5 w-3.5" />}>{fmt(s.morning_weight, 1)} kg</Chip>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 self-start rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur sm:gap-6 lg:self-auto">
          <HeroRing label="Of burn eaten" value={eatenShare} center={eatenShare !== null ? `${Math.round(eatenShare * 100)}%` : "—"} sub={tdee ? `${fmt(s.total_calories)} / ${fmt(tdee)}` : "burn pending"} />
          <HeroRing
            label="Protein goal"
            value={s.protein_per_kg !== null ? s.protein_per_kg / 1.6 : null}
            center={`${fmt(s.total_protein)} g`}
            sub={s.protein_per_kg !== null ? `${fmt(s.protein_per_kg, 2)} of 1.6 g/kg` : "add weight"}
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

function HeroRing({ label, value, center, sub }: { label: string; value: number | null; center: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <MetricRing value={value ?? 0} accent="balance" onHero size={92} stroke={8} label={`${label}: ${center}`}>
        <span className="num text-base font-bold leading-none">{center}</span>
      </MetricRing>
      <span className="text-xs font-semibold">{label}</span>
      <span className="num -mt-1 text-[11px] text-white/75">{sub}</span>
    </div>
  );
}
