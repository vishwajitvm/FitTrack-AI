"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Brain, Camera, Pin, Route, Save, Stethoscope, TriangleAlert, X, Zap, type LucideIcon } from "lucide-react";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { Skeleton, Switch } from "@/components/ui/misc";
import { AI_TASKS, CAPABILITIES } from "@/config/constants";
import { useModels, useProviders, useRoutePreview, useRouting } from "@/hooks/use-ai";
import { useRevalidatePrefix } from "@/hooks/use-revalidate";
import { api } from "@/lib/api";
import { humanize } from "@/lib/format";
import { withToast } from "@/lib/notify";
import type { Capability, Model, Routing, TaskRouting } from "@/lib/types";
import { cn } from "@/lib/utils";

const TASK_ICON: Record<string, LucideIcon> = { vision: Camera, reasoning: Brain, fast: Zap, medical: Stethoscope };

export function RoutingTab() {
  const { data, error, isLoading, mutate } = useRouting();
  const { data: models } = useModels();
  const { data: providers } = useProviders();
  const revalidatePrefix = useRevalidatePrefix();
  const [draft, setDraft] = useState<Routing | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const names = useMemo(() => Object.fromEntries((providers ?? []).map((p) => [p.id, p.name])), [providers]);
  const enabledModels = (models ?? []).filter((m) => m.enabled);

  const tasks = draft ? Array.from(new Set([...AI_TASKS.map((t) => t.key), ...Object.keys(draft.tasks)])) : [];

  const setTask = (key: string, t: TaskRouting) => setDraft((d) => (d ? { ...d, tasks: { ...d.tasks, [key]: t } } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const res = await withToast(() => api.put<Routing>("/api/ai/routing", draft), "Routing saved");
    setSaving(false);
    if (res) {
      mutate(res, false);
      revalidatePrefix("/api/ai/routing/preview");
    }
  };

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !draft) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Global fallback rules"
          description="Applies to every task. Saving also saves the task settings below."
          info="provider_priority"
          icon={<Route className="h-4 w-4" />}
          action={
            <Button onClick={save} loading={saving}>
              <Save className="h-4 w-4" /> <span className="hidden sm:inline">Save routing</span>
              <span className="sm:hidden">Save</span>
            </Button>
          }
        />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field info="ollama_last_resort" label="Ollama as last resort" hint="When every cloud provider fails or is rate-limited, try local Ollama models.">
            <div className="flex h-10 items-center">
              <Switch checked={draft.ollama_last_resort} onChange={(v) => setDraft({ ...draft, ollama_last_resort: v })} label={draft.ollama_last_resort ? "On" : "Off"} />
            </div>
          </Field>
          <Field label="Timeout per attempt (seconds)" info="call_status">
            <Input type="number" min={5} value={draft.timeout_seconds} onChange={(e) => setDraft({ ...draft, timeout_seconds: Number(e.target.value) })} />
          </Field>
          <Field info="rate_limit" label="Max attempts per request" hint="How many models to try before giving up.">
            <Input type="number" min={1} value={draft.max_attempts} onChange={(e) => setDraft({ ...draft, max_attempts: Number(e.target.value) })} />
          </Field>
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {tasks.map((key, i) => {
          const meta = AI_TASKS.find((t) => t.key === key);
          const t = draft.tasks[key] ?? { capability: "chat" as Capability, pinned: [] };
          return (
            <div key={key} className="fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <TaskCard taskKey={key} label={meta?.label ?? humanize(key)} description={meta?.description} task={t} models={enabledModels} providerNames={names} onChange={(nt) => setTask(key, nt)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TaskCardProps {
  taskKey: string;
  label: string;
  description?: string;
  task: TaskRouting;
  models: Model[];
  providerNames: Record<string, string>;
  onChange: (t: TaskRouting) => void;
}

const iconBtn = "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30";

function TaskCard({ taskKey, label, description, task, models, providerNames, onChange }: TaskCardProps) {
  const { data: preview, isLoading } = useRoutePreview(taskKey);
  const candidates = models.filter((m) => m.capabilities.includes(task.capability) && !task.pinned.some((p) => p.provider_id === m.provider_id && p.model_id === m.model_id));
  const Icon = TASK_ICON[taskKey] ?? Route;

  const move = (i: number, dir: -1 | 1) => {
    const pinned = [...task.pinned];
    const j = i + dir;
    if (j < 0 || j >= pinned.length) return;
    [pinned[i], pinned[j]] = [pinned[j], pinned[i]];
    onChange({ ...task, pinned });
  };

  return (
    <Card className="h-full">
      <CardHeader title={label} description={description} info="routing_tasks" icon={<Icon className="h-4 w-4" />} />
      <CardBody className="space-y-5">
        <Field label="Required capability" info="capabilities">
          <Select value={task.capability} onChange={(e) => onChange({ ...task, capability: e.target.value as Capability })}>
            {CAPABILITIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <p className="mb-2 flex items-center gap-1 text-[13px] font-medium text-slate-700">
            Pinned models (tried first, in this order) <InfoTip term="pinned_models" />
          </p>
          {task.pinned.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500">
              <Pin className="h-3.5 w-3.5" /> None — the router uses provider priority.
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {task.pinned.map((p, i) => (
                <li key={`${p.provider_id}/${p.model_id}`} className="flex items-center gap-2 py-1 pl-3 pr-1 text-xs hover:bg-slate-50/80">
                  <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <b className="font-semibold text-slate-900">{providerNames[p.provider_id] ?? p.provider_id}</b> · <span className="font-mono text-slate-600">{p.model_id}</span>
                  </span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={iconBtn} aria-label="Up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === task.pinned.length - 1} className={iconBtn} aria-label="Down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...task, pinned: task.pinned.filter((_, idx) => idx !== i) })}
                    className={cn(iconBtn, "text-crit-fg hover:bg-crit-bg hover:text-crit-fg")}
                    aria-label="Unpin"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Select
            className="mt-2"
            value=""
            aria-label={`Pin a model for ${label}`}
            onChange={(e) => {
              const m = candidates.find((c) => String(c.id) === e.target.value);
              if (m) onChange({ ...task, pinned: [...task.pinned, { provider_id: m.provider_id, model_id: m.model_id }] });
            }}
          >
            <option value="">+ Pin an enabled {humanize(task.capability).toLowerCase()} model…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {providerNames[m.provider_id] ?? m.provider_id} · {m.display_name}
              </option>
            ))}
          </Select>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="mb-3 text-[13px] font-medium text-slate-700">Effective fallback chain (saved settings)</p>
          {isLoading && <Skeleton className="h-16" />}
          {preview && preview.length === 0 && (
            <p className="flex items-start gap-2 text-xs text-warn-fg">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              No usable model — add a key for a provider with a {task.capability} model, or install one in Ollama.
            </p>
          )}
          <ol className="space-y-0">
            {preview?.slice(0, 10).map((p, i, arr) => (
              <li key={`${p.provider_id}/${p.model_id}`} className="relative flex items-center gap-2.5 pb-2 text-xs last:pb-0">
                {i < arr.length - 1 && <span className="absolute left-[9.5px] top-5 h-[calc(100%-1rem)] w-px bg-line" aria-hidden />}
                <span
                  className={cn(
                    "num relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    i === 0 ? "bg-navy text-white" : "border border-line bg-card text-slate-500",
                  )}
                >
                  {i + 1}
                </span>
                <span className={cn("truncate", i === 0 ? "font-medium text-slate-900" : "text-slate-600")}>
                  {p.provider_name} · {p.display_name}
                </span>
                {i === 0 && <span className="shrink-0 text-[11px] text-brand-600">tried first</span>}
              </li>
            ))}
          </ol>
          {preview && preview.length > 10 && <p className="mt-2 text-[11px] text-slate-500">+ {preview.length - 10} more</p>}
        </div>
      </CardBody>
    </Card>
  );
}
