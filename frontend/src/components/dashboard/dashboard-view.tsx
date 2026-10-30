"use client";

import Link from "next/link";
import { Bot, Dumbbell, ShieldAlert } from "lucide-react";
import { AlertList } from "@/components/common/alert-list";
import { PageHeader } from "@/components/common/page-header";
import { CardsSkeleton, ErrorState } from "@/components/common/states";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { RecommendationPanel } from "@/components/workouts/recommendation-panel";
import { useDashboard } from "@/hooks/use-dashboard";
import { useInsightsSummary } from "@/hooks/use-insights";
import { prettyDate } from "@/lib/format";
import { ShowDetails } from "@/components/common/details";
import { usePrefs } from "@/components/layout/prefs-provider";
import { DashboardCharts } from "./dashboard-charts";
import { HeroBanner } from "./hero-banner";
import { ReadinessTile } from "./readiness-tile";
import { DailyBrief } from "./daily-brief";
import { PAGE_INTROS } from "@/config/page-intros";
import { TodayCard } from "./today-card";
import { MlStrip } from "./ml-strip";
import { BiometricsBanner, QuickActions } from "./quick-actions";
import { SummaryCards } from "./summary-cards";

/** Bento layout: hero + readiness on top, the four numbers, then today's plan beside quick actions and alerts. */
export function DashboardView() {
  const { data, error, isLoading, mutate } = useDashboard(7);
  const rec = data?.recommendation ?? null;
  const { data: ml } = useInsightsSummary();
  const { t } = usePrefs();

  return (
    <>
      <PageHeader
        title="Dashboard"
        page="dashboard"
        brief={<DailyBrief fallback={PAGE_INTROS.dashboard} />}
        description={
          data
            ? `${prettyDate(data.today.date, { weekday: "long", day: "numeric", month: "long" })} · Day ${data.today.day_number ?? "—"}${data.today.is_rest_day ? " · Rest day" : ""}`
            : "Your day at a glance"
        }
      />
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {isLoading && (
        <div className="space-y-4">
          <CardsSkeleton />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      )}
      {data && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <HeroBanner data={data} className="lg:col-span-8" />
          <ReadinessTile rec={rec} className="lg:col-span-4" />

          {data.profile_metrics.missing_fields.length > 0 && (
            <div className="lg:col-span-12">
              <BiometricsBanner missing={data.profile_metrics.missing_fields} />
            </div>
          )}

          <div className="lg:col-span-12">
            <SummaryCards today={data.today} week={data.week} metrics={data.profile_metrics} confidence={ml?.adaptive_confidence} />
          </div>

          <div className="lg:col-span-7">
            <TodayCard />
          </div>
          <div className="space-y-5 lg:col-span-5">
            <QuickActions />
            <Card>
              <CardHeader
                title={t("Things to fix today", "Coach alerts")}
                description={data.alerts.length ? `${data.alerts.length} thing${data.alerts.length === 1 ? "" : "s"} worth a look` : "Nothing to fix right now"}
                icon={<ShieldAlert className="h-4 w-4" />}
                accent="burn"
                info="alert_levels"
              />
              <CardBody className="scrollbar-thin max-h-[380px] overflow-y-auto">
                <AlertList alerts={data.alerts} />
              </CardBody>
            </Card>
          </div>

          <div className="lg:col-span-12">
            <ShowDetails label="Show charts, trends & ML insights">
              <div className="space-y-5">
                <MlStrip />
                <DashboardCharts data={data} />
                <Card>
                  <CardHeader
                    title="Today's training"
                    icon={<Dumbbell className="h-4 w-4" />}
                    accent="burn"
                    info="volume_modifier"
                    action={
                      <Link href="/workouts" className="text-xs font-medium text-brand-600 hover:underline">
                        Open workouts
                      </Link>
                    }
                  />
                  <CardBody>{rec ? <RecommendationPanel rec={rec} compact /> : <p className="text-sm text-slate-500">No recommendation yet.</p>}</CardBody>
                </Card>
              </div>
            </ShowDetails>
          </div>

          <Card className="lg:col-span-12">
            <CardBody className="flex flex-col gap-2 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-3 text-slate-600">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-hero text-white">
                  <Bot className="h-4 w-4" />
                </span>
                {data.ai_status.configured_providers
                  ? t(`AI helper connected (${data.ai_status.configured_providers})`, `AI: ${data.ai_status.configured_providers} provider(s) configured · ${data.ai_status.enabled_models} models enabled · Ollama ${data.ai_status.ollama_reachable ? "online" : "offline"}`)
                  : "No AI helper connected — everything works, photos are estimated on-device. A free Google key makes photo analysis better."}
              </span>
              <Link href="/ai" className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand-600 hover:underline">
                {data.ai_status.configured_providers ? "Manage AI →" : "Set up free AI (1 min) →"}
              </Link>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
