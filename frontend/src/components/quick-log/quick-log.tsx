"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, ChevronRight, Droplets, Dumbbell, HeartPulse, Milk, Plus, Scale, Utensils, type LucideIcon } from "lucide-react";
import { ACCENT, type Accent } from "@/components/ui/fx";
import { Modal } from "@/components/ui/modal";
import { useDaily } from "@/hooks/use-daily";
import { fmt, humanize, today } from "@/lib/format";
import type { DailyDetail, MealType, Preset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MealQuickPanel, QUICK_MEALS } from "./meal-quick-panel";
import { slotTotals } from "./today-meals";
import { ScoopQuick, SymptomQuick, WaterQuick, WeightQuick, WorkoutPicker } from "./quick-views";
import { WorkoutPresetSheet } from "./workout-preset-sheet";

type View = "menu" | "meal" | "scoop" | "workout" | "weight" | "water" | "symptom";

// Each tile uses the colour of the metric it changes (meal = kcal, workout = burn, weight, scoop = protein…).
const TILES: { view: View | "photo"; label: string; hint: string; icon: LucideIcon; accent: Accent }[] = [
  { view: "meal", label: "Meal", hint: "Tap what you ate", icon: Utensils, accent: "kcal" },
  { view: "scoop", label: "Scoop", hint: "Protein powder", icon: Milk, accent: "protein" },
  { view: "workout", label: "Workout", hint: "Pick a routine", icon: Dumbbell, accent: "burn" },
  { view: "weight", label: "Weight", hint: "Morning weigh-in", icon: Scale, accent: "weight" },
  { view: "water", label: "Water", hint: "+1 glass", icon: Droplets, accent: "water" },
  { view: "symptom", label: "Symptom", hint: "Bloating, gas…", icon: HeartPulse, accent: "sleep" },
  { view: "photo", label: "Photo", hint: "Snap your plate", icon: Camera, accent: "balance" },
];

const TITLES: Record<View, string> = {
  menu: "What do you want to log?",
  meal: "Log a meal",
  scoop: "Protein scoop",
  workout: "Log a workout",
  weight: "Today's weight",
  water: "Water",
  symptom: "How do you feel?",
};

/** What each tile has already got today (shown with a tick), or null. */
function tileStatus(view: View | "photo", d: DailyDetail | undefined): string | null {
  if (!d) return null;
  const s = d.summary;
  switch (view) {
    case "meal": {
      const n = QUICK_MEALS.filter((m) => slotTotals(d).has(m.value)).length;
      return d.foods.length ? `${n} of ${QUICK_MEALS.length} meals · ${fmt(s.total_calories)} kcal` : null;
    }
    case "scoop":
      return s.whey_scoops ? `${fmt(s.whey_scoops, s.whey_scoops % 1 ? 1 : 0)} today` : null;
    case "workout":
      return d.sessions.length || d.workouts.length ? `${d.sessions.map((x) => humanize(x.split)).join(" + ") || "Logged"} ✓` : null;
    case "weight":
      return s.morning_weight !== null ? `${fmt(s.morning_weight, 1)} kg` : null;
    case "water":
      return s.water_ml ? `${fmt(s.water_ml)} ml` : null;
    case "symptom":
      return d.biofeedback.length ? `${d.biofeedback.length} today` : null;
    default:
      return null;
  }
}

