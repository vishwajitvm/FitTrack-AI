"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { useProviders } from "@/hooks/use-ai";
import { useRevalidatePrefix } from "@/hooks/use-revalidate";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import { ProviderBubble } from "./provider-card";

/** One-path setup for non-technical users: Google Gemini (free) → get key → paste → done. */
export function RecommendedSetup() {
  const { data: providers, isLoading } = useProviders();
  const revalidatePrefix = useRevalidatePrefix();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const gemini = providers?.find((p) => p.id === "gemini");
  const connected = providers?.filter((p) => p.requires_key && p.has_key) ?? [];

  const save = async () => {
    if (!key.trim()) return;
    setBusy(true);
    try {
      await api.put("/api/ai/providers/gemini", { api_key: key.trim(), enabled: true });
      setKey("");
      const r = await api.post<{ ok: boolean; message: string }>("/api/ai/providers/gemini/test");
      if (r.ok) notify.success("Connected!", "Google Gemini works — meal photos now use AI.");
      else notify.warning("Key saved, but the test failed", "Double-check you copied the whole key. You can paste it again.");
      revalidatePrefix("/api/ai", "/api/dashboard");
    } catch (err) {
      notify.error(err, "Could not save the key");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />;

  if (connected.length) {
    return (
      <Card className="fade-up">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-good-bg text-good-fg">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-slate-900">
              AI is set up — you&apos;re done.
              <Badge tone="ok">
                <span className="h-1.5 w-1.5 rounded-full bg-good-fg" aria-hidden />
                {connected.length} connected
              </Badge>
            </p>
            <p className="mt-1 leading-relaxed text-slate-600">
              Connected: {connected.map((p) => p.name).join(", ")}. If one runs out of free quota, the next is used automatically. Adding a second free provider (Groq or OpenRouter) is
              optional extra safety.
            </p>
          </div>
          <div className="flex -space-x-2" aria-hidden>
            {connected.slice(0, 4).map((p) => (
              <ProviderBubble key={p.id} name={p.name} id={p.id} className="ring-2 ring-card" />
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="fade-up border-brand-500/40">
      <CardHeader title="Recommended setup (1 minute, free)" description="Google Gemini — best for meal photos, no credit card" icon={<Sparkles className="h-4 w-4" />} info="free_only_policy" />
      <CardBody className="space-y-5">
        <ol className="space-y-0 text-sm text-slate-700">
          <Step n={1}>
            <p className="font-medium text-slate-900">Open Google AI Studio and sign in</p>
            <p className="text-[13px] text-slate-500">Use your normal Google account.</p>
            <a
              href={gemini?.key_url ?? "https://aistudio.google.com/apikey"}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 font-medium text-brand-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              Open Google AI Studio <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Step>
          <Step n={2}>
            <p className="font-medium text-slate-900">
              Tap <b>&ldquo;Create API key&rdquo;</b>, then <b>copy</b> the key
            </p>
            <p className="text-[13px] text-slate-500">It&apos;s a long code that starts with AIza.</p>
          </Step>
          <Step n={3} last>
            <p className="font-medium text-slate-900">
              Paste it here and press <b>Connect</b>
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <span className="relative flex-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your key (starts with AIza…)" aria-label="Google Gemini API key" className="h-11 pl-9" />
              </span>
              <Button className="min-h-[44px]" onClick={save} loading={busy} disabled={!key.trim()}>
                Connect
              </Button>
            </div>
          </Step>
        </ol>
        <p className="text-xs text-slate-500">Your key is stored encrypted on your own server. Don&apos;t want AI? Skip this — the app estimates meals on-device.</p>
      </CardBody>
    </Card>
  );
}

function Step({ n, last, children }: { n: number; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className="absolute left-[15px] top-9 h-[calc(100%-2.5rem)] w-px bg-line" aria-hidden />}
      <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white shadow-sm">{n}</span>
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </li>
  );
}
