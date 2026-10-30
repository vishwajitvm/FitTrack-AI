"use client";

import { useState } from "react";
import { ChevronDown, ListChecks, Pencil, Sparkles, Trash2 } from "lucide-react";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePresets } from "@/hooks/use-quicklog";
import { api } from "@/lib/api";
import { fmt, humanize } from "@/lib/format";
import { askText, confirmDelete, notify, withToast } from "@/lib/notify";
import type { Preset, PresetKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./emoji-picker";
import { PresetItemsEditor } from "./preset-items-editor";

/** Collapsible "Routines & presets" card: rename, icon, edit items, delete. Most-used first. */
export function PresetsManager({ kind }: { kind: PresetKind }) {
  const [open, setOpen] = useState(false);
  const { data, error, isLoading, mutate } = usePresets(kind);
  const [editing, setEditing] = useState<Preset | null>(null);
  const title = kind === "workout" ? "Your routines" : "Your saved meals";

  const update = async (p: Preset, patch: Partial<Preset>, msg: string) => {
    mutate((list) => list?.map((x) => (x.id === p.id ? { ...x, ...patch } : x)), false); // optimistic
    try {
      await api.put(`/api/presets/${p.id}`, patch);
      notify.success(msg);
    } catch (err) {
      notify.error(err, "Could not save");
    }
    mutate();
  };

  const rename = async (p: Preset) => {
    const name = await askText(kind === "workout" ? "Rename routine" : "Rename meal", { value: p.name });
    if (name && name !== p.name) update(p, { name }, "Renamed");
  };

  const remove = async (p: Preset) => {
    if (!(await confirmDelete(`"${p.name}"`, "Entries you already logged with it are kept."))) return;
    await withToast(() => api.del(`/api/presets/${p.id}`), "Deleted");
    mutate();
  };

  return (
    <Card className="overflow-visible">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn("flex min-h-[64px] w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50/80", open ? "rounded-t-2xl" : "rounded-2xl")}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <ListChecks className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-slate-900">
              {title}
              {data && data.length > 0 && <span className="num rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{data.length}</span>}
            </span>
            <span className="block text-[13px] text-slate-500">{data ? `${data.length} saved · rename, change icon, edit or delete` : "Manage what one-tap logging uses"}</span>
          </span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="fade-up border-t border-line">
          {error && (
            <div className="p-4">
              <ErrorState error={error} onRetry={() => mutate()} />
            </div>
          )}
          {isLoading && (
            <div className="p-4">
              <ListSkeleton rows={3} />
            </div>
          )}
          {data?.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Sparkles className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-slate-900">{kind === "workout" ? "No routines yet" : "No saved meals yet"}</p>
              <p className="max-w-sm text-[13px] text-slate-500">
                {kind === "workout" ? "Log a workout, then tap “Save as routine” above the day's log." : "Log a meal, then tap “Save as preset” on that meal in the log."}
              </p>
            </div>
          )}
          {!!data?.length && (
            <ul className="divide-y divide-line">
              {data.map((p, i) => (
                <li key={p.id} className="fade-up flex items-center gap-2 px-3 py-2 transition-colors hover:bg-slate-50/80 sm:gap-3 sm:px-4" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <EmojiPicker value={p.icon} onPick={(icon) => update(p, { icon }, "Icon changed")} />
                  <button type="button" onClick={() => rename(p)} className="min-h-[44px] min-w-0 flex-1 rounded-lg text-left" title="Rename">
                    <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                    <span className="num block truncate text-xs text-slate-500">
                      {[p.split && humanize(p.split), p.meal_type && humanize(p.meal_type), p.summary?.calories != null && `${fmt(p.summary.calories)} kcal`, p.summary?.exercises != null && `${p.summary.exercises} exercises`, `used ${p.use_count}×`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setEditing(p)} aria-label={`Edit items of ${p.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-11 w-11 text-crit-fg hover:bg-crit-bg" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <PresetItemsEditor preset={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />
    </Card>
  );
}
