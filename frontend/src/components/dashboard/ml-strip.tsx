"use client";

import Link from "next/link";
import { Brain, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { Skeleton } from "@/components/ui/misc";
import type { GlossaryKey } from "@/config/glossary";
import { useInsightsSummary } from "@/hooks/use-insights";
import { fmt, prettyDate } from "@/lib/format";
import { ACWR_ZONE, RATE_STATUS, READINESS_MODE, tdeeSourceText } from "@/lib/ml-labels";
import type { ReactNode } from "react";

/** Compact one-row summary of the ML insights; links to /insights. Hidden if the endpoint is unavailable. */
export function MlStrip() {
  const { data, error, isLoading } = useInsightsSummary();
  if (error) return null;
  if (isLoading || !data) return <Skeleton className="h-24 rounded-2xl" />;
  const rate = RATE_STATUS[data.rate_status] ?? RATE_STATUS.insufficient_data;
  const zone = data.acwr_zone ? ACWR_ZONE[data.acwr_zone] : null;

  return (
    <div className="rounded-2xl border border-line bg-card shadow-card">
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="flex items-center gap-3 text-[15px] font-semibold tracking-tight text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Brain className="h-4 w-4" />
          </span>
          What your data says <InfoTip term="ml_overview" />
        </span>
        <Link href="/insights" className="flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:underline">
          Open <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
        <Item label="Trend weight" term="trend_weight">
          <span className="num font-semibold">{data.trend_weight !== null ? `${fmt(data.trend_weight, 1)} kg` : "—"}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1">
            <Badge tone={rate.tone}>{data.rate_kg_per_week !== null ? `${data.rate_kg_per_week > 0 ? "+" : ""}${fmt(data.rate_kg_per_week, 2)} kg/wk` : rate.label}</Badge>
          </span>
          {data.eta_date && <span className="text-[11px] text-slate-500">Goal ~{prettyDate(data.eta_date, { day: "numeric", month: "short", year: "numeric" })}</span>}
        </Item>
        <Item label="Real burn" term="adaptive_tdee">
          <span className="num font-semibold">{data.adaptive_tdee !== null ? `${fmt(data.adaptive_tdee)} kcal` : "Learning…"}</span>
          <span className="text-[11px] text-slate-500">{tdeeSourceText(data.tdee_source, data.adaptive_confidence)}</span>
        </Item>
        <Item label="Training ACWR" term="acwr">
          <span className="num font-semibold">{data.acwr !== null ? fmt(data.acwr, 2) : "—"}</span>
          {zone && <Badge tone={zone.tone}>{zone.label}</Badge>}
        </Item>
        <Item label="Readiness" term="readiness_model">
          <span className="font-semibold">{READINESS_MODE[data.readiness_mode] ?? data.readiness_mode}</span>
        </Item>
        <Item label="Data checks" term="anomalies">
          <span className="num font-semibold">{data.anomalies_count}</span>
          <span className="text-[11px] text-slate-500">{data.anomalies_count ? "to review" : "all clean"}</span>
        </Item>
      </div>
    </div>
  );
}

function Item({ label, term, children }: { label: string; term: GlossaryKey; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-900">
      <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
        {label} <InfoTip term={term} />
      </span>
      {children}
    </div>
  );
}
