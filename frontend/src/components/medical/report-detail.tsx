"use client";

import { useState, type ReactNode } from "react";
import { Dumbbell, ExternalLink, FileText, Flag, FlaskConical, Loader2, Pencil, Plus, RefreshCw, Salad, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { type BadgeTone, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { MetricRing } from "@/components/ui/fx";
import { InfoTip, WithTip } from "@/components/ui/info-tip";
import { fileUrl, api } from "@/lib/api";
import { fmt, prettyDate } from "@/lib/format";
import { confirmAction, confirmDelete, withToast } from "@/lib/notify";
import type { Biomarker, BiomarkerStatus, MedicalReport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BiomarkerModal } from "./biomarker-modal";
import { RangeBar, STATUS_META, StatusPill } from "./range-bar";

const EXTRACTION_LABEL = { rules: "Read by rules", ai: "Read by AI", "rules+ai": "Rules + AI" } as const;

export const statusTone: Record<BiomarkerStatus, BadgeTone> = {
  normal: "ok",
  low: "critical",
  high: "critical",
  borderline: "warning",
  unknown: "neutral",
};

interface ReportDetailProps {
  report: MedicalReport;
  onChanged: () => void;
  onDeleted: () => void;
}

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 md:grid-cols-[minmax(0,1.3fr)_7.5rem_minmax(0,1fr)_7rem_4.75rem]";

export function ReportDetail({ report, onChanged, onDeleted }: ReportDetailProps) {
  const [modal, setModal] = useState<{ open: boolean; editing: Biomarker | null }>({ open: false, editing: null });
  const [reanalysing, setReanalysing] = useState<"rules" | "ai" | null>(null);
  const file = fileUrl(report.file_url);

  /** Re-run extraction: rules only (fast, offline) or with an AI review (`use_ai=true`). */
  const reanalyse = async (useAi: boolean) => {
    const ok = await confirmAction({
      title: useAi ? "Ask AI to review this report?" : "Re-analyse this report?",
      text: useAi
        ? "An AI model reads the report and cross-checks the extracted values. Uses one of your configured AI providers. Extracted biomarkers may be replaced."
        : "Values are re-read with on-device rules (no AI). Extracted biomarkers may be replaced; ones you added by hand are kept if the backend supports it.",
      confirmText: useAi ? "AI review" : "Re-analyse",
    });
    if (!ok) return;
    setReanalysing(useAi ? "ai" : "rules");
    await withToast(() => api.post(`/api/medical/reports/${report.id}/analyze`, undefined, useAi ? { use_ai: true } : undefined), useAi ? "AI review started" : "Analysis started");
    setReanalysing(null);
    onChanged();
  };

  const removeReport = async () => {
    if (!(await confirmDelete("this report", "The file and all its biomarkers will be removed."))) return;
    const ok = await withToast(() => api.del(`/api/medical/reports/${report.id}`), "Report deleted");
    if (ok) onDeleted();
  };

  const removeBiomarker = async (b: Biomarker) => {
    if (!(await confirmDelete(`"${b.name}"`))) return;
    await withToast(() => api.del(`/api/medical/biomarkers/${b.id}`), "Biomarker deleted");
    onChanged();
  };

  const flagged = report.biomarkers.filter((b) => b.status !== "normal" && b.status !== "unknown").length;
  const normal = report.biomarkers.filter((b) => b.status === "normal").length;
  const borderline = report.biomarkers.filter((b) => b.status === "borderline").length;
  const outside = report.biomarkers.filter((b) => b.status === "low" || b.status === "high").length;
  const judged = normal + flagged;

  return (
    <div className="space-y-5">
      <Card className="fade-up">
        <div className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">{report.report_type ?? "Report"}</h3>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {prettyDate(report.report_date, { day: "numeric", month: "long", year: "numeric" })}
                {report.lab_name ? ` · ${report.lab_name}` : ""}
                {report.provider ? ` · analysed by ${report.provider}/${report.model}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {file && (
              <a href={file} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-3.5 w-3.5" /> File
                </Button>
              </a>
            )}
            <Button size="sm" variant="outline" onClick={() => reanalyse(false)} loading={reanalysing === "rules" || (report.status === "analyzing" && !reanalysing)}>
              <RefreshCw className="h-3.5 w-3.5" /> Re-analyze
            </Button>
            <Button size="sm" variant="outline" onClick={() => reanalyse(true)} loading={reanalysing === "ai"} disabled={report.status === "analyzing"}>
              <Sparkles className="h-3.5 w-3.5" /> AI review
            </Button>
            <Button size="icon" variant="ghost" className="text-slate-400 hover:bg-crit-bg hover:text-crit-fg" onClick={removeReport} aria-label="Delete report">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {report.status === "failed" && (
            <p className="flex items-start gap-2 rounded-xl border border-crit-border bg-crit-bg px-3.5 py-2.5 text-xs text-crit-fg">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" /> Analysis failed: {report.error}
            </p>
          )}
          {report.status === "analyzing" && (
            <p className="flex items-center gap-2 rounded-xl border border-info-border bg-info-bg px-3.5 py-2.5 text-xs text-info-fg">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> AI is reading this report… this page refreshes automatically.
            </p>
          )}

          {/* Summary: how many markers sit inside their range. */}
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-slate-50/70 p-4 sm:flex-row sm:items-center">
            <MetricRing value={judged ? normal / judged : 0} accent="balance" size={84} stroke={8} label={`${normal} of ${judged} markers in range`}>
              <span className="num text-lg font-semibold leading-none text-slate-900">{judged ? `${normal}/${judged}` : "—"}</span>
              <span className="mt-0.5 text-[10px] text-slate-500">in range</span>
            </MetricRing>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[15px] font-semibold text-slate-900">
                {report.biomarkers.length === 0
                  ? "No biomarkers read yet"
                  : flagged === 0
                    ? "Everything that was checked is in range"
                    : `${flagged} marker${flagged === 1 ? "" : "s"} worth a closer look`}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {normal > 0 && <CountPill status="normal" n={normal} />}
                {borderline > 0 && <CountPill status="borderline" n={borderline} />}
                {outside > 0 && <CountPill status="high" n={outside} label="Low / high" />}
                {report.extraction_method && (
                  <span className="inline-flex items-center gap-1">
                    <Badge tone={report.extraction_method === "rules" ? "ok" : "brand"}>{EXTRACTION_LABEL[report.extraction_method] ?? report.extraction_method}</Badge>
                    <InfoTip term="extraction_method" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {report.summary && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{report.summary}</p>}

          <div className="grid gap-3 md:grid-cols-3">
            <ListBox title="Flags" icon={<Flag className="h-4 w-4" />} bubble="bg-crit-bg text-crit-fg" items={report.flags} />
            <ListBox title="Nutrition implications" icon={<Salad className="h-4 w-4" />} bubble="bg-acc-kcal/10 text-acc-kcal" items={report.nutrition_implications} />
            <ListBox title="Training implications" icon={<Dumbbell className="h-4 w-4" />} bubble="bg-acc-burn/10 text-acc-burn" items={report.training_implications} />
          </div>
          {report.notes && <p className="text-xs text-slate-500">Your notes: {report.notes}</p>}
        </div>
      </Card>

      <Card className="fade-up overflow-hidden" style={{ animationDelay: "60ms" }}>
        <CardHeader
          title={`Biomarkers (${report.biomarkers.length})`}
          icon={<FlaskConical className="h-4 w-4" />}
          description={flagged ? `${flagged} outside the reference range` : "All within range or not yet extracted"}
          action={
            <Button size="sm" onClick={() => setModal({ open: true, editing: null })}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          }
        />
        <div className="mt-4 border-t border-line">
          {report.biomarkers.length > 0 && (
            <>
              <div className={cn(ROW_GRID, "hidden border-b border-line px-5 py-2.5 text-xs font-medium text-slate-500 md:grid")}>
                <span>Biomarker</span>
                <span className="text-right">Value</span>
                <WithTip term="reference_range">Reference</WithTip>
                <WithTip term="biomarker_status">Status</WithTip>
                <span />
              </div>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-5 py-2.5 text-xs text-slate-500 md:hidden">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-5 rounded-full bg-good-fg/25" aria-hidden /> <WithTip term="reference_range">Normal range</WithTip>
                </span>
                <WithTip term="biomarker_status">Status</WithTip>
              </p>
            </>
          )}
          {report.biomarkers.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <FlaskConical className="h-5 w-5" />
              </span>
              <p className="text-sm text-slate-500">No biomarkers yet. Run the AI analysis or add them manually.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {report.biomarkers.map((b, i) => (
                <li
                  key={b.id}
                  className={cn(ROW_GRID, "fade-up px-5 py-4 transition-colors hover:bg-slate-50/80", (STATUS_META[b.status] ?? STATUS_META.unknown).edge)}
                  style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{b.name}</p>
                    {b.category && <p className="truncate text-xs text-slate-500">{b.category}</p>}
                    {b.notes && <p className="text-xs italic text-slate-500">{b.notes}</p>}
                  </div>
                  <p className="num whitespace-nowrap text-right text-[15px] font-semibold text-slate-900">
                    {b.value !== null ? fmt(b.value, b.value % 1 ? 2 : 0) : b.value_text ?? "—"} <span className="text-xs font-normal text-slate-500">{b.unit}</span>
                  </p>
                  <RangeBar value={b.value} low={b.ref_low} high={b.ref_high} status={b.status} className="col-span-2 md:col-span-1" />
                  <div>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, editing: b })} aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-crit-bg hover:text-crit-fg" onClick={() => removeBiomarker(b)} aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <BiomarkerModal open={modal.open} onClose={() => setModal({ open: false, editing: null })} reportId={report.id} editing={modal.editing} onSaved={onChanged} />
    </div>
  );
}

function CountPill({ status, n, label }: { status: BiomarkerStatus; n: number; label?: string }) {
  const m = STATUS_META[status];
  return (
    <Badge tone={m.tone}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden />
      <span className="num font-semibold">{n}</span> {label ?? m.label}
    </Badge>
  );
}

function ListBox({ title, icon, items, bubble }: { title: string; icon: ReactNode; items: string[]; bubble: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-slate-900">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", bubble)}>{icon}</span>
        {title}
      </p>
      {items.length ? (
        <ul className="space-y-1.5 text-[13px] leading-relaxed text-slate-600">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-slate-400">None</p>
      )}
    </div>
  );
}
