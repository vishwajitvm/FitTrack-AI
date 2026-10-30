"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Info, SearchCheck, TriangleAlert } from "lucide-react";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useAnomalies } from "@/hooks/use-insights";
import { prettyDate } from "@/lib/format";
import { ANOMALY_KIND } from "@/lib/ml-labels";
import { cn } from "@/lib/utils";

export function AnomaliesCard() {
  const { data, error, isLoading, mutate } = useAnomalies(30);
  return (
    <Card className="fade-up flex flex-col overflow-hidden">
      <CardHeader
        title="Data-quality checks"
        description="Last 30 days"
        icon={<SearchCheck className="h-4 w-4" />}
        info="anomalies"
        action={data && data.length > 0 ? <Badge tone="neutral">{data.length}</Badge> : undefined}
      />
      {(error || isLoading || (data && data.length === 0)) && (
        <CardBody>
          {error && <ErrorState error={error} onRetry={() => mutate()} />}
          {isLoading && <ListSkeleton rows={3} />}
          {data && data.length === 0 && (
            <p className="flex items-center gap-2 rounded-xl bg-good-bg px-3 py-2.5 text-sm text-good-fg">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Nothing suspicious found — your log looks consistent.
            </p>
          )}
        </CardBody>
      )}
      {data && data.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {data.map((a, i) => {
            const warn = a.severity === "warning";
            return (
              <li key={`${a.kind}-${a.date}-${i}`} className="fade-up flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", warn ? "bg-warn-bg text-warn-fg" : "bg-info-bg text-info-fg")}>
                  {warn ? <TriangleAlert className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                    {ANOMALY_KIND[a.kind] ?? a.kind}
                    <Badge tone={warn ? "warning" : "info"}>{a.severity}</Badge>
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{a.message}</p>
                </div>
                <Link
                  href={a.kind === "weight_outlier" ? "/checkin" : "/food"}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-0.5 rounded-lg px-2 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
                >
                  {prettyDate(a.date)}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
