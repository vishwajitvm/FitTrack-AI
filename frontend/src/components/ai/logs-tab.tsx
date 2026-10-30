"use client";

import { ScrollText } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { WithTip } from "@/components/ui/info-tip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAiLogs } from "@/hooks/use-ai";
import { dateTime, humanize } from "@/lib/format";

const statusTone = { success: "ok", rate_limited: "warning", timeout: "warning", error: "critical" } as const;

export function LogsTab() {
  const { data, error, isLoading, mutate } = useAiLogs(150);
  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading) return <ListSkeleton rows={8} />;
  if (data?.length === 0) return <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No AI calls yet" description="Every request the app sends to an AI model will be listed here, with how long it took." />;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4" title="Recent AI calls" description="Latest 150 requests, newest first" icon={<ScrollText className="h-4 w-4" />} />
      <div className="hidden border-t border-line md:block">
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Task</TH>
              <TH>Provider / model</TH>
              <TH>
                <WithTip term="call_status">Status</WithTip>
              </TH>
              <TH className="text-right">Latency</TH>
            </TR>
          </THead>
          <TBody>
            {data?.map((l) => (
              <TR key={l.id}>
                <TD className="whitespace-nowrap text-xs">{dateTime(l.created_at)}</TD>
                <TD className="text-xs">{l.task}</TD>
                <TD className="text-xs">
                  {l.provider_id} / <span className="font-mono">{l.model_id}</span>
                  {l.error && (
                    <span className="block max-w-md truncate text-[11px] text-crit-fg" title={l.error}>
                      {l.error}
                    </span>
                  )}
                </TD>
                <TD>
                  <Badge tone={statusTone[l.status] ?? "neutral"}>{l.status.replace("_", " ")}</Badge>
                </TD>
                <TD className="num text-right text-xs">{l.latency_ms !== null ? `${l.latency_ms} ms` : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <ul className="divide-y divide-line border-t border-line md:hidden">
        {data?.map((l) => (
          <li key={l.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-900">{humanize(l.task)}</span>
              <Badge tone={statusTone[l.status] ?? "neutral"}>{l.status.replace("_", " ")}</Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-600">
              {l.provider_id} / <span className="font-mono">{l.model_id}</span>
            </p>
            {l.error && <p className="mt-0.5 line-clamp-2 text-[11px] text-crit-fg">{l.error}</p>}
            <p className="num mt-1 text-[11px] text-slate-500">
              {dateTime(l.created_at)} · {l.latency_ms !== null ? `${l.latency_ms} ms` : "—"}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
