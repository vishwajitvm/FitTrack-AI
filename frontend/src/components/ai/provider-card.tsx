"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Eye, EyeOff, KeyRound, Plug, Plus, RefreshCw, Settings2, TriangleAlert } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ACCENT, type Accent } from "@/components/ui/fx";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { Switch } from "@/components/ui/misc";
import { useModels } from "@/hooks/use-ai";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { confirmAction, notify, withToast } from "@/lib/notify";
import type { Provider } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddModelModal } from "./add-model-modal";
import { ModelsTable } from "./models-table";

interface ProviderCardProps {
  provider: Provider;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onChanged: () => void;
}

/** Notes that mention retention/training get a privacy highlight. */
const PRIVACY_RE = /retain|train|privacy/i;

const BUBBLE_ACCENTS: Accent[] = ["balance", "weight", "protein", "kcal", "sleep", "water", "burn"];

/** Logo-like initials bubble; the colour is stable per provider. */
export function ProviderBubble({ name, id, className }: { name: string; id: string; className?: string }) {
  const words = name.replace(/[()]/g, "").split(/[\s.-]+/).filter(Boolean);
  const ini = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
  const hash = Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const a = ACCENT[BUBBLE_ACCENTS[hash % BUBBLE_ACCENTS.length]];
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tracking-tight", a.tint, a.text, className)} aria-hidden>
      {ini}
    </span>
  );
}

/** One word + dot for the provider's state, so meaning never relies on colour alone. */
export function providerStatus(p: Provider): { tone: BadgeTone; label: string } {
  const configured = p.has_key || !p.requires_key;
  if (!p.enabled) return { tone: "neutral", label: "Off" };
  if (p.last_status === "error") return { tone: "critical", label: "Error" };
  if (p.last_status === "rate_limited") return { tone: "warning", label: "Rate limited" };
  if (!configured) return { tone: "warning", label: "Needs key" };
  return { tone: "ok", label: p.requires_key ? "Connected" : "Ready" };
}

const DOT: Record<BadgeTone, string> = {
  ok: "bg-good-fg",
  warning: "bg-warn-fg",
  critical: "bg-crit-fg",
  info: "bg-info-fg",
  neutral: "bg-slate-400",
  dark: "bg-white",
  brand: "bg-brand-600",
};

export function StatusPill({ tone, label }: { tone: BadgeTone; label: string }) {
  return (
    <Badge tone={tone}>
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[tone])} aria-hidden />
      {label}
    </Badge>
  );
}

/** The provider's free-plan limits and privacy caveats, always visible. `code` spans render as code. */
function FreeTierNote({ note }: { note: string }) {
  const privacy = PRIVACY_RE.test(note);
  return (
    <p
      className={cn(
        "flex w-full items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed",
        privacy ? "border border-warn-border bg-warn-bg text-warn-fg" : "bg-slate-50 text-slate-600",
      )}
    >
      {privacy && <InfoTip term="privacy_note" className="mt-0.5" />}
      <span>
        {note.split("`").map((part, i) =>
          i % 2 ? (
            <code key={i} className="rounded bg-slate-200/70 px-1 font-mono text-[11px]">
              {part}
            </code>
          ) : (
            part
          ),
        )}
      </span>
    </p>
  );
}

