"use client";

import { useState } from "react";
import { Activity, Boxes, CheckCircle2, KeyRound } from "lucide-react";
import { ShowDetails } from "@/components/common/details";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { InfoTip } from "@/components/ui/info-tip";
import { Tabs } from "@/components/ui/misc";
import { useAiStats } from "@/hooks/use-ai";
import { useRevalidatePrefix } from "@/hooks/use-revalidate";
import { fmt, pct } from "@/lib/format";
import { LogsTab } from "./logs-tab";
import { ModelsTab } from "./models-tab";
import { PlaygroundTab } from "./playground-tab";
import { ProvidersTab } from "./providers-tab";
import { RecommendedSetup } from "./recommended-setup";
import { RoutingTab } from "./routing-tab";

type Tab = "providers" | "models" | "routing" | "playground" | "logs";

export function AiView() {
  const [tab, setTab] = useState<Tab>("providers");
  const { data: stats } = useAiStats();
  const revalidatePrefix = useRevalidatePrefix();
  const refreshAll = () => revalidatePrefix("/api/ai", "/api/dashboard");
  const rate = stats?.success_rate_24h;

  return (
    <>
      <PageHeader
        title="AI providers & keys"
        page="ai"
        description={
          <span className="inline-flex flex-wrap items-center gap-1">
            Free-only AI: every provider here is free forever with just an API key (no card). Manage all keys from this page — when one free quota runs out the next model is used
            automatically, and local Ollama is only the last resort.
            <InfoTip term="free_only_policy" />
          </span>
        }
      />
      <div className="space-y-6">
        <RecommendedSetup />
        <ShowDetails label="Show all free providers, models & fallback settings">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                <StatCard key="p" info="provider_priority" label="Providers configured" icon={<KeyRound className="h-4 w-4" />} value={stats ? `${stats.providers_configured}/${stats.providers_total}` : "—"} />,
                <StatCard key="m" info="capabilities" label="Models enabled" icon={<Boxes className="h-4 w-4" />} value={stats ? `${fmt(stats.models_enabled)}/${fmt(stats.models_total)}` : "—"} />,
                <StatCard key="c" label="AI calls (24h)" icon={<Activity className="h-4 w-4" />} value={stats ? fmt(stats.calls_24h) : "—"} />,
                <StatCard
                  key="s"
                  info="call_status"
                  label="Success rate (24h)"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  value={rate !== null && rate !== undefined ? pct(rate) : "—"}
                  tone={rate === null || rate === undefined ? "default" : rate >= 0.9 ? "ok" : rate >= 0.6 ? "warning" : "critical"}
                  status={rate === null || rate === undefined ? undefined : rate >= 0.9 ? "Healthy" : rate >= 0.6 ? "Some failures" : "Failing"}
                />,
              ].map((card, i) => (
                <div key={i} className="fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                  {card}
                </div>
              ))}
            </div>
            <Tabs
              tabs={[
                { value: "providers", label: "Providers", count: stats?.providers_total },
                { value: "models", label: "Models", count: stats?.models_total },
                { value: "routing", label: "Routing & fallbacks" },
                { value: "playground", label: "Playground" },
                { value: "logs", label: "Call logs" },
              ]}
              value={tab}
              onChange={setTab}
            />
            <div key={tab} className="fade-up">
              {tab === "providers" && <ProvidersTab onChanged={refreshAll} />}
              {tab === "models" && <ModelsTab onChanged={refreshAll} />}
              {tab === "routing" && <RoutingTab />}
              {tab === "playground" && <PlaygroundTab onRan={() => revalidatePrefix("/api/ai/logs", "/api/ai/stats")} />}
              {tab === "logs" && <LogsTab />}
            </div>
          </div>
        </ShowDetails>
      </div>
    </>
  );
}
