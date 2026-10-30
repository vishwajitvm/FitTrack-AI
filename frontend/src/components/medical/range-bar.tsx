import { Badge, type BadgeTone } from "@/components/ui/badge";
import { fmt } from "@/lib/format";
import type { BiomarkerStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Word, badge tone and dot colour for each biomarker status (meaning never relies on colour alone). */
export const STATUS_META: Record<BiomarkerStatus, { label: string; tone: BadgeTone; dot: string; edge: string }> = {
  normal: { label: "Normal", tone: "ok", dot: "bg-good-fg", edge: "" },
  low: { label: "Low", tone: "critical", dot: "bg-crit-fg", edge: "shadow-[inset_3px_0_0_0_rgb(var(--crit-fg))]" },
  high: { label: "High", tone: "critical", dot: "bg-crit-fg", edge: "shadow-[inset_3px_0_0_0_rgb(var(--crit-fg))]" },
  borderline: { label: "Borderline", tone: "warning", dot: "bg-warn-fg", edge: "shadow-[inset_3px_0_0_0_rgb(var(--warn-fg))]" },
  unknown: { label: "Unknown", tone: "neutral", dot: "bg-slate-400", edge: "" },
};

export function StatusPill({ status, className }: { status: BiomarkerStatus; className?: string }) {
  const m = STATUS_META[status] ?? STATUS_META.unknown;
  return (
    <Badge tone={m.tone} className={className}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </Badge>
  );
}

const num = (v: number) => fmt(v, v % 1 ? 2 : 0);

/**
 * Where a value sits relative to the lab's reference range: a track with the normal zone shaded
 * and a dot for the value. Works with only a low or only a high limit. Renders nothing without a value or range.
 */
export function RangeBar({ value, low, high, status, className }: { value: number | null; low: number | null; high: number | null; status: BiomarkerStatus; className?: string }) {
  if (value === null || (low === null && high === null)) {
    return <p className={cn("text-xs text-slate-400", className)}>{low === null && high === null ? "No reference range" : "No numeric value"}</p>;
  }
  let min: number;
  let max: number;
  if (low !== null && high !== null) {
    const span = high - low || Math.abs(high) || 1;
    min = low - span * 0.5;
    max = high + span * 0.5;
  } else if (high !== null) {
    min = 0;
    max = high * 1.6 || 1;
  } else {
    min = 0;
    max = (low as number) * 2 || 1;
  }
  min = Math.min(min, value);
  max = Math.max(max, value);
  if (min < 0 && value >= 0 && (low ?? 0) >= 0) min = 0;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min || 1)) * 100));
  const zs = low !== null ? pos(low) : 0;
  const ze = high !== null ? pos(high) : 100;
  const p = pos(value);
  const meta = STATUS_META[status] ?? STATUS_META.unknown;
  const clampLabel = (x: number) => Math.max(8, Math.min(92, x));
  const rangeText = `${low !== null ? num(low) : "…"} – ${high !== null ? num(high) : "…"}`;

  return (
    <div className={cn("w-full min-w-0", className)} role="img" aria-label={`Value ${num(value)}, reference range ${rangeText}, ${meta.label}`}>
      <div className="relative h-2 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 rounded-full bg-good-fg/25" style={{ left: `${zs}%`, width: `${Math.max(2, ze - zs)}%` }} />
        <span
          className={cn("absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-sm transition-[left] duration-700", meta.dot)}
          style={{ left: `${p}%` }}
        />
      </div>
      <div className="num relative mt-1 h-4 whitespace-nowrap text-[11px] text-slate-400">
        {low !== null && high !== null && ze - zs < 22 ? (
          <span className="absolute -translate-x-1/2" style={{ left: `${clampLabel((zs + ze) / 2)}%` }}>
            {rangeText}
          </span>
        ) : null}
        {low !== null && (high === null || ze - zs >= 22) && (
          <span className="absolute -translate-x-1/2" style={{ left: `${clampLabel(zs)}%` }}>
            {num(low)}
          </span>
        )}
        {high !== null && (low === null || ze - zs >= 22) && (
          <span className="absolute -translate-x-1/2" style={{ left: `${clampLabel(ze)}%` }}>
            {num(high)}
          </span>
        )}
      </div>
    </div>
  );
}
