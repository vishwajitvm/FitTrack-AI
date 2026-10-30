"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

export { ACCENT, accentColor, type Accent } from "./accent";
import { ACCENT, accentColor, type Accent } from "./accent";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Counts up to `value` when it first appears or changes (instant when the user prefers less motion). */
export function AnimatedNumber({ value, digits = 0, duration = 700 }: { value: number | null | undefined; digits?: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (value === null || value === undefined) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(a + (value - a) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  if (value === null || value === undefined) return <>—</>;
  return <span className="num">{fmt(shown, digits)}</span>;
}

/** Ring that fills to `value` (0–1) on mount; over 1 shows a full ring. */
export function MetricRing({ value, accent, size = 92, stroke = 9, children, label, onHero }: { value: number; accent: Accent; size?: number; stroke?: number; children?: ReactNode; label?: string; /** White ring for use on the gradient hero. */ onHero?: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(Math.max(0, Math.min(1, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={onHero ? "rgb(255 255 255 / 0.22)" : accentColor(accent, 0.15)} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={onHero ? "#fff" : accentColor(accent)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: prefersReducedMotion() ? undefined : "stroke-dashoffset 0.9s cubic-bezier(0.2, 0.7, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Tiny trend line with a soft fill. Gaps (null) are skipped. */
export function Sparkline({ values, accent, height = 32, className }: { values: (number | null)[]; accent: Accent; height?: number; className?: string }) {
  const gid = useId().replace(/:/g, "");
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null && Number.isFinite(p.v));
  if (pts.length < 2) return <div className={cn("w-full", className)} style={{ height }} />;
  const w = 100;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => (values.length === 1 ? 0 : (i / (values.length - 1)) * w);
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const line = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`).join(" ");
  const area = `${line} L${x(pts[pts.length - 1].i).toFixed(2)},${height} L${x(pts[0].i).toFixed(2)},${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cn("w-full overflow-visible", className)} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accentColor(accent, 0.35)} />
          <stop offset="100%" stopColor={accentColor(accent, 0)} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={accentColor(accent)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.6} fill={accentColor(accent)} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Rounded tinted square holding a metric icon. */
export function IconBubble({ accent, children, className }: { accent: Accent; children: ReactNode; className?: string }) {
  return <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", ACCENT[accent].tint, ACCENT[accent].text, className)}>{children}</span>;
}

/** Thin bar showing `value` of `max` in a metric colour. */
export function MiniBar({ value, max, accent, className }: { value: number | null | undefined; max: number | null | undefined; accent: Accent; className?: string }) {
  const pct = value && max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full", ACCENT[accent].tint, className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-700", ACCENT[accent].solid)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * 3D tilt toward the pointer with a moving glare (adds the `tilt` class and sets CSS variables).
 * Off on touch screens and when the user prefers less motion. Spread the result on a positioned element.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(max = 6) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.dataset.tilting = "true";
        el.style.setProperty("--ry", `${(x - 0.5) * 2 * max}deg`);
        el.style.setProperty("--rx", `${(0.5 - y) * 2 * max}deg`);
        el.style.setProperty("--gx", `${x * 100}%`);
        el.style.setProperty("--gy", `${y * 100}%`);
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.dataset.tilting = "false";
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max]);
  return ref;
}

/** A glowing 3D sphere with an orbiting ring; `value` 0–1 fills the ring. Children sit on the sphere. */
export function EnergyOrb({ value, size = 168, children, label }: { value: number; size?: number; children?: ReactNode; label?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size, perspective: 700 }} role={label ? "img" : undefined} aria-label={label}>
      {/* soft glow */}
      <div className="absolute inset-4 rounded-full bg-[rgb(var(--hero-via)/0.45)] blur-2xl" aria-hidden />
      {/* orbit ring tilted in 3D */}
      <div className="absolute inset-0" style={{ transform: "rotateX(68deg)", transformStyle: "preserve-3d" }} aria-hidden>
        <div className="spin-slow absolute inset-0 rounded-full border-2 border-dashed border-white/40" />
        <span className="spin-slow absolute inset-0">
          <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_4px_rgb(255_255_255/0.7)]" />
        </span>
      </div>
      {/* sphere */}
      <div
        className="float absolute inset-[18%] rounded-full shadow-[inset_-10px_-14px_28px_rgb(0_0_0/0.35),inset_8px_10px_22px_rgb(255_255_255/0.45),0_16px_40px_-10px_rgb(var(--hero-from)/0.7)]"
        style={{ background: "radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.9), rgb(var(--hero-via)) 32%, rgb(var(--hero-from)) 62%, rgb(var(--slate-950) / 0.9))" }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">{children}</div>
      </div>
      {/* progress ring */}
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#orb-grad)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: prefersReducedMotion() ? undefined : "stroke-dashoffset 1.1s cubic-bezier(0.2, 0.7, 0.2, 1)" }}
        />
        <defs>
          <linearGradient id="orb-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="rgb(255 255 255 / 0.6)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
