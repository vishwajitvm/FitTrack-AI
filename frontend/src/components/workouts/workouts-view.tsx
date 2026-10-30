"use client";

import { useEffect, useState } from "react";
import { Bike, BookmarkPlus, Dumbbell, Flame, ListChecks, Timer } from "lucide-react";
import { ShowDetails } from "@/components/common/details";
import { StickyDateNav } from "@/components/common/date-nav";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { usePrefs } from "@/components/layout/prefs-provider";
import { PresetsManager } from "@/components/presets/presets-manager";
import { PresetCard } from "@/components/quick-log/meal-quick-panel";
import { WorkoutPresetSheet } from "@/components/quick-log/workout-preset-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/fx";
import { Skeleton } from "@/components/ui/misc";
import { usePresets } from "@/hooks/use-quicklog";
import { useRevalidatePrefix, useRevalidateTracking } from "@/hooks/use-revalidate";
import { useRecommendation, useWorkoutHistory, useWorkouts } from "@/hooks/use-workouts";
import { api } from "@/lib/api";
import { humanize, today } from "@/lib/format";
import { askText, confirmDelete, withToast } from "@/lib/notify";
import type { Preset, WorkoutLog, WorkoutSession } from "@/lib/types";
import { DayLog } from "./day-log";
import { ExerciseModal } from "./exercise-modal";
import { LogWorkoutMenu } from "./log-workout-menu";
import { PlanDetails } from "./recommendation-panel";
import { MetReferenceCard, WorkoutHistoryCard } from "./reference-cards";
import { SessionModal } from "./session-modal";
import { WorkoutChartsRow } from "./workout-charts-row";
import { WorkoutHero } from "./workout-hero";

