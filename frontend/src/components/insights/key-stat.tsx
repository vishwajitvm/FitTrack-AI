import type { ReactNode } from "react";
import type { BadgeTone } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import type { GlossaryKey } from "@/config/glossary";
import { cn } from "@/lib/utils";

/** Compact "label + big number + small print" tile used inside insight cards. */
export function KeyStat({ label, term, value, sub, className, children }: { label: string; term?: GlossaryKey; value: ReactNode; sub?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-line bg-slate-50/70 p-3.5", className)}>
      <p className="flex items-center gap-1 text-[13px] font-medium text-slate-500">
        {label}
        {term && <InfoTip term={term} />}
      </p>
      <p className="num mt-1.5 text-xl font-semibold leading-tight tracking-tight text-slate-900">{value}</p>
      {sub && <div className="mt-1 text-xs leading-snug text-slate-500">{sub}</div>}
      {children}
    </div>
  );
}

/** Badge tones → StatCard tones (StatCard has no "info"/"brand" tone). */
export function statTone(tone: BadgeTone | undefined): "default" | "critical" | "warning" | "ok" {
  return tone === "critical" || tone === "warning" || tone === "ok" ? tone : "default";
}
