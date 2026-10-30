"use client";

import { useState } from "react";
import { CheckCircle2, Download, Eye, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { isPullActive, useOllamaLibrary } from "@/hooks/use-ollama";
import { api } from "@/lib/api";
import { confirmAction, withToast } from "@/lib/notify";
import type { OllamaModel, PullJob } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LibraryGridProps {
  installed: OllamaModel[] | undefined;
  jobs: PullJob[] | undefined;
  reachable: boolean;
  onStarted: () => void;
}

/** Ollama tags default to ":latest" when omitted. */
const norm = (n: string) => (n.includes(":") ? n : `${n}:latest`);

export function LibraryGrid({ installed, jobs, reachable, onStarted }: LibraryGridProps) {
  const { data: library, isLoading } = useOllamaLibrary();
  const [custom, setCustom] = useState("");
  const installedSet = new Set((installed ?? []).map((m) => norm(m.name)));
  const pulling = new Set((jobs ?? []).filter(isPullActive).map((j) => norm(j.name)));

  const pull = async (name: string, size?: string) => {
    const ok = await confirmAction({
      title: `Download ${name}?`,
      text: `${size ? `About ${size}. ` : ""}The download runs on the Ollama server and continues even if you leave this page.`,
      confirmText: "Download",
    });
    if (!ok) return;
    const job = await withToast(() => api.post<PullJob>("/api/ollama/pull", { name }), `Downloading ${name}`);
    if (job) onStarted();
  };

  return (
    <Card>
      <CardHeader info="ollama_pull" title="Model library" description="Curated small models that run on a laptop CPU/GPU. Vision models can read food photos offline." icon={<Library className="h-4 w-4" />} />
      <CardBody className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Any model from ollama.com/library, e.g. qwen2.5:7b"
            aria-label="Model name to pull"
            className="font-mono text-[13px]"
          />
          <Button
            onClick={() => {
              pull(custom.trim());
              setCustom("");
            }}
            disabled={!custom.trim() || !reachable}
          >
            <Download className="h-4 w-4" /> Pull
          </Button>
        </div>
        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {library?.map((m, i) => {
            const isInstalled = installedSet.has(norm(m.name));
            const isPulling = pulling.has(norm(m.name));
            const vision = m.capabilities.includes("vision");
            return (
              <div
                key={m.name}
                className={cn("fade-up lift flex flex-col rounded-2xl border bg-card p-4 shadow-card", isInstalled ? "border-good-border" : "border-line")}
                style={{ animationDelay: `${Math.min(i, 9) * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-all font-mono text-sm font-semibold text-slate-900">{m.name}</span>
                  <Badge tone="neutral" className="num shrink-0">
                    {m.size_human}
                  </Badge>
                </div>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-slate-600">{m.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {m.capabilities.map((c) => (
                    <Badge key={c} tone={c === "vision" ? "brand" : "neutral"}>
                      {c === "vision" && <Eye className="h-3 w-3" />}
                      {c}
                    </Badge>
                  ))}
                </div>
                {m.recommended_for && <p className="mt-2 text-xs text-slate-500">Best for: {m.recommended_for}</p>}
                <div className="mt-4">
                  {isInstalled ? (
                    <span className="flex h-8 items-center gap-1.5 text-[13px] font-medium text-good-fg">
                      <CheckCircle2 className="h-4 w-4" /> Installed
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant={vision ? "primary" : "outline"}
                      className="w-full"
                      onClick={() => pull(m.name, m.size_human)}
                      disabled={!reachable || isPulling}
                      loading={isPulling}
                    >
                      {!isPulling && <Download className="h-3.5 w-3.5" />}
                      {isPulling ? "Downloading…" : "Download"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