export function WorkoutsView() {
  const { t } = usePrefs();
  const [date, setDate] = useState(today);
  const { data, error, isLoading, mutate } = useWorkouts(date);
  const { data: rec, isLoading: recLoading } = useRecommendation(date);
  const { data: presets } = usePresets("workout");
  // Same key as the Log-workout menu, so SWR shares one request; used only for the small trend lines.
  const { data: history } = useWorkoutHistory(60);
  const revalidate = useRevalidateTracking();
  const revalidatePrefix = useRevalidatePrefix();
  const [routine, setRoutine] = useState<Preset | null>(null);

  const [sessionModal, setSessionModal] = useState<{ open: boolean; editing: WorkoutSession | null }>({ open: false, editing: null });
  const [exerciseModal, setExerciseModal] = useState<{ open: boolean; kind: "strength" | "cardio"; editing: WorkoutLog | null }>({
    open: false,
    kind: "strength",
    editing: null,
  });

  // "Custom workout…" from the global quick-log sheet links here with ?custom=1.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("custom") === "1") setSessionModal({ open: true, editing: null });
  }, []);

  const sessions = data?.sessions ?? [];
  const logs = data?.logs ?? [];
  const liftingMin = sessions.reduce((a, s) => a + (s.lifting_duration_min ?? 0), 0);
  const cardioMin = logs.filter((l) => l.workout_type === "cardio").reduce((a, l) => a + (l.cardio_duration_min ?? 0), 0);
  const hasWorkout = sessions.length > 0 || logs.length > 0;
  const loggedSplits = Array.from(new Set([...sessions.map((s) => s.split), ...(logs.some((l) => l.workout_type === "cardio") ? ["cardio"] : [])]));
  // Last 10 training days up to the viewed date, oldest first.
  const recent = [...(history ?? [])].filter((h) => h.date <= date).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
  const spark = (pick: (h: (typeof recent)[number]) => number) => recent.map(pick);

  const openCustom = (kind: "session" | "strength" | "cardio") =>
    kind === "session" ? setSessionModal({ open: true, editing: null }) : setExerciseModal({ open: true, kind, editing: null });

  const saveAsRoutine = async () => {
    const split = sessions[0]?.split;
    const name = await askText("Save as routine", { label: "Next time this whole workout is one tap.", value: split ? `${humanize(split)} day` : "My workout", confirmText: "Save routine" });
    if (!name) return;
    const ok = await withToast(() => api.post("/api/presets/from-day", { kind: "workout", date, name, icon: split === "legs" ? "🦵" : split === "cardio" ? "🏃" : "🏋️" }), `Saved "${name}"`);
    if (ok) revalidatePrefix("/api/presets", "/api/today");
  };

  const deleteSession = async (s: WorkoutSession) => {
    if (!(await confirmDelete("this session", "Exercises inside it will be kept but detached from the session."))) return;
    await withToast(() => api.del(`/api/workouts/sessions/${s.id}`), "Session deleted");
    revalidate();
  };

  const deleteLog = async (l: WorkoutLog) => {
    if (!(await confirmDelete(`"${l.exercise_name}"`))) return;
    await withToast(() => api.del(`/api/workouts/logs/${l.id}`), "Exercise deleted");
    revalidate();
  };

  return (
    <>
      <PageHeader
        title="Workouts"
        page="workouts"
        description="Push / Pull / Legs + cardio. Lifting calories are computed once per session block; cardio entries carry their own MET-based burn."
        actions={
          <>
            {hasWorkout && (
              <Button variant="outline" className="min-h-[44px]" onClick={saveAsRoutine}>
                <BookmarkPlus className="h-4 w-4" /> Save as routine
              </Button>
            )}
            <LogWorkoutMenu date={date} onPick={setRoutine} onCustom={openCustom} />
          </>
        }
      />
      <StickyDateNav value={date} onChange={setDate} />

      <WorkoutHero date={date} rec={rec} loading={recLoading} loggedSplits={loggedSplits} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          <StatCard key="burn" label={t("Calories burned training", "Exercise burn")} info="exercise_calories" value={<AnimatedNumber value={data?.total_calories ?? 0} />} unit="kcal" icon={<Flame className="h-4 w-4" />} accent="burn" spark={spark((h) => h.total_calories)} />,
          <StatCard key="lift" label={t("Lifting time", "Lifting")} info="lifting_once" value={<AnimatedNumber value={liftingMin} />} unit="min" icon={<Dumbbell className="h-4 w-4" />} accent="weight" spark={spark((h) => h.lifting_min)} />,
          <StatCard key="cardio" label={t("Cardio time", "Cardio")} info="met" value={<AnimatedNumber value={cardioMin} />} unit="min" icon={<Bike className="h-4 w-4" />} accent="water" spark={spark((h) => h.cardio_min)} />,
          <StatCard key="total" label="Total time" value={<AnimatedNumber value={liftingMin + cardioMin} />} unit="min" icon={<Timer className="h-4 w-4" />} accent="balance" spark={spark((h) => h.lifting_min + h.cardio_min)} />,
        ].map((card, i) => (
          <div key={card.key} className="fade-up [&>div]:h-full" style={{ animationDelay: `${80 + i * 50}ms` }}>
            {card}
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {error && <ErrorState error={error} onRetry={() => mutate()} />}
          {isLoading && <ListSkeleton rows={4} />}
          {data && !hasWorkout && (
            <EmptyState
              icon={<Dumbbell className="h-5 w-5" />}
              title={rec?.is_rest_day ? "Rest day — recovery is part of training" : "Nothing logged yet for this day"}
              description={
                presets?.length
                  ? "Tap your routine — everything is prefilled from last time. Adjust and save."
                  : "Log your first workout with “Log workout → Custom…”, then tap “Save as routine”. After that, a normal day is one tap."
              }
              action={
                presets?.length ? (
                  <div className="grid w-full max-w-md gap-2">
                    {presets.slice(0, 3).map((p) => (
                      <PresetCard key={p.id} preset={p} busy={false} onTap={() => setRoutine(p)} />
                    ))}
                  </div>
                ) : (
                  <Button className="min-h-[44px]" onClick={() => openCustom("session")}>
                    <Dumbbell className="h-4 w-4" /> Log a workout
                  </Button>
                )
              }
            />
          )}
          {data && hasWorkout && (
            <CollapsibleSection
              id="day-log"
              title={t("What you did", "Day log")}
              description={t("Tap the pencil to fix an entry or the bin to remove it.", "Lifting kcal are counted once per session; cardio rows carry their own burn.")}
            >
              <DayLog
                sessions={sessions}
                logs={logs}
                onEditSession={(s) => setSessionModal({ open: true, editing: s })}
                onDeleteSession={deleteSession}
                onEditLog={(l) => setExerciseModal({ open: true, kind: l.workout_type, editing: l })}
                onDeleteLog={deleteLog}
              />
            </CollapsibleSection>
          )}
          <PresetsManager kind="workout" />
          <ShowDetails label="Show training charts & history">
            <div className="space-y-5">
              <WorkoutChartsRow />
              <WorkoutHistoryCard onPickDate={setDate} />
            </div>
          </ShowDetails>
        </div>
        <div className="space-y-5">
          <Card className="fade-up" style={{ animationDelay: "120ms" }}>
            <CardHeader info="volume_modifier" title={t("Today's plan", "Auto-regulated plan")} description={t("Adjusted to how you slept, ate and feel", "Based on readiness, sleep, soreness and recent intake")} icon={<ListChecks className="h-4 w-4" />} />
            <CardBody>{recLoading ? <Skeleton className="h-40 rounded-xl" /> : rec ? <PlanDetails rec={rec} /> : <p className="text-sm text-slate-500">The plan is unavailable right now.</p>}</CardBody>
          </Card>
          <ShowDetails label="Show calorie reference (MET)">
            <MetReferenceCard />
          </ShowDetails>
        </div>
      </div>

      <WorkoutPresetSheet preset={routine} date={date} onClose={() => setRoutine(null)} />
      <SessionModal
        open={sessionModal.open}
        onClose={() => setSessionModal({ open: false, editing: null })}
        date={date}
        editing={sessionModal.editing}
        defaultSplit={rec?.split_today}
        onSaved={revalidate}
      />
      <ExerciseModal
        open={exerciseModal.open}
        onClose={() => setExerciseModal((m) => ({ ...m, open: false, editing: null }))}
        date={date}
        kind={exerciseModal.kind}
        sessions={sessions}
        editing={exerciseModal.editing}
        onSaved={revalidate}
      />
    </>
  );
}
