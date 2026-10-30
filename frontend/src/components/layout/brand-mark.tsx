import { useId } from "react";
import { cn } from "@/lib/utils";

/** The FitTrack logo: a glossy gradient squircle with a rising heartbeat and a goal spark (same art as app/icon.svg). */
export function BrandMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0 drop-shadow-[0_6px_14px_rgb(var(--hero-via)/0.45)]", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="0.55" stopColor="#C026D3" />
          <stop offset="1" stopColor="#F43F5E" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#${id}g)`} />
      <path d="M2 20C2 10 10 2 20 2h24c10 0 18 8 18 18v4C44 30 22 30 2 24z" fill={`url(#${id}s)`} />
      <path d="M10 38h9l5-11 8 19 7-25 5 13h10" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="49" cy="15" r="4.5" fill="#FFFFFF" />
    </svg>
  );
}
