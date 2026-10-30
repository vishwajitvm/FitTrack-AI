"use client";

import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/info-tip";
import { ACCENT, IconBubble, Sparkline, useTilt, type Accent } from "@/components/ui/fx";
import type { GlossaryKey } from "@/config/glossary";
import { cn } from "@/lib/utils";

type Tone = "default" | "critical" | "warning" | "ok";

// The card itself stays neutral; the tone shows as a small pill with a dot (colour never carries meaning alone).
const statusClass: Record<Tone, string> = {
  default: "bg-slate-100 text-slate-700",
  critical: "bg-crit-bg text-crit-fg",
  warning: "bg-warn-bg text-warn-fg",
  ok: "bg-good-bg text-good-fg",
};

const dotClass: Record<Tone, string> = {
  default: "bg-slate-400",
  critical: "bg-crit-fg",
  warning: "bg-warn-fg",
  ok: "bg-good-fg",
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  /** Glossary key for a "?" next to the label. */
  info?: GlossaryKey;
  /** Status in words ("Too low", "Good"…) so meaning never relies on colour alone. */
  status?: string;
  /** Metric colour: tinted icon bubble, a coloured top edge and the sparkline. */
  accent?: Accent;
  /** Recent values for a small trend line under the number. */
  spark?: (number | null)[];
  children?: ReactNode;
}

export function StatCard({ label, value, unit, sub, icon, tone = "default", info, status, accent, spark, children }: StatCardProps) {
  const tilt = useTilt<HTMLDivElement>(5);
  return (
    <div ref={tilt} className="glass tilt relative overflow-hidden rounded-3xl border p-4 sm:p-5">
      {accent && <span className={cn("pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-90 blur-2xl", ACCENT[accent].tint)} aria-hidden />}
      <div className="relative flex items-start justify-between gap-2">
        <p className="flex min-w-0 flex-wrap items-center gap-1 text-[13px] font-medium leading-tight text-slate-500">
          {label}
          {info && <InfoTip term={info} />}
        </p>
        {icon && (accent ? <IconBubble accent={accent} className="h-7 w-7 sm:h-8 sm:w-8">{icon}</IconBubble> : <span className="text-slate-400">{icon}</span>)}
      </div>
      <div className="relative mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="num text-[26px] font-bold leading-none tracking-tight text-slate-900 sm:text-[30px]">
          {value}
          {unit && <span className="ml-1 text-sm font-normal tracking-normal text-slate-500">{unit}</span>}
        </p>
        {status && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", statusClass[tone])}>
            <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[tone])} />
            {status}
          </span>
        )}
      </div>
      {sub && <div className="relative mt-2 text-[13px] leading-snug text-slate-500">{sub}</div>}
      {accent && spark && spark.filter((v) => v !== null).length > 1 && <Sparkline values={spark} accent={accent} height={30} className="relative mt-3" />}
      {children && <div className="relative">{children}</div>}
    </div>
  );
}

interface InfoRowProps {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

export function InfoRow({ label, value, className }: InfoRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 text-sm", className)}>
      <span className="text-slate-500">{label}</span>
      <span className="num text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
