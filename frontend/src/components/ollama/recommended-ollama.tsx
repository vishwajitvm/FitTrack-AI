"use client";

import { CheckCircle2, Download, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useOllamaLibrary } from "@/hooks/use-ollama";
import { api } from "@/lib/api";
import { confirmAction, withToast } from "@/lib/notify";
import type { OllamaModel, OllamaStatus, PullJob } from "@/lib/types";

interface Props {
  status: OllamaStatus | undefined;
  installed: OllamaModel[] | undefined;
  onStarted: () => void;
}

/** Plain-language path: do you need this? → install → one-tap download of a good model. */
export function RecommendedOllama({ status, installed, onStarted }: Props) {
  const { data: library } = useOllamaLibrary();
  // Prefer a small vision model (reads meal photos offline), else the first curated model.
  const pick = library?.find((m) => m.capabilities.includes("vision")) ?? library?.[0];
  const hasModel = (installed?.length ?? 0) > 0;

  const download = async () => {
    if (!pick) return;
    const ok = await confirmAction({ title: `Download ${pick.name}?`, text: `About ${pick.size_human}. It downloads in the background — you can keep using the app.`, confirmText: "Download" });
    if (!ok) return;
    const job = await withToast(() => api.post<PullJob>("/api/ollama/pull", { name: pick.name }), `Downloading ${pick.name}`);
    if (job) onStarted();
  };

  return (
    <Card className="fade-up">
      <CardHeader title="Do you need this page?" description="Probably not — it's for running AI offline on your own computer" icon={<Info className="h-4 w-4" />} info="ollama_last_resort" />
      <CardBody className="space-y-4 text-sm text-slate-600">
        <p className="max-w-3xl leading-relaxed">
          The app already works without AI, and a free Google key (AI providers page) is easier. Use Ollama only if you want AI that runs <b className="text-slate-900">entirely on this computer</b>, with no
          internet. It&apos;s slower and needs a few GB of disk space.
        </p>
        {status?.reachable ? (
          hasModel ? (
            <p className="flex items-center gap-2.5 rounded-2xl border border-good-border bg-good-bg px-4 py-3 font-medium text-good-fg">
              <CheckCircle2 className="h-5 w-5 shrink-0" /> Ollama is running and has a model — it will be used as the last backup.
            </p>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-slate-50 px-4 py-3 sm:flex-row sm:items-center">
              <span className="flex-1 text-slate-700">Ollama is running. Download one good all-round model{pick ? ` (${pick.name}, ${pick.size_human})` : ""}:</span>
              <Button className="min-h-[44px]" onClick={download} disabled={!pick}>
                <Download className="h-4 w-4" /> Download recommended model
              </Button>
            </div>
          )
        ) : (
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              <>
                Install Ollama from{" "}
                <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-brand-600 hover:underline">
                  ollama.com <ExternalLink className="h-3 w-3" />
                </a>{" "}
                (or with Docker: <code className="rounded bg-slate-100 px-1 text-xs">docker compose --profile ollama up -d</code>).
              </>,
              <>Come back here and press &ldquo;Check&rdquo; — the status turns Online.</>,
              <>Tap &ldquo;Download recommended model&rdquo;. That&apos;s it.</>,
            ].map((text, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-line p-3.5">
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white">{i + 1}</span>
                <span className="min-w-0 break-words leading-relaxed text-slate-700">{text}</span>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
