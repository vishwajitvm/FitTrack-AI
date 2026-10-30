"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ListChecks, Loader2, RotateCcw, ScanSearch } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Skeleton, Switch } from "@/components/ui/misc";
import { useRevalidatePrefix, useRevalidateTracking } from "@/hooks/use-revalidate";
import { api } from "@/lib/api";
import { nowTime, today } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { notify } from "@/lib/notify";
import type { FoodAnalysis } from "@/lib/types";
import { cn, toFormData } from "@/lib/utils";
import { guessMeal } from "@/lib/meal-time";
import { AnalysisResult } from "./analysis-result";
import { PhotoPicker } from "./photo-picker";
import { RecentAnalyses } from "./recent-analyses";
import { ScanDetailsForm, type ScanDetails } from "./scan-details";

const STEPS = [
  { title: "Add your meal", hint: "Photo or a few words" },
  { title: "Analyse", hint: "Calories and macros" },
  { title: "Review & save", hint: "Fix anything, then log it" },
];

const initialDetails = (): ScanDetails => {
  const time = nowTime();
  return {
    description: "",
    ingredients: "",
    container_id: "",
    container_size_ml: "",
    plate_diameter_cm: "",
    fill_level: "",
    known_weight_g: "",
    servings: "1",
    portion_eaten: "1",
    cooking_method: "",
    oil_used: "",
    meal_type: guessMeal(time),
    date: today(),
    time,
  };
};

export function ScanView() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [details, setDetails] = useState<ScanDetails>(initialDetails);
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [mlOnly, setMlOnly] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const revalidateTracking = useRevalidateTracking();
  const revalidatePrefix = useRevalidatePrefix();

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = async (f: File) => {
    const compressed = await compressImage(f);
    setFile(compressed);
    setPreview(URL.createObjectURL(compressed));
  };

  /** `forceAi` re-runs the same inputs but skips the duplicate / usual-meal shortcuts. */
  const analyse = async (forceAi = false) => {
    if (!file && !details.description.trim()) {
      notify.warning("Add a photo or describe the meal", "Either one is enough to start the analysis.");
      return;
    }
    setAnalysing(true);
    setAnalysis(null);
    try {
      const form = toFormData({ ...details, image: file, ml_only: mlOnly && !forceAi ? "true" : null, force_ai: forceAi ? "true" : null });
      const res = await api.upload<FoodAnalysis>("/api/food/analyze", form);
      setAnalysis(res);
      revalidatePrefix("/api/food/analyses");
      if (res.status === "completed" && res.method === "ml_only" && !mlOnly && !forceAi)
        notify.info("Couldn't reach the AI service", "Your meal was estimated on-device instead. Check the numbers, or add a free Google key on the AI page.");
      else if (res.status === "completed") notify.success("Meal analysed", `${res.items.length} item(s) · ~${Math.round(res.totals.calories)} kcal`);
      else notify.error(res.error ?? "Unknown error", "Analysis failed");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      notify.error(err, "Analysis failed");
    } finally {
      setAnalysing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setAnalysis(null);
    setDetails(initialDetails());
  };

  const hasInput = !!file || !!details.description.trim();
  const step = analysis ? 3 : analysing || hasInput ? 2 : 1;

  return (
    <>
      <PageHeader
        title="Snap a meal"
        page="scan"
        description="Take a photo of your plate. Optionally tell us the ingredients, container and how full it is — the AI estimates weight, calories and macros, then verifies them against nutrition databases."
      />

      <ol className="fade-up mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-card p-2 shadow-card" aria-label="Steps">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li
              key={s.title}
              aria-current={current ? "step" : undefined}
              className={cn("flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1.5 py-2 text-center transition-colors sm:flex-row sm:gap-2.5 sm:px-3 sm:text-left", current && "bg-brand-50")}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done ? "bg-navy text-white" : current ? "bg-card text-brand-600 ring-2 ring-brand-500" : "bg-slate-100 text-slate-500",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span className="min-w-0 max-w-full">
                <span className={cn("block truncate text-xs font-semibold sm:text-[13px]", current ? "text-slate-900" : "text-slate-600")}>{s.title}</span>
                <span className="hidden truncate text-xs text-slate-500 sm:block">{s.hint}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="grid items-start gap-5 xl:grid-cols-5">
        <Card className="fade-up xl:col-span-2" style={{ animationDelay: "60ms" }}>
          <CardHeader title="Your meal" description="Photo, description, or both" icon={<Camera className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            <PhotoPicker
              previewUrl={preview}
              onPick={pick}
              onClear={() => {
                setFile(null);
                setPreview(null);
              }}
            />
            <div className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-line bg-slate-50/70 px-3.5 py-2">
              <Switch checked={mlOnly} onChange={setMlOnly} label="Don't use AI (ML only)" />
              <InfoTip term="ml_only" />
            </div>
            <Button size="lg" className="w-full" onClick={() => analyse()} loading={analysing}>
              {!analysing && <ScanSearch className="h-5 w-5" />}
              {analysing ? "Analysing your meal…" : mlOnly ? "Analyse with ML only" : "Analyse meal"}
            </Button>
            {analysis && (
              <Button variant="outline" className="w-full" onClick={reset}>
                <RotateCcw className="h-4 w-4" /> Start a new scan
              </Button>
            )}
          </CardBody>
        </Card>
        <Card className="fade-up xl:col-span-3" style={{ animationDelay: "120ms" }}>
          <CardHeader title="Extra details" description="All optional — each one makes the estimate more accurate" icon={<ListChecks className="h-4 w-4" />} />
          <CardBody>
            <ScanDetailsForm value={details} onChange={setDetails} />
          </CardBody>
        </Card>
      </div>

      <div ref={resultRef} className="mt-6 scroll-mt-20">
        {analysing && (
          <Card className="fade-up overflow-hidden" aria-live="polite">
            <CardBody className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Loader2 className="h-5 w-5 animate-spin" />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">Working on it…</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">
                    {mlOnly
                      ? "Matching your photo against your saved meals and the food library on this device…"
                      : "Identifying ingredients, estimating portion size and verifying macros… this can take 10–40 seconds depending on the AI provider."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        )}
        {analysis && (
          <AnalysisResult
            analysis={analysis}
            defaults={{ meal_type: details.meal_type, date: details.date, time: details.time }}
            onForceAi={() => analyse(true)}
            forcing={analysing}
            onSaved={() => {
              revalidateTracking();
              revalidatePrefix("/api/food/analyses");
            }}
          />
        )}
      </div>

      <div className="mt-6">
        <RecentAnalyses
          onOpen={(a) => {
            setAnalysis(a);
            setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
          }}
        />
      </div>
    </>
  );
}
