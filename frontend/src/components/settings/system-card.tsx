"use client";

import { Server } from "lucide-react";
import { InfoRow } from "@/components/common/stat-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useHealth } from "@/hooks/use-settings";
import { API_URL } from "@/lib/api";
import type { AppSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const DOT: Partial<Record<BadgeTone, string>> = { ok: "bg-good-fg", warning: "bg-warn-fg", critical: "bg-crit-fg", neutral: "bg-slate-400" };

function Pill({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <Badge tone={tone}>
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[tone])} aria-hidden />
      {children}
    </Badge>
  );
}

export function SystemCard({ settings }: { settings: AppSettings | undefined }) {
  const { data: health, error } = useHealth();
  const ok = (s?: string) => (s === "ok" ? "ok" : s ? "warning" : "neutral");

  return (
    <Card>
      <CardHeader title="System" description="Connection and backend info" icon={<Server className="h-4 w-4" />} />
      <CardBody className="space-y-4">
        <div className="divide-y divide-line">
          <InfoRow label="Backend" value={error ? <Pill tone="critical">offline</Pill> : <Pill tone={ok(health?.status)}>{health?.status ?? "…"}</Pill>} />
          <InfoRow label="Database" value={<Pill tone={ok(health?.db)}>{health?.db ?? "—"}</Pill>} />
          <InfoRow label="Redis cache" value={<Pill tone={ok(health?.redis)}>{health?.redis ?? "—"}</Pill>} />
          <InfoRow label="Version" value={health?.version ?? "—"} />
          <InfoRow label="API URL" value={<span className="break-all font-mono text-xs">{API_URL}</span>} />
        </div>
        {(Object.keys(settings?.app ?? {}).length > 0 || Object.keys(settings?.paths ?? {}).length > 0) && (
          <div className="divide-y divide-line rounded-2xl bg-slate-50 px-3 py-1">
            {Object.entries(settings?.app ?? {}).map(([k, v]) => (
              <InfoRow key={k} label={<span className="capitalize">{k.replace(/_/g, " ")}</span>} value={<span className="break-all text-xs">{show(v)}</span>} />
            ))}
            {Object.entries(settings?.paths ?? {}).map(([k, v]) => (
              <InfoRow key={k} label={<span className="capitalize">{k.replace(/_/g, " ")}</span>} value={<span className="break-all font-mono text-xs">{show(v)}</span>} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
