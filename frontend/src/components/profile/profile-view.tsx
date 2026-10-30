"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Save, SlidersHorizontal, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { useProfile, useProfileMetrics } from "@/hooks/use-profile";
import { useRevalidateTracking } from "@/hooks/use-revalidate";
import { api } from "@/lib/api";
import { withToast } from "@/lib/notify";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AdvancedSection } from "./advanced-section";
import { BasicSection } from "./basic-section";
import { MetricsCard } from "./metrics-card";
import type { SetDraft } from "./profile-fields";
import { ProfileSummary } from "./profile-summary";
import { ProteinPowderFields } from "./protein-powder-fields";

export function ProfileView() {
  const { data, error, isLoading, mutate } = useProfile();
  const { data: metrics, mutate: mutateMetrics } = useProfileMetrics();
  const revalidate = useRevalidateTracking();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const dirty = !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data);
  const set: SetDraft = (key, value) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const { id: _id, created_at: _c, updated_at: _u, ...body } = draft;
    const saved = await withToast(() => api.put<Profile>("/api/profile", body), "Profile saved", "Could not save profile");
    setSaving(false);
    if (saved) {
      mutate(saved, false);
      mutateMetrics();
      revalidate();
    }
  };

  const footer: ReactNode = (
    <CardFooter>
      <span className="mr-auto text-xs text-slate-500">{dirty ? "You have unsaved changes" : "All changes saved"}</span>
      <Button onClick={save} loading={saving} disabled={!dirty}>
        <Save className="h-4 w-4" /> Save profile
      </Button>
    </CardFooter>
  );

  return (
    <>
      <PageHeader
        title="Profile"
        page="profile"
        description="Keep the basics up to date. Open Advanced for body measurements, schedule, diet, intolerances and health details — they make every recommendation smarter."
        actions={
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Save className="h-4 w-4" /> Save profile
          </Button>
        }
      />
      {error && <ErrorState error={error} onRetry={() => mutate()} />}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-3xl" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      )}
      {draft && (
        <div className="space-y-6">
          <ProfileSummary draft={draft} metrics={metrics} />

          <div className="grid items-start gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div className="fade-up" style={{ animationDelay: "60ms" }}>
                <BasicSection draft={draft} set={set} footer={footer} />
              </div>
              <div className="fade-up" style={{ animationDelay: "120ms" }}>
                <ProteinPowderFields draft={draft} set={set} footer={footer} />
              </div>
              <Card className="fade-up overflow-hidden" style={{ animationDelay: "180ms" }}>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((s) => !s)}
                  aria-expanded={showAdvanced}
                  className="flex min-h-[64px] w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50/80"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <SlidersHorizontal className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold tracking-tight text-slate-900">Advanced</span>
                      <span className="block text-[13px] text-slate-500">Activity, body composition, training, schedule, diet & health</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand-600">
                    <span className="hidden sm:inline">{showAdvanced ? "Hide" : "Show"}</span>
                    <ChevronDown className={cn("h-5 w-5 transition-transform", showAdvanced && "rotate-180")} />
                  </span>
                </button>
                {showAdvanced && (
                  <>
                    <div className="fade-up border-t border-line px-5 py-5">
                      <AdvancedSection draft={draft} set={set} />
                    </div>
                    {footer}
                  </>
                )}
              </Card>
            </div>
            <div className="fade-up lg:sticky lg:top-6" style={{ animationDelay: "120ms" }}>
              <MetricsCard metrics={metrics} />
            </div>
          </div>
        </div>
      )}
      {dirty && (
        <div className="fixed inset-x-0 bottom-[140px] z-20 flex justify-center px-4 lg:bottom-6 lg:left-64">
          <div className="fade-up flex items-center gap-2 rounded-2xl border border-line bg-card py-2 pl-4 pr-2 text-sm text-slate-900 shadow-pop">
            <span className="h-2 w-2 shrink-0 rounded-full bg-warn-fg" aria-hidden />
            <span className="mr-1 font-medium">Unsaved changes</span>
            <Button size="sm" variant="ghost" onClick={() => data && setDraft(data)}>
              <Undo2 className="h-3.5 w-3.5" /> Discard
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
