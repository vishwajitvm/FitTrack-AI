"use client";

import { useState } from "react";
import { ArrowRight, BarChartHorizontal, Bot, CalendarDays, Info, Microscope, Zap } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { CheckinTimelineChart, CorrelationStrengthChart } from "@/components/charts/gut-charts";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { ShowDetails, SimpleOnly } from "@/components/common/details";
import { openQuickLog } from "@/components/quick-log/quick-log";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InfoTip, WithTip } from "@/components/ui/info-tip";
import { Progress, Segmented, Skeleton } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useCorrelations } from "@/hooks/use-biofeedback";
import { api } from "@/lib/api";
import { fmt, humanize, pct } from "@/lib/format";
import { correlationInsight, timelineInsight } from "@/lib/insights";
import { notify, showText } from "@/lib/notify";
import type { AiText, CorrelationFinding } from "@/lib/types";
import { cn } from "@/lib/utils";

const strengthTone: Record<CorrelationFinding["strength"], BadgeTone> = {
  strong: "critical",
  moderate: "warning",
  weak: "info",
  insufficient_data: "neutral",
};

const STRENGTH_PLAIN: Record<CorrelationFinding["strength"], string> = {
  strong: "strong — worth cutting out for 2 weeks",
  moderate: "possible — worth testing",
  weak: "weak — could be chance",
  insufficient_data: "not enough data",
};

const STRENGTH_BUBBLE: Record<CorrelationFinding["strength"], string> = {
  strong: "bg-crit-bg text-crit-fg",
  moderate: "bg-warn-bg text-warn-fg",
  weak: "bg-info-bg text-info-fg",
  insufficient_data: "bg-slate-100 text-slate-500",
};

const STRENGTH_BAR: Record<CorrelationFinding["strength"], string> = {
  strong: "bg-crit-fg",
  moderate: "bg-warn-fg",
  weak: "bg-info-fg",
  insufficient_data: "bg-slate-400",
};

const METHOD_LABEL: Record<string, string> = {
  bayesian_beta_binomial: "Bayesian N-of-1 analysis + Fisher's exact test",
};

