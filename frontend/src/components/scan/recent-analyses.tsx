"use client";

import { Camera, History, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { useAnalyses } from "@/hooks/use-food";
import { fileUrl } from "@/lib/api";
import { dateTime, fmt } from "@/lib/format";
import type { FoodAnalysis } from "@/lib/types";

export function RecentAnalyses({ onOpen }: { onOpen: (a: FoodAnalysis) => void }) {
  const { data, isLoading, error } = useAnalyses(12);

  return (
    <Card>
      <CardHeader
        title="Recent analyses"
        description="Tap one to review or save it again"
        icon={<History className="h-4 w-4" />}
        action={data && data.length > 0 ? <span className="num text-[13px] text-slate-500">{data.length} shown</span> : undefined}
      />
      <CardBody>
        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        )}
        {error && <p className="rounded-xl border border-crit-border bg-crit-bg px-3.5 py-2.5 text-[13px] text-crit-fg">Could not load recent analyses: {error.message}</p>}
        {data && data.length === 0 && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-6 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Camera className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm text-slate-500">No analyses yet — your first scan will show up here.</p>
          </div>
        )}
        {data && data.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data.map((a, i) => {
              const img = fileUrl(a.image_url);
              const names = a.items.map((it) => it.name).join(", ") || "No items";
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onOpen(a)}
                  aria-label={`Open analysis: ${names}`}
                  className="fade-up lift group overflow-hidden rounded-xl border border-line bg-card text-left hover:border-brand-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  style={{ animationDelay: `${Math.min(i, 11) * 40}ms` }}
                >
                  <div className="relative">
                    {img ? (
                      <img src={img} alt="" className="aspect-[4/3] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-slate-400">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2">
                      {a.status === "failed" ? <Badge tone="critical">Failed</Badge> : a.saved ? <Badge tone="ok">Saved</Badge> : <Badge tone="warning">Not saved</Badge>}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[13px] font-medium text-slate-900">{names}</p>
                    <p className="num mt-0.5 text-[11px] text-slate-500">
                      <span className="font-semibold text-acc-kcal">{fmt(a.totals.calories)} kcal</span> · {dateTime(a.created_at)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
