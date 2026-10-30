"use client";

import type { ReactNode } from "react";
import { DetailedOnly, ShowDetails } from "@/components/common/details";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { Skeleton } from "@/components/ui/misc";
import { useSettings } from "@/hooks/use-settings";
import { DataCard } from "./data-card";
import { DisplayCard } from "./display-card";
import { IntegrationsCard } from "./integrations-card";
import { MlCard } from "./ml-card";
import { SystemCard } from "./system-card";

function Section({ title, description, children, delay = 0 }: { title: string; description: string; children: ReactNode; delay?: number }) {
  return (
    <section className="fade-up space-y-3" style={{ animationDelay: `${delay}ms` }}>
      <div className="px-1">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="text-[13px] text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function SettingsView() {
  const { data, error, isLoading, mutate } = useSettings();

  return (
    <>
      <PageHeader
        title="Settings & data"
        page="settings"
        description="Integration keys, exports and imports, and system status. AI provider keys live on the AI providers page."
      />
      {error && (
        <div className="mb-5">
          <ErrorState error={error} onRetry={() => mutate()} />
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Section title="Look & feel" description="How the app looks and how much detail it shows">
            <DisplayCard />
          </Section>
          <Section title="Your data" description="Download, back up or import your logs" delay={60}>
            <DataCard />
          </Section>
          <Section title="Advanced" description="Search keys and on-device machine learning" delay={120}>
            <ShowDetails label="Show advanced settings (search keys, on-device models, system)">
              <div className="space-y-5">
                {isLoading && <Skeleton className="h-64 rounded-2xl" />}
                {data && <IntegrationsCard settings={data} onSaved={(s) => mutate(s, false)} />}
                <MlCard />
              </div>
            </ShowDetails>
          </Section>
        </div>
        <DetailedOnly>
          <div className="lg:sticky lg:top-6">
            <Section title="System" description="Connection and backend status" delay={90}>
              <SystemCard settings={data} />
            </Section>
          </div>
        </DetailedOnly>
      </div>
    </>
  );
}
