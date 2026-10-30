"use client";

import { useRef, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const round = (n: number, step: number) => {
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Number(n.toFixed(decimals));
};

interface StepperProps {
  value: number | null;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  /** Used when value is null and a button is pressed. */
  fallback?: number;
  label?: string;
  size?: "md" | "sm";
  format?: (v: number) => string;
}

/**
 * − value + control with 44px targets (36px in "sm"). The value is also a text box: type any number (e.g. 1022),
 * then Enter or tap away to save; ↑/↓ step, Esc cancels. Typed values are kept within min–max.
 */
export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, unit, fallback, label, size = "md", format }: StepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const base = value ?? fallback ?? min;
  const clamp = (v: number) => Math.min(max, Math.max(min, round(v, step)));
  const set = (v: number) => onChange(clamp(v));
  const btn = size === "md" ? "h-11 w-11" : "h-9 w-9";
  const shown = value === null ? "" : format ? format(value) : String(value);

  const commit = () => {
    if (draft === null) return;
    if (draft === shown) return setDraft(null); // focused and left without typing
    const raw = draft.replace(/\s/g, "");
    // "1,022" / "10,000" are thousands; "72,5" is a decimal comma
    const text = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".");
    setDraft(null);
    if (!text) return;
    const n = Number(text);
    if (!Number.isFinite(n)) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 600);
      return;
    }
    const next = clamp(n);
    if (next !== round(n, step)) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 600);
    }
    if (next !== value) onChange(next);
  };

  return (
    <div className={cn("inline-flex items-center rounded-xl border bg-card transition-colors", flash ? "border-warn-fg" : "border-line focus-within:border-brand-500")} role="group" aria-label={label}>
      <button type="button" onClick={() => set(base - step)} disabled={value !== null && value <= min} className={cn(btn, "flex shrink-0 items-center justify-center rounded-l-xl text-slate-700 hover:bg-slate-100 disabled:opacity-40")} aria-label={`Decrease${label ? ` ${label}` : ""}`}>
        <Minus className="h-4 w-4" />
      </button>
      <label className={cn("flex min-w-[4.5rem] cursor-text items-center justify-center self-stretch px-1", size === "md" ? "text-base" : "text-sm")}>
        <input
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={draft ?? shown}
          placeholder="—"
          size={Math.max(2, (draft ?? shown).length || 1)}
          onFocus={(e) => {
            // keep the text as shown (so nothing re-renders under the cursor) and select it: typing replaces it
            setDraft(shown);
            e.target.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "Escape") {
              setDraft(null);
              requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
            } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const current = Number((draft ?? "").replace(/,/g, ""));
              const next = clamp((Number.isFinite(current) && draft ? current : base) + (e.key === "ArrowUp" ? step : -step));
              setDraft(String(next));
              onChange(next);
            }
          }}
          aria-label={label ? `${label}${unit ? ` (${unit})` : ""}` : unit}
          className="num w-auto min-w-0 bg-transparent p-0 text-center font-semibold text-slate-900 outline-none placeholder:text-slate-400"
        />
        {unit && (value !== null || draft !== null) && <span className="ml-0.5 shrink-0 text-xs font-normal text-slate-500">{unit}</span>}
      </label>
      <button type="button" onClick={() => set(base + step)} disabled={value !== null && value >= max} className={cn(btn, "flex shrink-0 items-center justify-center rounded-r-xl text-slate-700 hover:bg-slate-100 disabled:opacity-40")} aria-label={`Increase${label ? ` ${label}` : ""}`}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

interface PillsProps<T extends string | number> {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  /** "scale" = equal-width cells (1–10), "wrap" = flowing chips */
  layout?: "scale" | "wrap";
  ariaLabel?: string;
}

/** Large tappable choices (44px), single-select. */
export function Pills<T extends string | number>({ options, value, onChange, layout = "wrap", ariaLabel }: PillsProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn(layout === "scale" ? "grid grid-cols-5 gap-1.5 sm:grid-cols-10" : "flex flex-wrap gap-2")}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-[44px] rounded-xl border px-3 text-sm font-medium transition-colors",
              layout === "scale" && "px-0",
              active ? "border-navy bg-navy text-white" : "border-line bg-card text-slate-700 hover:bg-slate-50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface ToggleChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

/** Multi-select chip (e.g. sore muscles). */
export function ToggleChip({ active, onClick, children, className }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-[40px] rounded-full border px-3.5 text-sm transition-colors",
        active ? "border-brand-500 bg-brand-50 font-medium text-brand-600" : "border-line bg-card text-slate-700 hover:bg-slate-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Circular progress (0–1+), with centred content. */
export function ProgressRing({ value, size = 88, stroke = 9, color = "rgb(var(--brand-500))", children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/**
 * Tap vs long-press (500 ms) / right-click on the same element.
 * Returns props to spread on a button.
 */
export function useLongPress(onTap: () => void, onLong: () => void, ms = 500) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLong();
      }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      onTap();
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      clear();
      fired.current = false;
      onLong();
    },
  };
}
