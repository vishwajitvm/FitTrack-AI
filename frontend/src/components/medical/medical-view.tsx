"use client";

import { useState } from "react";
import { CalendarDays, ChevronRight, FileHeart, FileText, FlaskConical, Loader2, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { useReports } from "@/hooks/use-medical";
import { useRevalidatePrefix } from "@/hooks/use-revalidate";
import { humanize, prettyDate } from "@/lib/format";
import type { MedicalReport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReportDetail } from "./report-detail";
import { TrendsCard } from "./trends-card";
import { UploadCard } from "./upload-card";

const statusTone: Record<MedicalReport["status"], BadgeTone> = {
  uploaded: "neutral",
  analyzing: "info",
  analyzed: "ok",
  failed: "critical",
};

export function MedicalView() {
  const { data, error, isLoading, mutate } = useReports();
  const revalidatePrefix = useRevalidatePrefix();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = data?.find((r) => r.id === selectedId) ?? data?.[0] ?? null;

  const refresh = () => {
    mutate();
    revalidatePrefix("/api/medical/biomarkers");
  };

  // Display-only summary of the report on screen.
  const markers = selected?.biomarkers ?? [];
  const inRange = markers.filter((b) => b.status === "normal").length;
  const flagged = markers.filter((b) => b.status !== "normal" && b.status !== "unknown").length;
  const latest = [...(data ?? [])].sort((a, b) => (b.report_date ?? "").localeCompare(a.report_date ?? ""))[0];

  return (
    <>
      <PageHeader
        title="Medical reports"
        page="medical"
        description="Optional — upload a blood test whenever you get one (not a daily task). The AI extracts biomarkers and explains what they mean for your diet and training."
      />
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-[13px] leading-relaxed text-slate-600 shadow-card">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warn-bg text-warn-fg">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <p>
            <b className="font-semibold text-slate-900">Not medical advice.</b> AI extraction can misread values and reference ranges differ between labs. Always confirm results and any changes to diet,
            supplements or medication with a qualified doctor.
          </p>
        </div>

        {!!data?.length && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="fade-up">
              <StatCard label="Reports" value={data.length} icon={<FileText className="h-4 w-4" />} sub="uploaded so far" />
            </div>
            <div className="fade-up" style={{ animationDelay: "50ms" }}>
              <StatCard
                label="Latest test"
                value={latest?.report_date ? prettyDate(latest.report_date, { day: "numeric", month: "short" }) : "—"}
                icon={<CalendarDays className="h-4 w-4" />}
                sub={latest?.report_date ? prettyDate(latest.report_date, { year: "numeric" }) : "no date"}
              />
            </div>
            <div className="fade-up" style={{ animationDelay: "100ms" }}>
              <StatCard label="In range" value={inRange} unit={`of ${markers.length}`} accent="balance" icon={<ShieldCheck className="h-4 w-4" />} sub="in the report on screen" />
            </div>
            <div className="fade-up" style={{ animationDelay: "150ms" }}>
              <StatCard
                label="Worth a look"
                value={flagged}
                icon={<TriangleAlert className="h-4 w-4" />}
                tone={flagged ? "warning" : "ok"}
                status={flagged ? "Check" : "All clear"}
                sub="low, high or borderline"
              />
            </div>
          </div>
        )}

        {/* Phone order: reports → selected report → upload. Desktop: list + upload on the left, report on the right. */}
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start">
          <div className="contents lg:flex lg:flex-col lg:gap-5">
            <Card className="fade-up order-1 overflow-hidden">
              <CardHeader title="Your reports" icon={<FileHeart className="h-4 w-4" />} description={data?.length ? "Tap one to open it" : undefined} />
              <div className="mt-4 border-t border-line">
                {error && (
                  <div className="p-4">
                    <ErrorState error={error} onRetry={() => mutate()} />
                  </div>
                )}
                {isLoading && (
                  <div className="p-4">
                    <ListSkeleton rows={3} />
                  </div>
                )}
                {data?.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">No reports uploaded yet.</p>}
                {!!data?.length && (
                  <ul className="divide-y divide-line">
                    {data.map((r, i) => {
                      const active = selected?.id === r.id;
                      const flags = r.biomarkers.filter((b) => b.status !== "normal" && b.status !== "unknown").length;
                      return (
                        <li key={r.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(r.id)}
                            aria-current={active ? "true" : undefined}
                            className={cn(
                              "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors focus-visible:bg-slate-50 focus-visible:outline-none",
                              active ? "bg-brand-50/60 shadow-[inset_3px_0_0_0_rgb(var(--brand-500))]" : "hover:bg-slate-50/80",
                            )}
                          >
                            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", active ? "bg-navy text-white" : "bg-slate-100 text-slate-500")}>
                              <FlaskConical className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-900">{r.report_type ?? r.file_name}</span>
                              <span className="block text-xs text-slate-500">
                                {prettyDate(r.report_date, { day: "numeric", month: "short", year: "numeric" })} · {r.biomarkers.length} markers
                                {flags > 0 && <span className="text-warn-fg"> · {flags} flagged</span>}
                              </span>
                            </span>
                            <Badge tone={statusTone[r.status]}>
                              {r.status === "analyzing" && <Loader2 className="h-3 w-3 animate-spin" />}
                              {humanize(r.status)}
                            </Badge>
                            <ChevronRight className={cn("hidden h-4 w-4 shrink-0 sm:block", active ? "text-brand-600" : "text-slate-300")} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
            <div className="order-3">
              <UploadCard
                onUploaded={(r) => {
                  setSelectedId(r.id);
                  refresh();
                }}
              />
            </div>
          </div>
          <div className="order-2 lg:order-none lg:col-span-2">
            {selected ? (
              <ReportDetail
                report={selected}
                onChanged={refresh}
                onDeleted={() => {
                  setSelectedId(null);
                  refresh();
                }}
              />
            ) : (
              !isLoading && (
                <EmptyState
                  icon={<FileHeart className="h-5 w-5" />}
                  title="Got a blood test? Upload it — optional"
                  description="Upload the PDF or a clear photo using the box on this page. We read the values for you and explain what they mean for your food and training. You only need this when you get a new report."
                />
              )
            )}
          </div>
        </div>

        <TrendsCard />
      </div>
    </>
  );
}
