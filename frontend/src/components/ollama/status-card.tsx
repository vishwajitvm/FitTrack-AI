"use client";

import { useEffect, useState } from "react";
import { Cpu, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { withToast } from "@/lib/notify";
import type { OllamaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusCardProps {
  status: OllamaStatus | undefined;
  loading: boolean;
  onChanged: () => void;
}

export function StatusCard({ status, loading, onChanged }: StatusCardProps) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status?.base_url) setUrl(status.base_url);
  }, [status?.base_url]);

  const save = async () => {
    setSaving(true);
    const ok = await withToast(() => api.put<OllamaStatus>("/api/ollama/config", { base_url: url.trim() }), "Ollama URL saved");
    setSaving(false);
    if (ok) onChanged();
  };

  const state = !status ? "checking" : status.reachable ? "online" : "offline";

  return (
    <Card>
      <CardHeader
        title="Ollama server"
        info="ollama_last_resort"
        description="Local, private models — used only after every cloud provider fails"
        icon={<Cpu className="h-4 w-4" />}
        action={
          <Button size="sm" variant="outline" onClick={onChanged} loading={loading}>
            {!loading && <RefreshCw className="h-3.5 w-3.5" />} Check
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
            {state === "online" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good-fg opacity-40 motion-reduce:hidden" />}
            <span className={cn("relative inline-flex h-3 w-3 rounded-full", state === "online" ? "bg-good-fg" : state === "offline" ? "bg-crit-fg" : "bg-slate-400")} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              {state === "online" ? "Running" : state === "offline" ? "Not reachable" : "Looking for Ollama"}
              {status ? (
                status.reachable ? (
                  <Badge tone="ok">Online{status.version ? ` · v${status.version}` : ""}</Badge>
                ) : (
                  <Badge tone="critical">Offline</Badge>
                )
              ) : (
                <Badge tone="neutral">Checking…</Badge>
              )}
            </p>
            {status?.error && <p className="mt-0.5 break-words text-xs text-crit-fg">{status.error}</p>}
          </div>
        </div>
        <Field
          label="Base URL"
          hint="Docker: http://ollama:11434 (start with `docker compose --profile ollama up -d`). Ollama on your host: http://host.docker.internal:11434 from Docker, or http://localhost:11434 without Docker."
        >
          <div className="flex gap-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:11434" className="font-mono text-[13px]" />
            <Button onClick={save} loading={saving} disabled={!url.trim() || url.trim() === status?.base_url}>
              Save
            </Button>
          </div>
        </Field>
      </CardBody>
    </Card>
  );
}
