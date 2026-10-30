"use client";

import { useState } from "react";
import { CheckCircle2, HeartPulse, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SEVERITY_LABELS, SYMPTOMS } from "@/config/constants";
import { api } from "@/lib/api";
import { dateTime, humanize, nowTime } from "@/lib/format";
import { confirmDelete, notify, withToast } from "@/lib/notify";
import type { BioFeedback, SymptomType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChoiceChips } from "./controls";

const SEVERITY = SEVERITY_LABELS.map((l, i) => ({ value: String(i), label: l }));
const sevTone = ["neutral", "ok", "warning", "critical"] as const;
const sevDot = ["bg-slate-400", "bg-good-fg", "bg-warn-fg", "bg-crit-fg"];
const sevBubble = ["bg-slate-100 text-slate-500", "bg-good-bg text-good-fg", "bg-warn-bg text-warn-fg", "bg-crit-bg text-crit-fg"];

interface SymptomLoggerProps {
  date: string;
  entries: BioFeedback[] | undefined;
  onChanged: () => void;
}

export function SymptomLogger({ date, entries, onChanged }: SymptomLoggerProps) {
  const [symptom, setSymptom] = useState<SymptomType | null>(null);
  const [severity, setSeverity] = useState("1");
  const [time, setTime] = useState(nowTime);
  const [trigger, setTrigger] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!symptom) {
      notify.warning("Pick a symptom first");
      return;
    }
    setSaving(true);
    const ok = await withToast(
      () =>
        api.post("/api/biofeedback", {
          timestamp: `${date}T${time || "12:00"}:00`,
          symptom_type: symptom,
          severity: Number(severity),
          trigger_suspect: trigger || null,
          body_part: bodyPart || null,
          notes: notes || null,
        }),
      `${humanize(symptom)} logged`,
    );
    setSaving(false);
    if (ok) {
      setSymptom(null);
      setTrigger("");
      setBodyPart("");
      setNotes("");
      onChanged();
    }
  };

  const remove = async (b: BioFeedback) => {
    if (!(await confirmDelete("this symptom entry"))) return;
    await withToast(() => api.del(`/api/biofeedback/${b.id}`), "Symptom removed");
    onChanged();
  };

  return (
    <Card className="fade-up" style={{ animationDelay: "80ms" }}>
      <CardHeader
        info="bloating"
        icon={<HeartPulse className="h-4 w-4" />}
        title="Log a symptom"
        description="Bloating, gas, weakness, reflux… the engine cross-references these with your meals."
      />
      <CardBody className="space-y-5">
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-slate-700">What did you notice?</p>
          <ChoiceChips options={SYMPTOMS} value={symptom} onChange={setSymptom} ariaLabel="Symptom" />
        </div>
        <Field label="Severity" info="symptom_severity">
          <ChoiceChips options={SEVERITY} value={severity} onChange={setSeverity} ariaLabel="Severity" dot={(v) => sevDot[Number(v)] ?? "bg-slate-400"} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Time">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Body part (optional)">
            <Input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} placeholder="stomach, lower back…" />
          </Field>
          <Field label="Suspected trigger" className="col-span-2" info="symptom_trigger">
            <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="e.g. milk chai, whey, late dinner" />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <Button onClick={add} loading={saving} size="lg" className="w-full">
          <Plus className="h-4 w-4" /> Add symptom
        </Button>
      </CardBody>

      <div className="border-t border-line">
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <p className="text-[13px] font-semibold text-slate-900">Logged this day</p>
          {!!entries?.length && <Badge tone="neutral">{entries.length}</Badge>}
        </div>
        {!entries?.length ? (
          <p className="mx-5 mb-5 mt-2 flex items-center gap-2 rounded-xl bg-good-bg px-3 py-2.5 text-sm text-good-fg">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Nothing logged — great.
          </p>
        ) : (
          <ul className="divide-y divide-line pb-2">
            {entries.map((b, i) => (
              <li key={b.id} className="fade-up flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/80" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", sevBubble[b.severity] ?? sevBubble[0])}>
                  <HeartPulse className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                    {humanize(b.symptom_type)} <Badge tone={sevTone[b.severity] ?? "neutral"}>{b.severity_label}</Badge>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {dateTime(b.timestamp)}
                    {b.trigger_suspect ? ` · ${b.trigger_suspect}` : ""}
                    {b.notes ? ` · ${b.notes}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-crit-bg hover:text-crit-fg" onClick={() => remove(b)} aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
