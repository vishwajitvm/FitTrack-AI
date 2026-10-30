"use client";

import { Boxes, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/misc";
import { WithTip } from "@/components/ui/info-tip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { confirmDelete, notify, withToast } from "@/lib/notify";
import type { Model } from "@/lib/types";
import { CapabilityChips } from "./capability-chips";

interface ModelsTableProps {
  models: Model[];
  onChanged: () => void;
  showProvider?: boolean;
  providerNames?: Record<string, string>;
}

export function ModelsTable({ models, onChanged, showProvider, providerNames = {} }: ModelsTableProps) {
  const toggle = async (m: Model, enabled: boolean) => {
    try {
      await api.put(`/api/ai/models/${m.id}`, { enabled });
      notify.success(`${m.display_name} ${enabled ? "enabled" : "disabled"}`);
      onChanged();
    } catch (err) {
      notify.error(err, "Could not update model");
    }
  };

  const remove = async (m: Model) => {
    if (!(await confirmDelete(`model "${m.display_name}"`, "It will no longer be used for routing. You can add it again later."))) return;
    await withToast(() => api.del(`/api/ai/models/${m.id}`), "Model deleted");
    onChanged();
  };

  if (!models.length)
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Boxes className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-slate-900">No models here</p>
        <p className="text-xs text-slate-500">Try another filter, sync from the provider, or add a custom model.</p>
      </div>
    );

  const context = (m: Model) => (m.context_window ? `${fmt(m.context_window / 1000)}k` : "—");
  const flags = (m: Model) =>
    (m.free || m.custom) && (
      <span className="mt-1 flex gap-1">
        {m.free && <Badge tone="ok">Free</Badge>}
        {m.custom && <Badge tone="neutral">Custom</Badge>}
      </span>
    );
  const del = (m: Model) => (
    <Button variant="ghost" size="icon" className="text-crit-fg hover:bg-crit-bg" onClick={() => remove(m)} aria-label="Delete model">
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH className="w-14">On</TH>
              {showProvider && <TH>Provider</TH>}
              <TH>Model</TH>
              <TH>
                <WithTip term="capabilities">Capabilities</WithTip>
              </TH>
              <TH className="text-right">Context</TH>
              <TH className="w-12" />
            </TR>
          </THead>
          <TBody>
            {models.map((m) => (
              <TR key={m.id} className={m.enabled ? undefined : "[&>td]:opacity-70"}>
                <TD>
                  <Switch checked={m.enabled} onChange={(v) => toggle(m, v)} ariaLabel={`Use ${m.display_name}`} />
                </TD>
                {showProvider && <TD className="whitespace-nowrap text-[13px] text-slate-600">{providerNames[m.provider_id] ?? m.provider_id}</TD>}
                <TD>
                  <span className="font-medium text-slate-900">{m.display_name}</span>
                  <span className="block font-mono text-[11px] text-slate-500">{m.model_id}</span>
                  {flags(m)}
                </TD>
                <TD>
                  <CapabilityChips caps={m.capabilities} />
                </TD>
                <TD className="num whitespace-nowrap text-right text-[13px]">{context(m)}</TD>
                <TD className="text-right">{del(m)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {models.map((m) => (
          <li key={m.id} className="flex items-start gap-3 px-4 py-3.5">
            <div className="pt-0.5">
              <Switch checked={m.enabled} onChange={(v) => toggle(m, v)} ariaLabel={`Use ${m.display_name}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{m.display_name}</p>
              <p className="truncate font-mono text-[11px] text-slate-500">{m.model_id}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {showProvider && `${providerNames[m.provider_id] ?? m.provider_id} · `}
                {context(m)} context
              </p>
              <div className="mt-1.5">
                <CapabilityChips caps={m.capabilities} />
              </div>
              {flags(m)}
            </div>
            {del(m)}
          </li>
        ))}
      </ul>
    </>
  );
}
