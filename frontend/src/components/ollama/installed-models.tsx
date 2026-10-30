"use client";

import { HardDrive, PlugZap, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { confirmDelete, withToast } from "@/lib/notify";
import type { OllamaModel, OllamaRunning } from "@/lib/types";

interface InstalledModelsProps {
  models: OllamaModel[] | undefined;
  running: OllamaRunning[] | undefined;
  reachable: boolean;
  onChanged: () => void;
}

export function InstalledModels({ models, running, reachable, onChanged }: InstalledModelsProps) {
  const remove = async (m: OllamaModel) => {
    if (!(await confirmDelete(`"${m.name}"`, `This frees ${m.size_human} of disk space. You can download it again any time.`))) return;
    await withToast(() => api.del("/api/ollama/models", { name: m.name }), `${m.name} deleted`);
    onChanged();
  };

  const loaded = new Set((running ?? []).map((r) => r.name));

  const flags = (m: OllamaModel) => (
    <span className="mt-1 flex flex-wrap gap-1">
      {loaded.has(m.name) && <Badge tone="ok">In memory</Badge>}
      {m.registered ? <Badge tone="brand">In router</Badge> : <Badge tone="neutral">Not in router</Badge>}
    </span>
  );
  const details = (m: OllamaModel) => [m.family, m.parameter_size, m.quantization].filter(Boolean).join(" · ") || "—";
  const del = (m: OllamaModel) => (
    <Button variant="ghost" size="icon" className="text-crit-fg hover:bg-crit-bg" onClick={() => remove(m)} aria-label={`Delete ${m.name}`}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4" title="Installed models" description={models ? `${models.length} on disk` : "Models on this computer"} icon={<HardDrive className="h-4 w-4" />} />
      <div className="border-t border-line">
        {!reachable ? (
          <Empty icon={<PlugZap className="h-5 w-5" />} text="Connect to Ollama to see installed models." />
        ) : !models?.length ? (
          <Empty icon={<HardDrive className="h-5 w-5" />} text="No models yet — download one from the library below." />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Model</TH>
                    <TH>Details</TH>
                    <TH className="text-right">Size</TH>
                    <TH className="w-12" />
                  </TR>
                </THead>
                <TBody>
                  {models.map((m) => (
                    <TR key={m.name}>
                      <TD>
                        <span className="font-mono text-sm font-medium text-slate-900">{m.name}</span>
                        {flags(m)}
                      </TD>
                      <TD className="text-xs text-slate-500">
                        {details(m)}
                        <span className="block">Updated {dateTime(m.modified_at)}</span>
                      </TD>
                      <TD className="num whitespace-nowrap text-right">{m.size_human}</TD>
                      <TD className="text-right">{del(m)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {models.map((m) => (
                <li key={m.name} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-medium text-slate-900">{m.name}</p>
                    <p className="num mt-0.5 text-xs text-slate-500">
                      {m.size_human} · {details(m)}
                    </p>
                    {flags(m)}
                  </div>
                  {del(m)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">{icon}</span>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
