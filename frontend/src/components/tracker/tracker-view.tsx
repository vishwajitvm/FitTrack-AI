"use client";

import { useEffect, useState } from "react";
import { CalendarDays, LayoutDashboard, LineChart, SlidersHorizontal } from "lucide-react";
import { DateNav } from "@/components/common/date-nav";
import { PageHeader } from "@/components/common/page-header";
import { CardsSkeleton, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton, Switch, Tabs } from "@/components/ui/misc";
import { useDaily } from "@/hooks/use-daily";
import { useRevalidateTracking } from "@/hooks/use-revalidate";
import { today } from "@/lib/format";
import { AdvancedDay } from "./advanced-day";
import { BasicDay } from "./basic-day";
import { RangeView } from "./range-view";

const ADVANCED_KEY = "fittrack.tracker.advanced";

type View = "day" | "range";

export function TrackerView() {
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(today);
  const [advanced, setAdvanced] = useState(false);
  const { data, error, isLoading, mutate } = useDaily(date);
  const revalidate = useRevalidateTracking();

  // Remember the Basic/Advanced preference per browser.
  useEffect(() => {
    try {
      setAdvanced(localStorage.getItem(ADVANCED_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggleAdvanced = (v: boolean) => {
    setAdvanced(v);
    try {
      localStorage.setItem(ADVANCED_KEY, v ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <>
      <PageHeader
        title="Daily tracker"
        page="tracker"
        description="The basics at a glance. Switch on Advanced for the full energy breakdown, meal-by-meal macros, check-in metrics and coach review."
        actions={<Switch checked={advanced} onChange={toggleAdvanced} label="Advanced" />}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          className="w-fit"
          tabs={[
            {
              value: "day",
              label: (
                <>
                  <CalendarDays className="h-4 w-4" /> Single day
                </>
              ),
            },
            {
              value: "range",
              label: (
                <>
                  <LineChart className="h-4 w-4" /> Trends & weekly
                </>
              ),
            },
          ]}
          value={view}
          onChange={setView}
        />
        {view === "day" && <DateNav value={date} onChange={setDate} />}
      </div>
      {view === "day" ? (
        <div className="space-y-5">
          {error && <ErrorState error={error} onRetry={() => mutate()} />}
          {isLoading && (
            <div className="space-y-5">
              <Skeleton className="h-48 rounded-3xl" />
              <CardsSkeleton count={5} />
            </div>
          )}
          {data && (
            <>
              <BasicDay detail={data} />
              {advanced ? (
                <AdvancedDay
                  detail={data}
                  onChanged={() => {
                    mutate();
                    revalidate();
                  }}
                />
              ) : (
                <Card className="fade-up flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <LayoutDashboard className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-slate-900">Want the full picture?</p>
                    <p className="mt-0.5 text-[13px] text-slate-500">Turn on &ldquo;Advanced&rdquo; (top right) to see the energy breakdown, meal-by-meal macros, check-in metrics and coach review for this day.</p>
                  </div>
                  <Button variant="outline" className="min-h-[44px] self-start sm:self-auto" onClick={() => toggleAdvanced(true)}>
                    <SlidersHorizontal className="h-4 w-4" /> Show advanced
                  </Button>
                </Card>
              )}
            </>
          )}
        </div>
      ) : (
        <RangeView
          onPickDate={(d) => {
            setDate(d);
            setView("day");
          }}
        />
      )}
    </>
  );
}
