"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Beef, Bot, CheckCircle2, Droplets, ExternalLink, Flame, Gauge, Plus, Ruler, Save, Scale, Sparkles, Utensils } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { MacroSplitBar } from "@/components/food/macro";
import { Badge, confidenceTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { AnimatedNumber, IconBubble } from "@/components/ui/fx";
import { Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { MEAL_TYPES } from "@/config/constants";
import { api } from "@/lib/api";
import { fmt, pct } from "@/lib/format";
import { withToast } from "@/lib/notify";
import type { AnalysisItem, FoodAnalysis, FoodLog } from "@/lib/types";
import { InfoTip } from "@/components/ui/info-tip";
import { ANALYSIS_METHOD } from "@/lib/ml-labels";
import { CONF_BAR } from "./confidence";
import { ItemsTable } from "./items-table";
import { MlPanel } from "./ml-panel";
import { sumItems } from "./scale-item";

interface AnalysisResultProps {
  analysis: FoodAnalysis;
  defaults: { meal_type: string; date: string; time: string };
  onSaved: () => void;
  /** Re-run the analysis with AI, ignoring duplicate / usual-meal shortcuts. */
  onForceAi?: () => void;
  forcing?: boolean;
}

const blankItem = (): AnalysisItem => ({
  name: "New item",
  ingredients: [],
  cooking_method: null,
  estimated_weight_g: 100,
  weight_low_g: null,
  weight_high_g: null,
  volume_ml: null,
  calories: 0,
  calories_low: null,
  calories_high: null,
  protein: 0,
  carbs: 0,
  fat: 0,
  fibre: 0,
  per_100g: null,
  source: "manual",
  confidence: 1,
  tags: [],
  notes: null,
});

export function AnalysisResult({ analysis, defaults, onSaved, onForceAi, forcing }: AnalysisResultProps) {
  const [items, setItems] = useState<AnalysisItem[]>(analysis.items);
  const [meta, setMeta] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(analysis.saved);

  useEffect(() => {
    setItems(analysis.items);
    setSaved(analysis.saved);
  }, [analysis]);

  const totals = useMemo(() => sumItems(items), [items]);
  const g = analysis.geometry;

  const save = async () => {
    setSaving(true);
    const res = await withToast(
      () => api.post<FoodLog[]>(`/api/food/analyses/${analysis.id}/save`, { items, ...meta }),
      `Saved ${items.length} item(s) to your food log`,
    );
    setSaving(false);
    if (res) {
      setSaved(true);
      onSaved();
    }
  };

  const confTone = confidenceTone(analysis.overall_confidence);
  const confWord = confTone === "ok" ? "High" : confTone === "warning" ? "Medium" : confTone === "critical" ? "Low" : undefined;

  if (analysis.status === "failed") {
    return (
      <Card className="fade-up">
        <CardBody className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-crit-bg text-crit-fg">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-slate-900">
              Analysis failed <Badge tone="critical">Failed</Badge>
            </p>
            <p className="mt-1 break-words text-[13px] text-crit-fg">{analysis.error ?? "Unknown error"}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              Check that at least one vision-capable AI provider has a key (AI providers page), or that Ollama has a vision model.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const stats = [
    <StatCard
      key="kcal"
      label="Calories"
      info="calorie_range"
      accent="kcal"
      icon={<Flame className="h-4 w-4" />}
      value={<AnimatedNumber value={totals.calories} />}
      unit="kcal"
      sub={`Range ${fmt(totals.calories_low)}–${fmt(totals.calories_high)} kcal`}
    />,
    <StatCard
      key="protein"
      label="Protein"
      info="protein_target"
      accent="protein"
      icon={<Beef className="h-4 w-4" />}
      value={<AnimatedNumber value={totals.protein} digits={1} />}
      unit="g"
      sub={`Carbs ${fmt(totals.carbs, 1)} g · Fat ${fmt(totals.fat, 1)} g`}
    >
      <MacroSplitBar protein={totals.protein} carbs={totals.carbs} fat={totals.fat} className="mt-3 h-1.5" />
    </StatCard>,
    <StatCard key="weight" label="Total weight" info="known_weight" icon={<Scale className="h-4 w-4" />} value={<AnimatedNumber value={totals.weight_grams} />} unit="g" sub={`Fibre ${fmt(totals.fibre, 1)} g`} />,
    <StatCard
      key="conf"
      label="Confidence"
      info="confidence"
      icon={<Gauge className="h-4 w-4" />}
      value={pct(analysis.overall_confidence)}
      tone={confTone === "ok" ? "ok" : confTone === "warning" ? "warning" : "critical"}
      status={confWord}
      sub={`${items.length} item(s) detected`}
    >
      <Progress value={(analysis.overall_confidence ?? 0) * 100} className="mt-3 h-1.5" barClassName={CONF_BAR[confTone]} />
    </StatCard>,
  ];

  return (
    <div className="space-y-5">
      {analysis.method && (
        <div className="fade-up flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 shadow-card">
          <span className="text-[13px] font-medium text-slate-500">Estimated by</span>
          <Badge tone={ANALYSIS_METHOD[analysis.method]?.tone ?? "neutral"}>{ANALYSIS_METHOD[analysis.method]?.label ?? analysis.method}</Badge>
          <InfoTip term="analysis_method" />
          {(analysis.method === "duplicate" || analysis.method === "personal_match") && (
            <>
              <span className="text-[13px] text-slate-500">
                {analysis.method === "duplicate" ? "Same photo as an earlier analysis — that result was reused." : "This looks like a meal you've saved before — that result was reused."}
              </span>
              {onForceAi && (
                <Button size="sm" variant="outline" className="h-9 sm:ml-auto" onClick={onForceAi} loading={forcing}>
                  {!forcing && <Sparkles className="h-3.5 w-3.5" />} Analyze with AI anyway
                </Button>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((card, i) => (
          <div key={i} className="fade-up" style={{ animationDelay: `${i * 50}ms` }}>
            {card}
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Card className="fade-up overflow-hidden lg:col-span-2" style={{ animationDelay: "100ms" }}>
          <CardHeader
            title="Detected items"
            info="data_source"
            icon={<Utensils className="h-4 w-4" />}
            description="Edit names, weights or macros before saving — changing weight rescales the macros."
            action={
              <Button size="sm" variant="outline" className="h-9" onClick={() => setItems((it) => [...it, blankItem()])}>
                <Plus className="h-3.5 w-3.5" /> Item
              </Button>
            }
          />
          <div className="mt-4 border-t border-line">
            <ItemsTable items={items} onChange={setItems} />
          </div>
        </Card>

        <div className="space-y-5">
          {g && (
            <Card className="fade-up" style={{ animationDelay: "150ms" }}>
              <CardHeader title="Portion geometry" icon={<Ruler className="h-4 w-4" />} info="fill_level" />
              <CardBody className="divide-y divide-line pt-3 text-sm">
                <Row label="Container" value={g.container_label ?? "—"} />
                <Row label="Container volume" value={g.container_volume_ml ? `${fmt(g.container_volume_ml)} ml` : "—"} />
                <Row label="Fill" value={g.fill_fraction !== null ? pct(g.fill_fraction) : "—"} />
                <Row label="Food volume" value={g.est_food_volume_ml ? `${fmt(g.est_food_volume_ml)} ml` : "—"} />
                <Row label="Weight from geometry" value={g.est_weight_g_from_geometry ? `${fmt(g.est_weight_g_from_geometry)} g` : "—"} />
              </CardBody>
            </Card>
          )}
          {analysis.portion_reasoning && (
            <Card className="fade-up" style={{ animationDelay: "200ms" }}>
              <CardHeader title="How the portion was estimated" icon={<Sparkles className="h-4 w-4" />} />
              <CardBody className="pt-3 text-[13px] leading-relaxed text-slate-600">{analysis.portion_reasoning}</CardBody>
            </Card>
          )}
          {analysis.hidden_calories.length > 0 && (
            <Card className="fade-up" style={{ animationDelay: "250ms" }}>
              <div className="flex items-center gap-3 px-5 pt-5">
                <IconBubble accent="kcal">
                  <Droplets className="h-4 w-4" />
                </IconBubble>
                <h3 className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-slate-900">
                  Hidden calories <InfoTip term="hidden_calories" />
                </h3>
              </div>
              <CardBody className="pt-3">
                <BulletList items={analysis.hidden_calories} dot="bg-acc-kcal" />
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {analysis.ml && <MlPanel ml={analysis.ml} />}

      {(analysis.warnings.length > 0 || analysis.coach_note) && (
        <div className="grid items-start gap-5 md:grid-cols-2">
          {analysis.warnings.length > 0 && (
            <Card className="fade-up">
              <div className="flex items-center gap-3 px-5 pt-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warn-bg text-warn-fg">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">Warnings</h3>
                <Badge tone="warning" className="ml-auto">
                  {analysis.warnings.length} to check
                </Badge>
              </div>
              <CardBody className="pt-3">
                <BulletList items={analysis.warnings} dot="bg-warn-fg" />
              </CardBody>
            </Card>
          )}
          {analysis.coach_note && (
            <Card className="fade-up" style={{ animationDelay: "50ms" }}>
              <CardHeader title="Coach note" icon={<Bot className="h-4 w-4" />} />
              <CardBody className="pt-3 text-[13px] leading-relaxed text-slate-700">{analysis.coach_note}</CardBody>
            </Card>
          )}
        </div>
      )}

      {(analysis.providers_used.length > 0 || analysis.sources.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="mr-1 font-medium">Sources and models</span>
          {analysis.providers_used.map((p, i) => (
            <Badge key={i} tone="brand">
              {p.task}: {p.provider} / {p.model}
            </Badge>
          ))}
          {analysis.sources.map((s, i) =>
            s.url ? (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-line bg-card px-2.5 py-0.5 font-medium text-slate-700 transition-colors hover:border-brand-500/50 hover:text-brand-600"
              >
                {s.name} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <Badge key={i} tone="neutral">
                {s.name}
              </Badge>
            ),
          )}
        </div>
      )}

      <Card className="fade-up">
        <CardHeader
          title="Save to your food log"
          description={`${items.length} item(s) · ${fmt(totals.calories)} kcal · ${fmt(totals.protein, 1)} g protein`}
          icon={<Save className="h-4 w-4" />}
        />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Meal">
            <Select value={meta.meal_type} onChange={(e) => setMeta({ ...meta, meal_type: e.target.value })}>
              {MEAL_TYPES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
          </Field>
          <Field label="Time">
            <Input type="time" value={meta.time} onChange={(e) => setMeta({ ...meta, time: e.target.value })} />
          </Field>
        </CardBody>
        <CardFooter>
          {saved ? (
            <div className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-good-border bg-good-bg px-4 text-sm font-semibold text-good-fg sm:w-auto">
              <CheckCircle2 className="h-4 w-4" /> Saved to log
            </div>
          ) : (
            <Button size="lg" className="w-full text-sm sm:w-auto" onClick={save} loading={saving} disabled={!items.length}>
              {!saving && <Save className="h-4 w-4" />} Save to log
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function BulletList({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="space-y-2 text-[13px] leading-relaxed text-slate-700">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="num text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