/** Credible interval of the rate difference, in percentage points. */
function diffRange(lo: number | null | undefined, hi: number | null | undefined) {
  if (lo === null || lo === undefined || hi === null || hi === undefined) return "—";
  const f = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}`;
  return `${f(lo)} to ${f(hi)} pts`;
}

const WINDOWS = [
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

/** "Gut-health insights" section: window picker, two charts, then the list of suspected triggers. */
export function CorrelationsCard() {
  const [days, setDays] = useState("30");
  const { data, error, isLoading, mutate } = useCorrelations(Number(days));
  const [loadingAi, setLoadingAi] = useState(false);

  const insights = async () => {
    setLoadingAi(true);
    try {
      const res = await api.post<AiText>("/api/biofeedback/insights", undefined, { days });
      await showText(`Gut-health insights${res.provider ? ` · ${res.provider}` : ""}`, res.text ?? "No insights returned.");
    } catch (err) {
      notify.error(err, "AI insights failed");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <CollapsibleSection
      id="gut-insights"
      title="Gut-health insights"
      description="Which foods and habits tend to come before your symptoms."
      bodyClassName="space-y-5 pt-5"
      actions={
        <>
          <Segmented options={WINDOWS} value={days} onChange={setDays} />
          <Button variant="outline" onClick={insights} loading={loadingAi}>
            <Bot className="h-4 w-4" /> AI insights
          </Button>
        </>
      }
    >
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {isLoading && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      )}
      {data && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard
              title="Symptoms vs food"
              description="Energy and bloating against calories and late-night eating"
              icon={<CalendarDays className="h-4 w-4" />}
              info="chart_checkin_timeline"
              insight={timelineInsight(data.timeline)}
            >
              <CheckinTimelineChart timeline={data.timeline} />
            </ChartCard>
            <ChartCard
              title="Trigger strength"
              description="How much more often a symptom follows each suspect"
              icon={<BarChartHorizontal className="h-4 w-4" />}
              info="chart_correlation"
              insight={correlationInsight(data.findings)}
              note="Correlation is not causation — confirm a suspect by removing it for 1–2 weeks."
            >
              <CorrelationStrengthChart findings={data.findings} />
            </ChartCard>
          </div>

          <Card className="fade-up overflow-hidden">
            <CardHeader
              title="Gut-health & symptom correlations"
              description={`${data.sample_days} day(s) analysed · symptoms: ${data.symptoms_analysed.length ? data.symptoms_analysed.map(humanize).join(", ") : "none yet"}${data.method ? ` · ${METHOD_LABEL[data.method] ?? humanize(data.method)}` : ""}`}
              icon={<Microscope className="h-4 w-4" />}
              info="correlation_causation"
            />
            {data.findings.length === 0 ? (
              <CardBody>
                <EmptyState
                  icon={<Microscope className="h-5 w-5" />}
                  title="No patterns yet"
                  description="When something upsets your stomach, log it with the green “+ Log” → Symptom. After a week or two we'll show which foods tend to come before it."
                  action={
                    <Button className="min-h-[44px]" onClick={() => openQuickLog("symptom")}>
                      Log a symptom
                    </Button>
                  }
                />
              </CardBody>
            ) : (
              <>
                <SimpleOnly>
                  <ul className="mt-4 divide-y divide-line border-y border-line">
                    {data.findings.map((f, i) => {
                      const enough = f.strength !== "insufficient_data";
                      return (
                        <li key={i} className="fade-up flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                          <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", STRENGTH_BUBBLE[f.strength])}>
                            <Zap className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-1.5 text-sm text-slate-900">
                              <b className="font-semibold">{f.label.split(" (")[0]}</b>
                              <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                              <span className="sr-only">leads to</span>
                              <span>{humanize(f.symptom).toLowerCase()}</span>
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">{enough ? STRENGTH_PLAIN[f.strength] : "not enough days to tell yet"}</p>
                            {enough && f.posterior_prob != null && (
                              <div className="mt-2 flex items-center gap-2">
                                <Progress value={f.posterior_prob * 100} className="h-1.5 max-w-[160px]" barClassName={STRENGTH_BAR[f.strength]} />
                                <span className="num whitespace-nowrap text-xs font-medium text-slate-700">{Math.round(f.posterior_prob * 100)}% likely a real link</span>
                              </div>
                            )}
                          </div>
                          <Badge tone={strengthTone[f.strength]} className="mt-0.5">
                            {humanize(f.strength)}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                </SimpleOnly>
                <CardBody className="pt-3">
                  <ShowDetails label="Show the statistics">
                    <div className="-mx-5">
                      <Table>
                        <THead>
                          <TR>
                            <TH>Symptom</TH>
                            <TH>Trigger</TH>
                            <TH className="text-right">With trigger</TH>
                            <TH className="text-right">Without</TH>
                            <TH className="text-right">
                              <WithTip term="relative_risk">Rel. risk</WithTip>
                            </TH>
                            <TH className="text-right">
                              <WithTip term="posterior_prob">Likely?</WithTip>
                            </TH>
                            <TH className="text-right">
                              <WithTip term="credible_interval">Difference</WithTip>
                            </TH>
                            <TH className="text-right">
                              <WithTip term="p_value">p</WithTip>
                            </TH>
                            <TH>
                              <WithTip term="correlation_strength">Strength</WithTip>
                            </TH>
                          </TR>
                        </THead>
                        <TBody>
                          {data.findings.map((f, i) => (
                            <TR key={i}>
                              <TD className="font-medium text-slate-900">{humanize(f.symptom)}</TD>
                              <TD>
                                {f.label}
                                <span className="block max-w-xs text-[11px] text-slate-500">{f.explanation}</span>
                              </TD>
                              <TD className="num whitespace-nowrap text-right">
                                {pct(f.rate_with)} <span className="text-[11px] text-slate-400">({f.symptom_with_trigger}/{f.days_with_trigger})</span>
                              </TD>
                              <TD className="num whitespace-nowrap text-right">
                                {pct(f.rate_without)} <span className="text-[11px] text-slate-400">({f.symptom_without_trigger}/{f.days_without_trigger})</span>
                              </TD>
                              <TD className="num text-right font-semibold text-slate-900">{f.relative_risk !== null ? `×${fmt(f.relative_risk, 1)}` : "—"}</TD>
                              <TD className="num whitespace-nowrap text-right">{f.posterior_prob !== null && f.posterior_prob !== undefined ? `${pct(f.posterior_prob)} likely` : "—"}</TD>
                              <TD className="num whitespace-nowrap text-right text-xs">{diffRange(f.diff_low, f.diff_high)}</TD>
                              <TD className="num text-right text-xs">{f.p_value !== null && f.p_value !== undefined ? (f.p_value < 0.001 ? "<0.001" : fmt(f.p_value, 3)) : "—"}</TD>
                              <TD>
                                <span className="inline-flex items-center gap-1">
                                  <Badge tone={strengthTone[f.strength]}>{humanize(f.strength)}</Badge>
                                  {f.strength === "insufficient_data" && <InfoTip term="insufficient_data" />}
                                </span>
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  </ShowDetails>
                </CardBody>
              </>
            )}
            {data.notes.length > 0 && (
              <div className="px-5 pb-5">
                <ul className="space-y-1.5 rounded-xl border border-line bg-slate-50/80 p-3.5 text-xs leading-relaxed text-slate-600">
                  {data.notes.map((n, i) => (
                    <li key={i} className="flex gap-2">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </>
      )}
    </CollapsibleSection>
  );
}
