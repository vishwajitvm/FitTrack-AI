"use client";

import { useState } from "react";
import { ExternalLink, KeyRound, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { confirmAction, withToast } from "@/lib/notify";
import type { AppSettings } from "@/lib/types";

const HELP: Record<string, string> = {
  usda_api_key: "USDA FoodData Central — verified macros for whole foods. Free; DEMO_KEY works with low limits.",
  tavily_api_key: "Tavily web search — grounds Indian recipes and restaurant dishes with real sources.",
  serper_api_key: "Serper (Google search API) — alternative web search for nutrition grounding.",
};

export function IntegrationsCard({ settings, onSaved }: { settings: AppSettings; onSaved: (s: AppSettings) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (key: string, value: string) => {
    setBusy(key);
    const res = await withToast(() => api.put<AppSettings>("/api/settings", { integrations: { [key]: value } }), value ? "Key saved" : "Key removed");
    setBusy(null);
    if (res) {
      setDrafts((d) => ({ ...d, [key]: "" }));
      onSaved(res);
    }
  };

  const remove = async (key: string, label: string) => {
    if (await confirmAction({ title: `Remove ${label} key?`, confirmText: "Remove", danger: true })) save(key, "");
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4" info="data_source" title="Nutrition & search integrations" description="Optional keys used to verify food data. Stored encrypted in the database." icon={<Plug className="h-4 w-4" />} />
      <ul className="divide-y divide-line border-t border-line">
        {Object.entries(settings.integrations).map(([key, info]) => (
          <li key={key} className="space-y-2.5 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{info.label}</span>
              {info.has_key ? (
                <Badge tone="ok">
                  <span className="h-1.5 w-1.5 rounded-full bg-good-fg" aria-hidden />
                  Configured{info.source === "env" ? " · from backend .env" : ""} · <span className="font-mono">{info.preview}</span>
                </Badge>
              ) : (
                <Badge tone="neutral">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
                  Not set
                </Badge>
              )}
              {info.help_url && (
                <a href={info.help_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:underline">
                  Get a key <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {HELP[key] && <p className="text-xs leading-relaxed text-slate-500">{HELP[key]}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  autoComplete="off"
                  value={drafts[key] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                  placeholder={info.has_key ? "Paste a new key to replace" : "Paste key"}
                  aria-label={`${info.label} key`}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 sm:flex-none" onClick={() => save(key, (drafts[key] ?? "").trim())} disabled={!(drafts[key] ?? "").trim()} loading={busy === key}>
                  <KeyRound className="h-4 w-4" /> Save
                </Button>
                {info.has_key && info.source !== "env" && (
                  <Button variant="outline" className="text-crit-fg" onClick={() => remove(key, info.label)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
