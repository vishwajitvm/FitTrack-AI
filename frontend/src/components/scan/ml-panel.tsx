"use client";

import { Brain, CameraOff, ImageOff, SlidersHorizontal } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { fileUrl } from "@/lib/api";
import { fmt, humanize, pct, prettyDate } from "@/lib/format";
import type { AnalysisML } from "@/lib/types";
import { cn } from "@/lib/utils";

/** On-device ML findings for a photo analysis: quality, dish guesses, similar meals, calibration. */
export function MlPanel({ ml }: { ml: AnalysisML }) {
  const q = ml.image_quality;
  const hasContent = (q && (q.is_blurry || q.is_dark)) || ml.predictions.length || ml.similar_meals.length || ml.calibration;
  if (!hasContent) return null;

  return (
    <Card className="fade-up">
      <CardHeader title="ML insights" description="On-device checks — no AI involved" icon={<Brain className="h-4 w-4" />} info="ml_overview" />
      <CardBody className="space-y-5">
        {q && (q.is_blurry || q.is_dark) && (
          <div className="flex items-start gap-3 rounded-xl border border-warn-border bg-warn-bg px-3.5 py-3 text-[13px] text-warn-fg">
            <CameraOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-relaxed">
              <b>{q.is_blurry && q.is_dark ? "Blurry and dark photo" : q.is_blurry ? "Blurry photo" : "Dark photo"}.</b> {q.message ?? "Estimates may be less accurate — retake in good light if you can."}
            </span>
            <InfoTip term="image_quality" className="ml-auto mt-0.5" />
          </div>
        )}

        {ml.predictions.length > 0 && (
          <div>
            <p className="mb-2.5 flex items-center gap-1 text-[13px] font-medium text-slate-600">
              Dish guesses <InfoTip term="zero_shot" />
            </p>
            <ul className="space-y-2">
              {ml.predictions.map((p, i) => (
                <li key={p.label} className="flex items-center gap-3 text-sm">
                  <span className={cn("w-32 shrink-0 truncate sm:w-44", i === 0 ? "font-semibold text-slate-900" : "text-slate-600")}>{humanize(p.label)}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div className={cn("h-full rounded-full transition-[width] duration-700", i === 0 ? "bg-brand-500" : "bg-slate-300")} style={{ width: `${Math.max(0, Math.min(100, p.score * 100))}%` }} />
                  </div>
                  <span className="num w-10 shrink-0 text-right text-xs text-slate-500">{pct(p.score)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ml.similar_meals.length > 0 && (
          <div>
            <p className="mb-2.5 flex items-center gap-1 text-[13px] font-medium text-slate-600">
              Similar past meals <InfoTip term="similar_meals" />
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ml.similar_meals.map((m, i) => {
                const img = fileUrl(m.image_url);
                return (
                  <div key={m.analysis_id} className="fade-up lift overflow-hidden rounded-xl border border-line bg-card" style={{ animationDelay: `${i * 50}ms` }}>
                    {img ? (
                      <img src={img} alt={m.name} className="aspect-[4/3] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-slate-400">
                        <ImageOff className="h-4 w-4" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="truncate text-[13px] font-medium text-slate-900">{m.name}</p>
                      <p className="num mt-0.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-brand-600">{pct(m.similarity)} similar</span> · <span className="text-acc-kcal">{fmt(m.calories)} kcal</span> ·{" "}
                        {prettyDate(m.date, { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {ml.calibration && (
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-[13px] text-slate-600">
            <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <p className="flex flex-wrap items-center gap-1 leading-relaxed">
              <b className="text-slate-900">Portion calibration:</b> your past corrections for {humanize(ml.calibration.food_category ?? "this food")}
              {ml.calibration.container_id ? ` in ${humanize(ml.calibration.container_id)}` : ""} scaled the estimate ×{fmt(ml.calibration.factor, 2)} (from {ml.calibration.samples}{" "}
              correction{ml.calibration.samples === 1 ? "" : "s"}).
              <InfoTip term="calibration" />
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
