"use client";

import { useState } from "react";
import { LineChart, TrendingUp } from "lucide-react";
import { BiomarkerTrendChart } from "@/components/charts/biomarker-trend-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { Select } from "@/components/ui/input";
import { useBiomarkerTrends, useReports } from "@/hooks/use-medical";
import { fmt, prettyDate } from "@/lib/format";
import { biomarkerInsight } from "@/lib/insights";
import type { Biomarker, BiomarkerStatus } from "@/lib/types";
import { StatusPill } from "./range-bar";

/** Latest reference range recorded for a biomarker name across all reports. */
function latestRef(reports: ReturnType<typeof useReports>["data"], name: string): Biomarker | null {
  const sorted = [...(reports ?? [])].sort((a, b) => (b.report_date ?? "").localeCompare(a.report_date ?? ""));
  for (const r of sorted) {
    const b = r.biomarkers.find((x) => x.name === name && (x.ref_low !== null || x.ref_high !== null));
    if (b) return b;
  }
  return null;
}

const num = (v: number) => fmt(v, v % 1 ? 2 : 0);

export function TrendsCard() {
  const { data } = useBiomarkerTrends();
  const { data: reports } = useReports();
  const names = Object.keys(data ?? {}).filter((n) => (data?.[n] ?? []).some((p) => p.value !== null));
  const [picked, setPicked] = useState("");
  const name = picked && names.includes(picked) ? picked : names[0];
  const series = name && data ? data[name].filter((p) => p.value !== null) : [];
  const ref = name ? latestRef(reports, name) : null;
  const unit = series[0]?.unit ?? ref?.unit ?? null;

  // Display-only: latest reading and change since the one before.
  const ordered = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const last = ordered[ordered.length - 1];
  const prev = ordered[ordered.length - 2];
  const delta = last && prev && last.value !== null && prev.value !== null ? last.value - prev.value : null;

  return (
    <ChartCard
      title="Biomarker trends"
      description="Same marker across reports, normal range shaded"
      icon={<TrendingUp className="h-4 w-4" />}
      info="chart_biomarker"
      insight={name ? biomarkerInsight(name, series, ref ? { ref_low: ref.ref_low, ref_high: ref.ref_high, unit } : null) : null}
      note={series.length === 1 ? "Only one reading so far — upload a later report to see a trend." : null}
    >
      {names.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <LineChart className="h-5 w-5" />
          </span>
          <p className="max-w-sm text-sm text-slate-500">Trends appear once biomarkers with numeric values are recorded.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {last && last.value !== null && (
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-500">Latest · {prettyDate(last.date, { day: "numeric", month: "short", year: "numeric" })}</p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="num text-[28px] font-semibold leading-none tracking-tight text-slate-900">
                    {num(last.value)}
                    {unit && <span className="ml-1 text-sm font-normal tracking-normal text-slate-500">{unit}</span>}
                  </p>
                  <StatusPill status={last.status as BiomarkerStatus} />
                  {delta !== null && (
                    <span className="num text-[13px] text-slate-500">
                      {delta > 0 ? "+" : ""}
                      {num(delta)} since {prettyDate(prev.date, { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            )}
            <Select value={name} onChange={(e) => setPicked(e.target.value)} className="sm:max-w-xs" aria-label="Biomarker">
              {names.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </div>
          <BiomarkerTrendChart name={name} series={series} refLow={ref?.ref_low ?? null} refHigh={ref?.ref_high ?? null} unit={unit} />
        </>
      )}
    </ChartCard>
  );
}
