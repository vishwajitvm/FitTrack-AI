"use client";

import { useState } from "react";
import { FlaskConical, MessageSquareText, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/input";
import { AI_TASKS } from "@/config/constants";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import type { PlaygroundResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusTone = { success: "ok", rate_limited: "warning", timeout: "warning", error: "critical" } as const;

export function PlaygroundTab({ onRan }: { onRan: () => void }) {
  const [task, setTask] = useState("reasoning");
  const [prompt, setPrompt] = useState("I weigh 94.5 kg and ate 945 kcal with 66 g protein yesterday, then trained push day. What should I change today?");
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    try {
      const r = await api.post<PlaygroundResult>("/api/ai/playground", { task, prompt });
      setResult(r);
      notify.success("Response received", r.provider ? `${r.provider} / ${r.model}` : undefined);
    } catch (err) {
      notify.error(err, "All providers failed");
    } finally {
      setRunning(false);
      onRan();
    }
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Test the router" description="Sends a prompt through the same fallback chain the app uses." icon={<FlaskConical className="h-4 w-4" />} />
        <CardBody className="space-y-4">
          <Field label="Task" info="routing_tasks">
            <Select value={task} onChange={(e) => setTask(e.target.value)}>
              {AI_TASKS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prompt">
            <Textarea rows={7} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="leading-relaxed" />
          </Field>
        </CardBody>
        <CardFooter>
          <Button onClick={run} loading={running} disabled={!prompt.trim()}>
            <Send className="h-4 w-4" /> Run
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader title="Response" description={result?.provider ? `Answered by ${result.provider} / ${result.model}` : "The answer and every attempt show here."} icon={<MessageSquareText className="h-4 w-4" />} />
        <CardBody className="space-y-4">
          {result ? (
            <p className="fade-up whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">{result.text}</p>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Send className="h-4 w-4" />
              </span>
              <p className="text-sm text-slate-500">Run a prompt to see the answer and every attempt.</p>
            </div>
          )}
          {result && result.attempts.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-medium text-slate-700">Attempts</p>
              <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {result.attempts.map((a, i) => (
                  <li key={i} className="fade-up flex items-start gap-3 px-3 py-2.5" style={{ animationDelay: `${i * 40}ms` }}>
                    <span
                      className={cn(
                        "num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                        a.status === "success" ? "bg-good-bg text-good-fg" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-xs text-slate-700">
                      {a.provider} / <span className="break-all font-mono">{a.model}</span>
                      {a.error && <span className="mt-0.5 block text-[11px] text-crit-fg">{a.error}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={statusTone[a.status as keyof typeof statusTone] ?? "neutral"}>{a.status}</Badge>
                      <span className="num text-[11px] text-slate-500">{a.latency_ms ?? "—"} ms</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
