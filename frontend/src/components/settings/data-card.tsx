"use client";

import { useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { AlertTriangle, ArchiveRestore, Database, Download, FileJson, FileSpreadsheet, FileText, History, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { IconBubble, type Accent } from "@/components/ui/fx";
import { Modal } from "@/components/ui/modal";
import { api, downloadUrl, fetcher } from "@/lib/api";
import { fmt, humanize, prettyDate } from "@/lib/format";
import { confirmAction, notify, withToast } from "@/lib/notify";
import type { BackupPreview, ExcelImportResult, RestoreResult, SafetyBackup } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXPORTS: { path: string; label: string; desc: string; icon: typeof FileText; accent: Accent }[] = [
  { path: "/api/export/xlsx", label: "fitness_tracker.xlsx", desc: "6 sheets you can open in Excel, edit and import back", icon: FileSpreadsheet, accent: "balance" },
  { path: "/api/export/workouts.csv", label: "workout_tracker.csv", desc: "Every exercise, set and cardio entry", icon: FileText, accent: "burn" },
  { path: "/api/export/json", label: "Full JSON backup", desc: "Everything you logged, incl. chats — restore it here any time", icon: FileJson, accent: "weight" },
];

const TABLE_LABEL: Record<string, string> = {
  users: "Profile",
  daily_summaries: "Days",
  food_logs: "Food entries",
  workout_sessions: "Workout sessions",
  workout_logs: "Exercises",
  bio_feedback: "Symptoms",
  presets: "Routines & saved meals",
  assistant_messages: "Ask FitTrack messages",
  medical_reports: "Medical reports",
  biomarkers: "Lab values",
  food_analyses: "Photo analyses",
  meal_memories: "Meal memories",
  portion_calibrations: "Portion calibrations",
  food_library: "Food library",
};

/** Clears every cached request so all pages show the restored data. */
function useRefreshAll() {
  const { mutate } = useSWRConfig();
  return () => mutate(() => true);
}

export function DataCard() {
  const excelRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"excel" | "json" | "sync" | null>(null);
  const [excelResult, setExcelResult] = useState<ExcelImportResult | null>(null);
  const [pending, setPending] = useState<{ file: File; preview: BackupPreview } | null>(null);
  const refreshAll = useRefreshAll();
  const { data: backups, mutate: reloadBackups } = useSWR<SafetyBackup[]>("/api/backups", fetcher);

  const importExcel = async (file: File) => {
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      notify.error(new Error(file.name.toLowerCase().endsWith(".json") ? "That's a JSON backup — use “Restore from JSON backup”." : "Choose an Excel workbook (.xlsx or .xlsm)."), "Can't import this file");
      return;
    }
    const ok = await confirmAction({
      title: `Import ${file.name}?`,
      text: "Food Log, Workout Log and Body Weight rows are merged into your data: matching entries are updated, new rows are added, nothing is deleted. Rows with mistakes are skipped and listed.",
      confirmText: "Import",
    });
    if (!ok) return;
    setBusy("excel");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.upload<ExcelImportResult>("/api/import/xlsx", form);
      const { food, workouts, weights } = res.imported;
      (res.skipped ? notify.info : notify.success)(res.skipped ? `Imported with ${res.skipped} row${res.skipped === 1 ? "" : "s"} skipped` : "Import complete", `${food} food · ${workouts} workouts · ${weights} weights`);
      if (res.skipped) setExcelResult(res);
      refreshAll();
    } catch (err) {
      notify.error(err, "Import failed — nothing was changed");
    } finally {
      setBusy(null);
    }
  };

  const pickBackup = async (file: File) => {
    if (!/\.json$/i.test(file.name)) {
      notify.error(new Error(/\.xls[xm]$/i.test(file.name) ? "That's an Excel workbook — use “Import Excel”." : "Choose a FitTrack JSON backup (.json)."), "Can't restore this file");
      return;
    }
    setBusy("json");
    try {
      const form = new FormData();
      form.append("file", file);
      setPending({ file, preview: await api.upload<BackupPreview>("/api/import/json/preview", form) });
    } catch (err) {
      notify.error(err, "Can't read this backup");
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy("json");
    try {
      const form = new FormData();
      form.append("file", pending.file);
      const res = await api.upload<RestoreResult>("/api/import/json", form);
      setPending(null);
      notify.success(
        res.mode === "replace" ? "Backup restored" : "Backup merged",
        res.safety_backup ? `${fmt(res.total)} rows. Your previous data was saved as ${res.safety_backup}.` : `${fmt(res.total)} entries merged.`,
      );
      refreshAll();
      void reloadBackups();
    } catch (err) {
      notify.error(err, "Restore failed — nothing was changed");
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    const res = await withToast(() => api.post<{ files: string[] }>("/api/export/sync"), "Synced files rewritten");
    setBusy(null);
    if (res?.files.length) notify.info("Files written", res.files.join(", "));
  };

  return (
    <Card>
      <CardHeader info="xlsx" title="Data portability" description="Your data is yours — download it, edit the spreadsheet, or restore a backup." icon={<Database className="h-4 w-4" />} />
      <CardBody className="space-y-6">
        <div>
          <p className="mb-2.5 text-[13px] font-medium text-slate-700">Download</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {EXPORTS.map((e, i) => (
              <a
                key={e.path}
                href={downloadUrl(e.path)}
                className="fade-up lift group flex flex-col gap-2 rounded-2xl border border-line bg-card p-4 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => notify.info(`Downloading ${e.label}`)}
              >
                <span className="flex items-center justify-between">
                  <IconBubble accent={e.accent}>
                    <e.icon className="h-4 w-4" />
                  </IconBubble>
                  <Download className="h-4 w-4 text-slate-400 transition-colors group-hover:text-brand-600" />
                </span>
                <span className="break-all text-sm font-semibold text-slate-900">{e.label}</span>
                <span className="text-xs leading-relaxed text-slate-500">{e.desc}</span>
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-[13px] font-medium text-slate-700">Import & restore</p>
          <input ref={excelRef} type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12" className="hidden" onChange={(e) => (e.target.files?.[0] && importExcel(e.target.files[0]), (e.target.value = ""))} />
          <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => (e.target.files?.[0] && pickBackup(e.target.files[0]), (e.target.value = ""))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <DropButton
              onClick={() => excelRef.current?.click()}
              busy={busy === "excel"}
              disabled={busy !== null}
              icon={<Upload className="h-5 w-5" />}
              title="Import Excel (.xlsx / .xlsm)"
              hint="Merges food, workouts and weight. Nothing is deleted."
            />
            <DropButton
              onClick={() => jsonRef.current?.click()}
              busy={busy === "json" && !pending}
              disabled={busy !== null}
              icon={<ArchiveRestore className="h-5 w-5" />}
              title="Restore from JSON backup"
              hint="Shows what's inside first. Your current data is saved before anything changes."
            />
          </div>
        </div>

        {backups && backups.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <History className="h-3.5 w-3.5" /> Safety copies (saved before each restore)
            </p>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {backups.slice(0, 5).map((b) => (
                <li key={b.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-800">{prettyDate(new Date(b.created_at * 1000).toISOString(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="num block text-xs text-slate-500">{fmt(b.size / 1024)} KB</span>
                  </span>
                  <a href={downloadUrl(`/api/backups/${b.name}`)} className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-brand-600 hover:bg-slate-100">
                    <Download className="h-4 w-4" /> Download
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
      <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">The backend also keeps an always-up-to-date copy of the Excel and CSV files in its export folder.</p>
        <Button variant="outline" onClick={sync} loading={busy === "sync"} disabled={busy !== null && busy !== "sync"}>
          {busy !== "sync" && <RefreshCw className="h-4 w-4" />} Re-sync export files
        </Button>
      </CardFooter>

      <Modal
        open={pending !== null}
        onClose={() => busy !== "json" && setPending(null)}
        title={pending?.preview.mode === "replace" ? "Restore this backup?" : "Merge this older backup?"}
        description={pending ? `${pending.file.name}${pending.preview.created_at ? ` · made ${prettyDate(pending.preview.created_at, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy === "json"}>
              Cancel
            </Button>
            <Button variant={pending?.preview.mode === "replace" ? "danger" : "primary"} onClick={restore} loading={busy === "json"}>
              {pending?.preview.mode === "replace" ? "Replace my data" : "Merge"}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-4">
            <div className={cn("flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-sm", pending.preview.mode === "replace" ? "border-warn-border bg-warn-bg text-warn-fg" : "border-line bg-slate-50/70 text-slate-700")}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {pending.preview.mode === "replace"
                  ? "Everything you've logged is replaced by this backup. A safety copy of your current data is saved first, so you can undo this from the list below."
                  : "This is an older-style backup: its food, workouts and symptoms are added to your data and matching entries updated. Nothing is deleted."}
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(pending.preview.counts)
                .filter(([, n]) => n > 0)
                .map(([table, n]) => (
                  <li key={table} className="rounded-xl border border-line bg-card px-3 py-2">
                    <span className="num block text-lg font-semibold text-slate-900">{fmt(n)}</span>
                    <span className="block text-xs text-slate-500">{TABLE_LABEL[table] ?? humanize(table)}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Modal>

      <Modal open={excelResult !== null} onClose={() => setExcelResult(null)} title={`${excelResult?.skipped ?? 0} row${excelResult?.skipped === 1 ? " was" : "s were"} skipped`} description="Fix these cells in Excel and import again — the rows that were fine are already saved." size="lg">
        <ul className="scrollbar-thin max-h-[50vh] divide-y divide-line overflow-y-auto rounded-2xl border border-line">
          {excelResult?.errors.map((e, i) => (
            <li key={i} className="flex gap-3 px-4 py-2.5 text-sm">
              <span className="num shrink-0 text-xs font-medium text-slate-500">
                {e.sheet} · row {e.row}
              </span>
              <span className="text-slate-800">{e.error}</span>
            </li>
          ))}
        </ul>
        {excelResult && excelResult.skipped > excelResult.errors.length && <p className="mt-2 text-xs text-slate-500">…and {excelResult.skipped - excelResult.errors.length} more.</p>}
      </Modal>
    </Card>
  );
}

function DropButton({ onClick, busy, disabled, icon, title, hint }: { onClick: () => void; busy: boolean; disabled: boolean; icon: React.ReactNode; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50/50 disabled:opacity-60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-brand-600 shadow-sm">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </button>
  );
}
