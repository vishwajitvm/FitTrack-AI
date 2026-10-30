"use client";

import { useEffect, useRef } from "react";
import { Activity, MemoryStick } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { isPullActive, useOllamaModels, useOllamaRunning, useOllamaStatus, usePullJobs } from "@/hooks/use-ollama";
import { useRevalidatePrefix } from "@/hooks/use-revalidate";
import { notify } from "@/lib/notify";
import { InstalledModels } from "./installed-models";
import { LibraryGrid } from "./library-grid";
import { PullJobs } from "./pull-jobs";
import { RecommendedOllama } from "./recommended-ollama";
import { StatusCard } from "./status-card";

export function OllamaView() {
  const status = useOllamaStatus();
  const reachable = !!status.data?.reachable;
  const models = useOllamaModels(reachable);
  const running = useOllamaRunning(reachable);
  const jobs = usePullJobs();
  const revalidatePrefix = useRevalidatePrefix();

  // When a download finishes, refresh the installed list and the router's model list.
  const prevActive = useRef<Set<string>>(new Set());
  useEffect(() => {
    const active = new Set((jobs.data ?? []).filter(isPullActive).map((j) => j.job_id));
    for (const id of Array.from(prevActive.current)) {
      if (!active.has(id)) {
        const job = jobs.data?.find((j) => j.job_id === id);
        if (job?.status === "completed") notify.success(`${job.name} downloaded`, "It is now available to the AI router as a last-resort fallback.");
        if (job?.status === "failed") notify.error(job.error ?? "Unknown error", `${job.name} download failed`);
        models.mutate();
        revalidatePrefix("/api/ai");
      }
    }
    prevActive.current = active;
  }, [jobs.data, models, revalidatePrefix]);

  const refreshAll = () => {
    status.mutate();
    models.mutate();
    running.mutate();
    jobs.mutate();
  };

  return (
    <>
      <PageHeader
        title="Ollama (local AI)"
        page="ollama"
        description="Download and manage local models from here. They run on your own machine, cost nothing and keep data private — the router uses them only when every cloud provider has failed."
      />
      <div className="space-y-6">
        <RecommendedOllama status={status.data} installed={models.data} onStarted={() => jobs.mutate()} />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
          <div className="space-y-5">
            <div className="fade-up" style={{ animationDelay: "40ms" }}>
              <StatusCard status={status.data} loading={status.isValidating} onChanged={refreshAll} />
            </div>
            <Card className="fade-up overflow-hidden" style={{ animationDelay: "90ms" }}>
              <CardHeader className="pb-4" title="Loaded in memory" description="Models ready to answer instantly" icon={<Activity className="h-4 w-4" />} />
              {!running.data?.length ? (
                <p className="border-t border-line px-5 py-5 text-sm text-slate-500">No model is loaded right now.</p>
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {running.data.map((r) => (
                    <li key={r.name} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-good-bg text-good-fg">
                        <MemoryStick className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-900">{r.name}</span>
                      <span className="num shrink-0 text-xs text-slate-500">{r.size_human}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <PullJobs jobs={jobs.data} onChanged={() => jobs.mutate()} />
          </div>
          <div className="min-w-0 space-y-5">
            <div className="fade-up" style={{ animationDelay: "60ms" }}>
              <InstalledModels models={models.data} running={running.data} reachable={reachable} onChanged={() => (models.mutate(), revalidatePrefix("/api/ai"))} />
            </div>
            <div className="fade-up" style={{ animationDelay: "120ms" }}>
              <LibraryGrid installed={models.data} jobs={jobs.data} reachable={reachable} onStarted={() => jobs.mutate()} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
