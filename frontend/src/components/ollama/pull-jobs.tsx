"use client";

import { Download, X } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { isPullActive } from "@/hooks/use-ollama";
import { api } from "@/lib/api";
import { bytes, fmt } from "@/lib/format";
import { confirmAction, withToast } from "@/lib/notify";
import type { PullJob } from "@/lib/types";

const tone: Record<PullJob["status"], BadgeTone> = {
  queued: "neutral",
  pulling: "info",
  completed: "ok",
  failed: "critical",
  cancelled: "warning",
};

export function PullJobs({ jobs, onChanged }: { jobs: PullJob[] | undefined; onChanged: () => void }) {
  if (!jobs?.length) return null;

  const cancel = async (job: PullJob) => {
    if (!(await confirmAction({ title: `Cancel downloading ${job.name}?`, text: "Partially downloaded layers stay cached and resume next time.", confirmText: "Cancel download", danger: true }))) return;
    await withToast(() => api.del(`/api/ollama/pulls/${job.job_id}`), "Download cancelled");
    onChanged();
  };

  const sorted = [...jobs].sort((a, b) => Number(isPullActive(b)) - Number(isPullActive(a)) || (b.started_at ?? "").localeCompare(a.started_at ?? ""));

  return (
    <Card className="fade-up overflow-hidden">
      <CardHeader className="pb-4" title="Downloads" description="Keeps going if you leave this page" icon={<Download className="h-4 w-4" />} info="ollama_pull" />
      <ul className="divide-y divide-line border-t border-line">
        {sorted.map((j) => (
          <li key={j.job_id} className="px-5 py-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-sm font-medium text-slate-900">{j.name}</span>
                <Badge tone={tone[j.status]} className="capitalize">
                  {j.status}
                </Badge>
              </span>
              {isPullActive(j) && (
                <Button variant="ghost" size="sm" className="text-crit-fg hover:bg-crit-bg" onClick={() => cancel(j)}>
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
            </div>
            {j.status !== "failed" && (
              <Progress value={j.status === "completed" ? 100 : j.percent ?? 0} barClassName={j.status === "completed" ? "bg-good-fg" : "bg-acc-weight"} />
            )}
            <p className={j.error ? "mt-1.5 text-[11px] text-crit-fg" : "num mt-1.5 text-[11px] text-slate-500"}>
              {j.error
                ? j.error
                : `${j.detail ?? ""}${j.total ? ` · ${bytes(j.completed)} / ${bytes(j.total)}` : ""}${j.percent !== null && j.status === "pulling" ? ` · ${fmt(j.percent, 1)}%` : ""}`}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
