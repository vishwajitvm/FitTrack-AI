"use client";

import { useMemo, useState } from "react";
import { ListOrdered, Search, SearchX, Sparkles } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { Segmented } from "@/components/ui/misc";
import { useProviders } from "@/hooks/use-ai";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import type { Provider } from "@/lib/types";
import { ProviderCard } from "./provider-card";

type Filter = "all" | "configured" | "free" | "local";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "configured", label: "Configured" },
  { value: "free", label: "Free tier" },
  { value: "local", label: "Local" },
];

export function ProvidersTab({ onChanged }: { onChanged: () => void }) {
  const { data, error, isLoading, mutate } = useProviders();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const sorted = useMemo(() => [...(data ?? [])].sort((a, b) => a.priority - b.priority), [data]);

  const visible = sorted.filter((p) => {
    if (query && !`${p.name} ${p.id}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "configured") return p.has_key || !p.requires_key;
    if (filter === "free") return p.free_tier;
    if (filter === "local") return p.is_local;
    return true;
  });

  const refresh = () => {
    mutate();
    onChanged();
  };

  /** Move a provider within the full priority list (not just the filtered view). */
  const move = async (p: Provider, dir: -1 | 1) => {
    const ids = sorted.map((x) => x.id);
    const i = ids.indexOf(p.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      const updated = await api.put<Provider[]>("/api/ai/providers/reorder", { order: ids });
      mutate(updated, false);
      onChanged();
    } catch (err) {
      notify.error(err, "Could not reorder providers");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search providers" aria-label="Search providers" className="pl-9" />
        </div>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-[13px] leading-relaxed text-slate-600 shadow-card">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <ListOrdered className="h-4 w-4" />
        </span>
        <p>
          <span className="inline-flex items-center gap-1 font-medium text-slate-900">
            Order = fallback priority <InfoTip term="provider_priority" />
          </span>{" "}
          The router tries enabled providers with a key from top to bottom, skipping any that are rate-limited (HTTP 429). Ollama is always tried last when &ldquo;last resort&rdquo; is
          on. <InfoTip term="rate_limit" /> <InfoTip term="free_tier" />
        </p>
      </div>
      {data && !data.some((p) => p.requires_key && p.has_key) && (
        <div className="flex items-start gap-3 rounded-2xl border border-info-border bg-info-bg px-4 py-3 text-sm text-info-fg">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">No AI key added yet</p>
            <p className="mt-0.5 text-xs leading-relaxed">
              Start with Google Gemini (best for meal photos), then Groq and OpenRouter — all free, no credit card. Open a provider below, click &ldquo;Get a key&rdquo;, paste
              it and press Save. Until then only local Ollama (slow) can answer.
            </p>
          </div>
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {isLoading && <ListSkeleton rows={8} />}
      <div className="space-y-3">
        {visible.map((p, i) => (
          <div key={p.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
            <ProviderCard provider={p} index={sorted.indexOf(p)} total={sorted.length} onMove={(dir) => move(p, dir)} onChanged={refresh} />
          </div>
        ))}
        {data && visible.length === 0 && (
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title="No providers match"
            description="Try a different word or show all providers."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Show all providers
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
