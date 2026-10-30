"use client";

import { Scale, Zap } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ACCENT, AnimatedNumber, type Accent } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import type { GlossaryKey } from "@/config/glossary";
import { fmt } from "@/lib/format";
import type { EnergyBreakdown } from "@/lib/types";
import { cn } from "@/lib/utils";

const parts: { key: "bmr" | "neat" | "tef" | "exercise"; label: string; accent: Accent; term: GlossaryKey }[] = [
  { key: "bmr", label: "BMR (Mifflin–St Jeor)", accent: "sleep", term: "bmr" },
  { key: "neat", label: "NEAT (steps & daily movement)", accent: "water", term: "neat" },
  { key: "tef", label: "TEF (digesting food)", accent: "protein", term: "tef" },
  { key: "exercise", label: "Exercise (MET)", accent: "burn", term: "met" },
];

const pctOf = (v: number | null, max: number) => `${Math.max(0, Math.min(100, ((v ?? 0) / max) * 100))}%`;

/** BMR + NEAT + TEF + exercise stacked into one "burned" bar, food eaten under it on the same scale, deficit = the gap. */
export function EnergyCard({ energy }: { energy: EnergyBreakdown }) {
  const tdee = energy.tdee ?? parts.reduce((a, p) => a + (energy[p.key] ?? 0), 0);
  const max = Math.max(tdee, energy.intake ?? 0, 1);
  const d = energy.deficit;

  return (
    <Card className="fade-up">
      <CardHeader info="deficit" title="Energy balance" description="Deficit = TDEE − food intake (never intake − exercise)" icon={<Zap className="h-4 w-4" />} />
      <CardBody className="space-y-5">
        {/* Burned vs eaten on one scale */}
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-1 text-[13px] font-medium text-slate-600">
                TDEE (total expenditure) <InfoTip term="tdee" />
              </span>
              <span className="num text-lg font-semibold text-slate-900">
                {energy.tdee !== null ? <AnimatedNumber value={energy.tdee} /> : <span className="text-sm font-medium text-slate-400">pending</span>}
                {energy.tdee !== null && <span className="ml-1 text-xs font-normal text-slate-500">kcal</span>}
              </span>
            </div>
            <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`Burned: ${parts.map((p) => `${p.label} ${fmt(energy[p.key])} kcal`).join(", ")}`}>
              {parts.map((p) =>
                energy[p.key] ? <div key={p.key} className={cn("h-full transition-[width] duration-700 first:rounded-l-full last:rounded-r-full", ACCENT[p.accent].solid)} style={{ width: pctOf(energy[p.key], max) }} title={`${p.label}: ${fmt(energy[p.key])} kcal`} /> : null,
              )}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-slate-600">Food intake</span>
              <span className="num text-lg font-semibold text-slate-900">
                {energy.intake !== null ? <AnimatedNumber value={energy.intake} /> : <span className="text-sm font-medium text-slate-400">pending</span>}
                {energy.intake !== null && <span className="ml-1 text-xs font-normal text-slate-500">kcal</span>}
              </span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200">
              <div className={cn("h-full rounded-full transition-[width] duration-700", ACCENT.kcal.solid)} style={{ width: pctOf(energy.intake, max) }} />
            </div>
          </div>
        </div>

        {/* What the burn is made of */}
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {parts.map((p) => {
            const v = energy[p.key];
            return (
              <li key={p.key} className="flex items-center gap-2.5 rounded-lg py-1.5 text-[13px]">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", ACCENT[p.accent].solid)} aria-hidden />
                <span className="flex min-w-0 flex-1 items-center gap-1 text-slate-600">
                  <span className="truncate">{p.label}</span>
                  <InfoTip term={p.term} />
                </span>
                <span className="num shrink-0 font-medium text-slate-900">{v !== null ? `${fmt(v)} kcal` : "pending"}</span>
                {v !== null && tdee > 0 && <span className="num w-9 shrink-0 text-right text-xs text-slate-400">{Math.round((v / tdee) * 100)}%</span>}
              </li>
            );
          })}
        </ul>

        {/* Result */}
        <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5", d === null ? "border-warn-border bg-warn-bg" : cn(ACCENT.balance.border, ACCENT.balance.tint))}>
          <span className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-card", d === null ? "text-warn-fg" : ACCENT.balance.text)}>
              <Scale className="h-4 w-4" />
            </span>
            Deficit <InfoTip term={d === null ? "pending_biometrics" : "deficit"} />
          </span>
          <span className={cn("num text-right font-semibold", d === null ? "text-sm text-warn-fg" : "text-[22px] tracking-tight text-slate-900")}>
            {d !== null ? (
              <>
                <AnimatedNumber value={d} /> <span className="text-sm font-normal text-slate-500">kcal</span>
              </>
            ) : (
              "Pending Biometric Confirmation"
            )}
          </span>
        </div>

        {energy.notes.length > 0 && (
          <ul className="space-y-1 text-xs leading-relaxed text-slate-500">
            {energy.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                {n}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
