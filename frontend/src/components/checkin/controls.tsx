"use client";

import type { ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { ACCENT, IconBubble, type Accent } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import type { GlossaryKey } from "@/config/glossary";
import { cn } from "@/lib/utils";

/** One question in the check-in: tinted icon, label, "?" tip, the current answer on the right, then the control. */
export function Question({
  icon,
  accent,
  label,
  info,
  answer,
  children,
  className,
}: {
  icon: ReactNode;
  accent: Accent;
  label: ReactNode;
  info?: GlossaryKey;
  /** Current answer in words; `null`/"" shows "Not set", `undefined` shows nothing (the control already shows it). */
  answer?: ReactNode | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-3">
        <IconBubble accent={accent} className="h-8 w-8">
          {icon}
        </IconBubble>
        <p className="flex min-w-0 flex-1 items-center gap-1 text-sm font-medium text-slate-900">
          {label}
          {info && <InfoTip term={info} />}
        </p>
        {answer !== undefined && <span className={cn("shrink-0 text-[13px] font-medium", answer ? ACCENT[accent].text : "text-slate-400")}>{answer || "Not set"}</span>}
      </div>
      {children}
    </div>
  );
}

export interface FaceOption {
  value: number;
  title: string;
  Icon: LucideIcon;
}

/** Simple mode: five big face buttons with a word under each (value is still stored on the 1–10 scale). */
export function FaceScale({ options, value, onChange, accent, ariaLabel }: { options: FaceOption[]; value: number | null; onChange: (v: number) => void; accent: Accent; ariaLabel: string }) {
  const a = ACCENT[accent];
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {options.map(({ value: v, title, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={title}
            title={title}
            onClick={() => onChange(v)}
            className={cn(
              "flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              active ? cn(a.tint, a.text, "border-current shadow-sm") : "border-line bg-card text-slate-400 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600",
            )}
          >
            <Icon className={cn("h-6 w-6 transition-transform", active && "scale-110")} strokeWidth={active ? 2.25 : 1.75} />
            <span className={cn("text-center text-[11px] font-medium leading-tight", active ? "" : "text-slate-500")}>{title}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Detailed mode: 1–10 cells; everything up to the answer fills softly so it reads like a slider. */
export function NumberScale({ value, onChange, accent, ariaLabel }: { value: number | null; onChange: (v: number) => void; accent: Accent; ariaLabel: string }) {
  const a = ACCENT[accent];
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = value === n;
        const filled = value !== null && n < value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(n)}
            className={cn(
              "num min-h-[44px] rounded-xl border text-sm font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              active ? cn(a.tint, a.text, "border-current shadow-sm") : filled ? cn(a.tint, a.text, "border-transparent opacity-70") : "border-line bg-card text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

/** Single choice as large chips (radio semantics). */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  dot,
}: {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  ariaLabel: string;
  /** Optional coloured dot per option (status colours). */
  dot?: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              active ? "border-navy bg-navy text-white shadow-sm" : "border-line bg-card text-slate-700 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {dot && <span className={cn("h-2 w-2 rounded-full", active ? "bg-white" : dot(o.value))} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select chip with a tick when on. */
export function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        active ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-line bg-card text-slate-700 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      {active && <Check className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

/** Small section divider inside a long form. */
export function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h4 className="text-[13px] font-semibold text-slate-900">{title}</h4>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