export function ProviderCard({ provider: p, index, total, onMove, onChanged }: ProviderCardProps) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(p.base_url ?? "");
  const [extra, setExtra] = useState<Record<string, string>>(p.extra ?? {});
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const { data: models, mutate: mutateModels } = useModels(open ? p.id : undefined);

  useEffect(() => {
    setBaseUrl(p.base_url ?? "");
    setExtra(p.extra ?? {});
  }, [p.base_url, p.extra]);

  const update = async (body: Record<string, unknown>, success: string) => {
    const res = await withToast(() => api.put<Provider>(`/api/ai/providers/${p.id}`, body), success);
    if (res) onChanged();
    return res;
  };

  const saveKey = async () => {
    if (!key.trim()) return;
    setBusy("key");
    const ok = await update({ api_key: key.trim(), enabled: true }, `${p.name} key saved`);
    setBusy(null);
    if (ok) setKey("");
  };

  const removeKey = async () => {
    const ok = await confirmAction({
      title: `Remove the ${p.name} API key?`,
      text: p.key_source === "env" ? "The key comes from the backend .env file — remove it there. Only a key saved from this page can be removed here." : "The router will stop using this provider until you add a key again.",
      confirmText: "Remove key",
      danger: true,
    });
    if (!ok) return;
    await update({ api_key: "" }, "Key removed");
  };

  const saveSettings = async () => {
    setBusy("settings");
    await update({ base_url: baseUrl || null, extra }, "Provider settings saved");
    setBusy(null);
  };

  const test = async () => {
    setBusy("test");
    try {
      const r = await api.post<{ ok: boolean; latency_ms: number; model: string; message: string }>(`/api/ai/providers/${p.id}/test`);
      if (r.ok) notify.success(`${p.name} works`, `${r.model} answered in ${r.latency_ms} ms`);
      else notify.error(r.message, `${p.name} test failed`);
      onChanged();
    } catch (err) {
      notify.error(err, `${p.name} test failed`);
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const r = await api.post<{ added: number; total: number }>(`/api/ai/providers/${p.id}/sync-models`);
      notify.success(`Synced ${p.name} models`, `${r.added} new · ${r.total} total`);
      mutateModels();
      onChanged();
    } catch (err) {
      notify.error(err, "Model sync failed");
    } finally {
      setBusy(null);
    }
  };

  const configured = p.has_key || !p.requires_key;
  const status = providerStatus(p);
  const facts = [
    p.free_tier && "Free tier",
    p.is_local && "Local",
    p.has_key ? `Key from ${p.key_source === "env" ? ".env" : "this page"}` : !p.requires_key ? "No key needed" : null,
    `${p.enabled_models_count}/${p.models_count} models on`,
  ].filter(Boolean);

  return (
    <Card className={cn("overflow-hidden transition-shadow", !open && "lift", !p.enabled && "opacity-80")}>
      <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <div className="flex flex-col" role="group" aria-label={`Priority of ${p.name}`}>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="flex h-6 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="flex h-6 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 text-left">
          <span className="relative">
            <ProviderBubble name={p.name} id={p.id} />
            <span className="num absolute -bottom-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-line bg-card px-1 text-[10px] font-semibold text-slate-500" title="Fallback priority">
              {index + 1}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{p.name}</span>
              <StatusPill {...status} />
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">{facts.join(" · ")}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
        </button>
        <Switch checked={p.enabled} onChange={(v) => update({ enabled: v }, `${p.name} ${v ? "enabled" : "disabled"}`)} ariaLabel={`Use ${p.name}`} />
      </div>
      {p.free_tier_note && (
        <div className="px-3 pb-3 sm:px-4">
          <FreeTierNote note={p.free_tier_note} />
        </div>
      )}

      {open && (
        <div className="fade-up space-y-5 border-t border-line bg-slate-50/40 px-4 py-5 sm:px-5">
          {p.last_error && (
            <p className="flex items-start gap-2 rounded-xl border border-crit-border bg-crit-bg px-3 py-2 text-xs text-crit-fg">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b className="font-semibold">Last error</b> ({dateTime(p.last_checked_at)}): {p.last_error}
              </span>
            </p>
          )}

          {p.requires_key && (
            <Field
              label="API key"
              info="api_key_storage"
              hint={
                <>
                  {p.has_key ? `Stored key: ${p.key_preview ?? "••••"} (${p.key_source === "env" ? "from backend .env" : "saved here, encrypted"}). Paste a new key to replace it.` : "Keys are encrypted in the database and never sent back to the browser."}
                  {p.key_url && (
                    <a href={p.key_url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 font-medium text-brand-600 hover:underline">
                      Get a key <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </>
              }
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showKey ? "text" : "password"}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={p.has_key ? p.key_preview ?? "••••••••" : "Paste API key"}
                    autoComplete="off"
                    className="h-11 pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Toggle visibility"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button className="h-11 flex-1 sm:flex-none" onClick={saveKey} loading={busy === "key"} disabled={!key.trim()}>
                    <KeyRound className="h-4 w-4" /> Save
                  </Button>
                  {p.has_key && (
                    <Button variant="outline" className="h-11 text-crit-fg" onClick={removeKey}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Base URL" hint={`Default: ${p.default_base_url ?? "—"}`}>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={p.default_base_url ?? ""} />
            </Field>
            {p.extra_fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input value={extra[f.key] ?? ""} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })} />
              </Field>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={saveSettings} loading={busy === "settings"}>
              <Settings2 className="h-3.5 w-3.5" /> Save settings
            </Button>
            <Button variant="outline" size="sm" onClick={test} loading={busy === "test"} disabled={!configured}>
              <Plug className="h-3.5 w-3.5" /> Test connection
            </Button>
            <span className="inline-flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={sync} loading={busy === "sync"} disabled={!configured}>
                <RefreshCw className="h-3.5 w-3.5" /> Sync models from provider
              </Button>
              <InfoTip term="sync_models" />
            </span>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Custom model
            </Button>
            {p.website && (
              <a href={p.website} target="_blank" rel="noreferrer" className="ml-auto inline-flex min-h-[32px] items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
                Website <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            {models ? <ModelsTable models={models} onChanged={() => (mutateModels(), onChanged())} /> : <p className="px-4 py-4 text-sm text-slate-500">Loading models…</p>}
          </div>
          <AddModelModal open={addOpen} onClose={() => setAddOpen(false)} providers={[p]} providerId={p.id} onSaved={() => (mutateModels(), onChanged())} />
        </div>
      )}
    </Card>
  );
}
