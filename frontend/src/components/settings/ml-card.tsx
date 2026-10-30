"use client";

import { useState } from "react";
import { Brain, Check, Cpu, Download, Minus } from "lucide-react";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/fx";
import { InfoTip } from "@/components/ui/info-tip";
import { useMlStatus } from "@/hooks/use-insights";
import { api } from "@/lib/api";
import { fmt, humanize } from "@/lib/format";
import { confirmAction, notify } from "@/lib/notify";
import type { MLModelInfo, MLStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATE: Record<MLModelInfo["state"], { label: string; tone: BadgeTone }> = {
  not_downloaded: { label: "Not downloaded", tone: "neutral" },
  loading: { label: "Downloading / loading…", tone: "info" },
  ready: { label: "Ready", tone: "ok" },
  error: { label: "Error", tone: "critical" },
  disabled: { label: "Disabled", tone: "warning" },
};

const DOT: Partial<Record<BadgeTone, string>> = { neutral: "bg-slate-400", info: "bg-info-fg", ok: "bg-good-fg", critical: "bg-crit-fg", warning: "bg-warn-fg" };

export function MlCard() {
  const { data, error, isLoading, mutate } = useMlStatus();
  const [starting, setStarting] = useState<string | null>(null);

  const load = async (m: MLModelInfo) => {
    if (m.state === "not_downloaded") {
      const ok = await confirmAction({
        title: `Download ${m.name}?`,
        text: `About ${m.size_mb ? fmt(m.size_mb) : "100"} MB, downloaded once and cached on the server. It runs offline on the CPU after that.`,
        confirmText: "Download",
      });
      if (!ok) return;
    }
    setStarting(m.key);
    try {
      const status = await api.post<MLStatus>(`/api/ml/models/${m.key}/load`);
      mutate(status, false);
      notify.info(`${m.name} is loading`, "This page updates every 2 seconds until it's ready.");
    } catch (err) {
      notify.error(err, "Could not start the model");
    } finally {
      setStarting(null);
    }
  };

  return (
    <Card>
      <CardHeader title="Machine learning" description="On-device models and features — free, private, no AI key" icon={<Brain className="h-4 w-4" />} info="ml_models" />
      <CardBody className="space-y-6">
        {error && <ErrorState error={error} onRetry={() => mutate()} />}
        {isLoading && <ListSkeleton rows={2} />}
        {data && (
          <>
            {!data.enabled && (
              <p className="rounded-xl border border-warn-border bg-warn-bg px-3 py-2 text-xs text-warn-fg">
                ML is turned off on the backend (<code>ML_ENABLED=false</code>). Search falls back to spelling matches and rules.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Stat label="Saved meal memories" value={data.stats.saved_meal_embeddings} />
              <Stat label="Portion calibrations" value={data.stats.portion_calibrations} />
              <Stat label="Readiness samples" value={data.stats.readiness_samples} />
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {data.models.map((m) => {
                const st = STATE[m.state] ?? STATE.error;
                return (
                  <li key={m.key} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", m.state === "ready" ? "bg-good-bg text-good-fg" : "bg-slate-100 text-slate-500")}>
                        <Cpu className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                          {m.name}
                          <Badge tone={st.tone}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", DOT[st.tone])} aria-hidden />
                            {st.label}
                          </Badge>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{m.purpose}</p>
                        <p className="mt-0.5 break-all font-mono text-[11px] text-slate-400">
                          {m.model_id}
                          {m.size_mb ? ` · ~${fmt(m.size_mb)} MB` : ""}
                        </p>
                        {m.error && <p className="mt-1 text-xs text-crit-fg">{m.error}</p>}
                      </div>
                    </div>
                    {m.state !== "ready" && m.state !== "disabled" && (
                      <Button size="sm" variant="outline" className="self-start sm:self-center" onClick={() => load(m)} loading={starting === m.key || m.state === "loading"}>
                        {m.state !== "loading" && <Download className="h-3.5 w-3.5" />}
                        {m.state === "loading" ? "Loading…" : m.state === "error" ? "Retry" : "Download / load"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div>
              <p className="mb-2 flex items-center gap-1 text-[13px] font-medium text-slate-700">
                Features <InfoTip term="ml_overview" />
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.features).map(([k, on]) => (
                  <Badge key={k} tone={on ? "ok" : "neutral"}>
                    {on ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {humanize(k)}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
      <p className="num text-[22px] font-semibold leading-tight tracking-tight text-slate-900">
        <AnimatedNumber value={value} />
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{label}</p>
    </div>
  );
}
