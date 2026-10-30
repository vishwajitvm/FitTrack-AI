"use client";

import type { ReactNode } from "react";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { PageHeader } from "@/components/common/page-header";
import { InfoTip } from "@/components/ui/info-tip";
import { AnomaliesCard } from "./anomalies-card";
import { ExpenditureSection } from "./expenditure-section";
import { InsightsSummary } from "./insights-summary";
import { MealSuggestionsCard } from "./meal-suggestions-card";
import { ReadinessModelCard } from "./readiness-model-card";
import { TrainingLoadSection } from "./training-load-section";
import { WeightSection } from "./weight-section";

export function InsightsView() {
  return (
    <>
      <PageHeader
        title="Insights (ML)"
        page="insights"
        description={
          <span className="inline-flex flex-wrap items-center gap-1">
            On-device machine learning that learns from your own data — real calorie burn, weight trend, training load and what drives your energy. Free, private, no AI key needed.
            <InfoTip term="ml_overview" />
          </span>
        }
      />
      <div className="space-y-8">
        <InsightsSummary />
        <Section title="Body & energy" description="Your weight trend and how many calories you really burn, learned from your own log.">
          <WeightSection />
          <ExpenditureSection />
          <MealSuggestionsCard />
        </Section>
        <Section title="Training" description="How hard you've been working compared with what your body is used to.">
          <TrainingLoadSection />
        </Section>
        <Section title="Recovery & data quality" description="What moves your morning energy, and anything odd in your log.">
          <div className="grid gap-5 lg:grid-cols-2">
            <ReadinessModelCard />
            <AnomaliesCard />
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <CollapsibleSection id={title} title={title} description={description} bodyClassName="space-y-5 pt-4">
      {children}
    </CollapsibleSection>
  );
}