/** Global "+ Log" button (press N on desktop) and its command sheet. */
export function QuickLog() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [workout, setWorkout] = useState<Preset | null>(null);
  const [mealSlot, setMealSlot] = useState<MealType | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();
  const { data: todayDetail } = useDaily(open ? today() : null);

  const show = useCallback((v: View = "menu", slot?: MealType) => {
    setView(v);
    setMealSlot(slot);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  // Keyboard: N opens the sheet (not while typing or when another dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true]") || document.querySelector('[role="dialog"], .swal2-container')) return;
      e.preventDefault();
      show("menu");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  // Other components open a specific view through openQuickLog() below.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent).detail as { view?: View; mealType?: MealType } | undefined;
      show(d?.view ?? "menu", d?.mealType);
    };
    window.addEventListener("quicklog:open", onOpen);
    return () => window.removeEventListener("quicklog:open", onOpen);
  }, [show]);

  useEffect(() => close(), [pathname, close]);

  const [first, ...rest] = TILES;
  const tileClick = (t: (typeof TILES)[number]) => (t.view === "photo" ? router.push("/food/scan") : setView(t.view));

  return (
    <>
      {/* Desktop only (phones/tablets use the + in the dock). The chat page has its own input bar where this button would sit; N still opens the sheet there. */}
      {pathname !== "/ask" && (
        <button
          type="button"
          onClick={() => show("menu")}
          aria-label="Log something (shortcut N)"
          title="Log something (N)"
          className="group bg-grad fixed bottom-6 right-6 z-30 hidden h-14 items-center gap-2 rounded-full pl-5 pr-6 text-base font-semibold text-white shadow-glow ring-1 ring-white/10 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 active:scale-95 xl:flex"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:rotate-90">
            <Plus className="h-5 w-5" />
          </span>
          Log
          <kbd className="ml-1 hidden rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-medium xl:inline">N</kbd>
        </button>
      )}

      <Modal
        open={open}
        onClose={close}
        title={
          <span className="flex items-center gap-2">
            {view !== "menu" && (
              <button type="button" onClick={() => setView("menu")} className="-ml-1 flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900" aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {TITLES[view]}
          </span>
        }
        description={view === "menu" ? "One tap for the things you do every day. Shortcut: N" : undefined}
      >
        {view === "menu" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => tileClick(first)}
              className={cn(
                "fade-up lift group flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                ACCENT[first.accent].border,
              )}
            >
              <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", ACCENT[first.accent].tint, ACCENT[first.accent].text)}>
                <first.icon className="h-7 w-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-slate-900">{first.label}</span>
                <span className="block text-[13px] text-slate-500">{first.hint} — search any food or tap your usual ones</span>
                {tileStatus("meal", todayDetail) && <StatusPill>{tileStatus("meal", todayDetail)}</StatusPill>}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </button>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {rest.map((t, i) => (
                <button
                  key={t.view}
                  type="button"
                  onClick={() => tileClick(t)}
                  className="fade-up lift group flex min-h-[112px] flex-col items-start justify-between gap-3 rounded-2xl border border-line bg-card p-4 text-left shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  style={{ animationDelay: `${(i + 1) * 40}ms` }}
                >
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105", ACCENT[t.accent].tint, ACCENT[t.accent].text)}>
                    <t.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold text-slate-900">{t.label}</span>
                    {tileStatus(t.view, todayDetail) ? <StatusPill>{tileStatus(t.view, todayDetail)}</StatusPill> : <span className="block text-xs text-slate-500">{t.hint}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div key={view} className={view === "menu" ? undefined : "fade-up"}>
          {view === "meal" && <MealQuickPanel key={mealSlot ?? "auto"} date={today()} initialSlot={mealSlot} />}
          {view === "scoop" && <ScoopQuick />}
          {view === "workout" && (
            <WorkoutPicker
              onPick={(p) => {
                setOpen(false);
                setWorkout(p);
              }}
            />
          )}
          {view === "weight" && <WeightQuick onDone={close} />}
          {view === "water" && <WaterQuick onDone={() => undefined} />}
          {view === "symptom" && <SymptomQuick onDone={close} />}
        </div>
      </Modal>

      <WorkoutPresetSheet preset={workout} date={today()} onClose={() => setWorkout(null)} />
    </>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-good-bg px-2 py-0.5 text-[11px] font-semibold text-good-fg">
      <Check className="h-3 w-3" />
      {children}
    </span>
  );
}

/** Open the global quick-log sheet at a specific view from anywhere. */
export function openQuickLog(view: View = "menu", mealType?: MealType) {
  window.dispatchEvent(new CustomEvent("quicklog:open", { detail: { view, mealType } }));
}
