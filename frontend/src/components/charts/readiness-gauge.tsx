"use client";

import { useChartTheme, type ChartTheme } from "@/hooks/use-chart-theme";

/** Red / amber / green zones, coloured from the chart theme. */
function bands(t: ChartTheme) {
  return [
    { from: 0, to: 45, color: t.c.surplus, label: "Recover" },
    { from: 45, to: 70, color: t.c.late, label: "Lighter" },
    { from: 70, to: 100, color: t.c.deficit, label: "Train" },
  ];
}

/** Point on the semicircle for a 0–100 value (0 = left, 100 = right). */
function polar(cx: number, cy: number, r: number, value: number) {
  const angle = Math.PI * (1 - value / 100);
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
}

/** Semicircle 0–100 gauge with red / amber / green bands and a needle. */
export function ReadinessGauge({ score, label }: { score: number | null; label: string | null }) {
  const t = useChartTheme();
  const cx = 100;
  const cy = 100;
  const r = 80;
  const v = score === null ? null : Math.max(0, Math.min(100, score));
  const tip = v === null ? null : polar(cx, cy, r - 14, v);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-full max-w-[240px]" role="img" aria-label={`Readiness ${score ?? "not available"} out of 100`}>
        {bands(t).map((b) => (
          <path key={b.label} d={arc(cx, cy, r, b.from + 1.2, b.to - 1.2)} stroke={b.color} strokeWidth={12} fill="none" strokeLinecap="round" opacity={v === null ? 0.3 : 0.85} />
        ))}
        {tip && <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke={t.ink} strokeWidth={3} strokeLinecap="round" />}
        <circle cx={cx} cy={cy} r={6} fill={t.ink} />
        <circle cx={cx} cy={cy} r={2.5} fill={t.tooltip.contentStyle.background} />
        <text x={18} y={116} fontSize={9} fill={t.axis}>
          0
        </text>
        <text x={174} y={116} fontSize={9} fill={t.axis}>
          100
        </text>
      </svg>
      <p className="num -mt-1 text-[28px] font-semibold leading-tight tracking-tight text-slate-900">{v === null ? "—" : v}</p>
      <p className="text-[13px] text-slate-500">{label ?? (v === null ? "No data yet" : "")}</p>
    </div>
  );
}
