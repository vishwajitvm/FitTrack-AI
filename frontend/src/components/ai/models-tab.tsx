"use client";

import { useMemo, useState } from "react";
import { Boxes, Plus, Search } from "lucide-react";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { CAPABILITIES } from "@/config/constants";
import { useModels, useProviders } from "@/hooks/use-ai";
import { humanize } from "@/lib/format";
import { AddModelModal } from "./add-model-modal";
import { ModelsTable } from "./models-table";

const PAGE = 50;

export function ModelsTab({ onChanged }: { onChanged: () => void }) {
  const { data: models, error, isLoading, mutate } = useModels();
  const { data: providers } = useProviders();
  const [query, setQuery] = useState("");
  const [cap, setCap] = useState("");
  const [provider, setProvider] = useState("");
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [addOpen, setAddOpen] = useState(false);

  const names = useMemo(() => Object.fromEntries((providers ?? []).map((p) => [p.id, p.name])), [providers]);

  const filtered = (models ?? []).filter((m) => {
    if (query && !`${m.display_name} ${m.model_id}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (cap && !m.capabilities.includes(cap as never)) return false;
    if (provider && m.provider_id !== provider) return false;
    if (enabledOnly && !m.enabled) return false;
    if (freeOnly && !m.free) return false;
    return true;
  });

  const refresh = () => {
    mutate();
    onChanged();
  };

  return (
    <div className="space-y-4">
      <Card className="fade-up">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search models" aria-label="Search models" className="pl-9" />
          </div>
          <Select value={cap} onChange={(e) => setCap(e.target.value)} aria-label="Capability">
            <option value="">All capabilities</option>
            {CAPABILITIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </Select>
          <Select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Provider">
            <option value="">All providers</option>
            {(providers ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line px-4 py-3">
          <Switch checked={enabledOnly} onChange={setEnabledOnly} label="Enabled only" />
          <Switch checked={freeOnly} onChange={setFreeOnly} label="Free only" />
          <span className="num text-[13px] text-slate-500">
            {filtered.length} of {models?.length ?? 0} models
          </span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Custom model
          </Button>
        </div>
      </Card>
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {isLoading && <ListSkeleton rows={8} />}
      {models && (
        <Card className="fade-up overflow-hidden" style={{ animationDelay: "60ms" }}>
          <CardHeader className="pb-4" title="Model catalogue" description="Switch models on or off for the router. Free models are marked." icon={<Boxes className="h-4 w-4" />} />
          <div className="border-t border-line">
            <ModelsTable models={filtered.slice(0, limit)} onChanged={refresh} showProvider providerNames={names} />
          </div>
          {filtered.length > limit && (
            <div className="border-t border-line p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                Show more ({filtered.length - limit} remaining)
              </Button>
            </div>
          )}
        </Card>
      )}
      <AddModelModal open={addOpen} onClose={() => setAddOpen(false)} providers={providers ?? []} onSaved={refresh} />
    </div>
  );
}
