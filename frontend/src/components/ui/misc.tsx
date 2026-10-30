"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} {...props} />;
}

interface ProgressProps {
  value: number | null | undefined;
  max?: number;
  className?: string;
  barClassName?: string;
}

export function Progress({ value, max = 100, className, barClassName }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, ((value ?? 0) / (max || 1)) * 100));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200", className)}>
      <div className={cn("h-full rounded-full bg-gradient-to-r from-[rgb(var(--hero-from))] to-[rgb(var(--hero-via))] transition-all duration-700", barClassName)} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  id?: string;
  /** Accessible name when there is no visible text label. */
  ariaLabel?: string;
}

export function Switch({ checked, onChange, disabled, label, id, ariaLabel }: SwitchProps) {
  return (
    <label className={cn("inline-flex min-h-[44px] cursor-pointer select-none items-center gap-2.5", disabled && "cursor-not-allowed opacity-50")}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          checked ? "bg-gradient-to-r from-[rgb(var(--hero-from))] to-[rgb(var(--hero-via))]" : "bg-slate-300",
        )}
      >
        <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </button>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </label>
  );
}

interface TabsProps<T extends string> {
  tabs: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn("glass scrollbar-thin flex gap-1 overflow-x-auto rounded-2xl border p-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all",
            value === t.value ? "btn-3d text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", value === t.value ? "bg-white/25 text-white" : "bg-slate-200 text-slate-600")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (value: T) => void;
}

/** Small pill selector, good for 1–10 scales and enum choices on mobile. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-[40px] rounded-xl border px-3.5 text-sm font-medium transition-all active:scale-95",
            value === o.value ? "btn-3d border-transparent text-white" : "border-line bg-card text-slate-700 hover:border-brand-500/40 hover:bg-card/90",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
