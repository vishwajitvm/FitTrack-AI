"use client";

import { useState } from "react";
import Link from "next/link";
import { Keyboard, Save, Trash2, Wand2 } from "lucide-react";
import { Badge, confidenceTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { InfoTip } from "@/components/ui/info-tip";
import { Input, Select } from "@/components/ui/input";
import { MEAL_TYPES } from "@/config/constants";
import { api } from "@/lib/api";
import { fmt, nowTime, pct } from "@/lib/format";
import { guessMeal } from "@/lib/meal-time";
import { notify } from "@/lib/notify";
import type { FoodLog, ParsedItem, ParsedMeal } from "@/lib/types";
import { cn } from "@/lib/utils";

const cell =
  "num h-9 w-full min-w-0 rounded-lg border border-line bg-card px-2 text-right text-sm text-slate-900 transition-colors hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

type NumKey = "grams" | "calories" | "protein" | "carbs" | "fat" | "fibre";

const NUM_FIELDS: { key: NumKey; label: string; accent?: string }[] = [
  { key: "grams", label: "Weight (g)" },
  { key: "calories", label: "Calories", accent: "text-acc-kcal" },
  { key: "protein", label: "Protein (g)", accent: "text-acc-protein" },
  { key: "carbs", label: "Carbs (g)" },
  { key: "fat", label: "Fat (g)" },
  { key: "fibre", label: "Fibre (g)" },
];

/** Rescale macros when grams change (keeps the per-gram ratio from the parser). */
function withGrams(it: ParsedItem, grams: number): ParsedItem {
  const old = it.grams ?? 0;
  if (!old || !(grams > 0)) return { ...it, grams };
  const r = grams / old;
  const r1 = (n: number) => Math.round(n * r * 10) / 10;
  return { ...it, grams, calories: Math.round(it.calories * r), protein: r1(it.protein), carbs: r1(it.carbs), fat: r1(it.fat), fibre: r1(it.fibre) };
}

export function QuickAddText({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [time, setTime] = useState(nowTime);
  const [meal, setMeal] = useState(() => guessMeal(nowTime()));
  const [parsed, setParsed] = useState<ParsedMeal | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);

  const parse = async () => {
    if (!text.trim()) return;
    setBusy("parse");
    try {
      const res = await api.post<ParsedMeal>("/api/food/parse-text", { text, meal_type: meal, date, time });
      setParsed(res);
      setItems(res.items);
      if (!res.items.length) notify.warning("Couldn't recognise any food", "Try simpler words, or describe it on Snap a meal for AI.");
    } catch (err) {
      notify.error(err, "Could not read that meal");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!items.length) return;
    setBusy("save");
    try {
      const logs = await api.post<FoodLog[]>("/api/food/parse-text/save", { items, meal_type: meal, date, time });
      notify.success("Logged", `${logs.length} item(s) added`);
      setText("");
      setParsed(null);
      setItems([]);
      onSaved();
    } catch (err) {
      notify.error(err, "Could not save");
    } finally {
      setBusy(null);
    }
  };

  const update = (i: number, next: ParsedItem) => setItems((all) => all.map((it, idx) => (idx === i ? next : it)));
  const setNum = (i: number, k: NumKey, raw: string) => {
    const v = raw === "" ? 0 : Number(raw);
    update(i, k === "grams" ? withGrams(items[i], v) : { ...items[i], [k]: v });
  };
  const total = items.reduce((a, it) => ({ kcal: a.kcal + it.calories, p: a.p + it.protein }), { kcal: 0, p: 0 });

  return (
    <Card>
      <CardHeader title="Quick add by typing" description="Write what you ate in plain words — no AI needed" icon={<Keyboard className="h-4 w-4" />} info="parse_text" />
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && parse()}
            placeholder="e.g. 2 roti, 1 katori dal and 1 scoop whey"
            className="h-11 sm:flex-1"
            aria-label="What did you eat?"
          />
          <Button onClick={parse} loading={busy === "parse"} disabled={!text.trim()} className="h-11">
            {busy !== "parse" && <Wand2 className="h-4 w-4" />} Read it
          </Button>
        </div>
        <p className="text-[13px] leading-relaxed text-slate-500">
          Understands katori, roti, glass, plate, tbsp… &ldquo;1 scoop whey&rdquo; or &ldquo;protein shake&rdquo; uses the protein powder saved in your{" "}
          <Link href="/profile" className="font-medium text-brand-600 hover:underline">
            Profile
          </Link>
          .
        </p>
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
          <Field label="Meal">
            <Select value={meal} onChange={(e) => setMeal(e.target.value as typeof meal)}>
              {MEAL_TYPES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Time">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        {parsed && (
          <div className="space-y-3 border-t border-line pt-4">
            {items.length > 0 && (
              <>
                <p className="flex items-center gap-1 text-[13px] font-medium text-slate-700">
                  We found {items.length} item{items.length === 1 ? "" : "s"} — check the numbers
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-slate-500">
                    Match <InfoTip term="confidence" />
                  </span>
                </p>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {items.map((it, i) => (
                    <li key={i} className="fade-up space-y-2.5 p-3 transition-colors hover:bg-slate-50/80" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <input
                            value={it.name}
                            onChange={(e) => update(i, { ...it, name: e.target.value })}
                            aria-label="Food name"
                            className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-slate-900 hover:border-line focus:border-brand-500 focus:outline-none"
                          />
                          <span className="block px-1.5 text-[11px] text-slate-500">
                            “{it.text}”{it.quantity !== null ? ` · ${fmt(it.quantity, it.quantity % 1 ? 1 : 0)} ${it.unit ?? ""}` : ""}
                            {it.source ? ` · ${it.source}` : ""}
                          </span>
                        </div>
                        <Badge tone={confidenceTone(it.confidence)} className="mt-0.5">
                          {it.confidence !== null ? pct(it.confidence) : "—"}
                        </Badge>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-crit-bg hover:text-crit-fg" onClick={() => setItems((all) => all.filter((_, idx) => idx !== i))} aria-label="Remove item">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-3">
                        {NUM_FIELDS.map((f) => (
                          <label key={f.key} className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-slate-500">
                            <span className={cn("truncate", f.accent)}>{f.label}</span>
                            <input type="number" inputMode="decimal" className={cell} value={it[f.key] ?? ""} onChange={(e) => setNum(i, f.key, e.target.value)} />
                          </label>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {parsed.unparsed.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-600">
                Not understood:
                {parsed.unparsed.map((u) => (
                  <Badge key={u} tone="warning">
                    {u}
                  </Badge>
                ))}
              </div>
            )}
            {parsed.needs_ai && (
              <p className="rounded-xl border border-info-border bg-info-bg px-3.5 py-2.5 text-[13px] leading-relaxed text-info-fg">
                Some of this needs AI to understand. Describe the meal on{" "}
                <Link href="/food/scan" className="font-semibold underline">
                  Snap a meal
                </Link>{" "}
                (a photo is optional) and the AI will break it down.
              </p>
            )}
            {items.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
                <div className="num text-sm text-slate-600">
                  <p>
                    Total <span className="text-base font-semibold text-acc-kcal">{fmt(total.kcal)} kcal</span> ·{" "}
                    <span className="font-semibold text-acc-protein">{fmt(total.p, 1)} g</span> protein
                  </p>
                  <p className="text-xs text-slate-500">Overall match {pct(parsed.confidence)}</p>
                </div>
                <Button onClick={save} loading={busy === "save"}>
                  {busy !== "save" && <Save className="h-4 w-4" />} Save {items.length} item(s)
                </Button>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
