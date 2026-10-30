"use client";

import type { ReactNode } from "react";
import { Bike, Dumbbell, History, ListPlus, Plus } from "lucide-react";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useQuickActions } from "@/hooks/use-quick-actions";
import { usePresets, useToday } from "@/hooks/use-quicklog";
import { useWorkoutHistory } from "@/hooks/use-workouts";
import { fmt, humanize, prettyDate, today } from "@/lib/format";
import type { Preset } from "@/lib/types";

interface LogWorkoutMenuProps {
  date: string;
  onPick: (preset: Preset) => void;
  onCustom: (kind: "session" | "strength" | "cardio") => void;
}

/** Sentence-case group label inside the menu. */
function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pb-1 pt-2.5 text-xs font-medium text-slate-500">{children}</p>;
}

/** Primary "Log workout ▾": routines (today's split first), repeat last, and custom forms. */
export function LogWorkoutMenu({ date, onPick, onCustom }: LogWorkoutMenuProps) {
  const { data: presets } = usePresets("workout");
  const { data: plan } = useToday();
  const { data: history } = useWorkoutHistory(60);
  const { copyDay } = useQuickActions();
  const split = date === today() ? plan?.workout.split : null;
  const sorted = [...(presets ?? [])].sort((a, b) => Number(b.split === split) - Number(a.split === split));
  // Most recent earlier day with the same split (or any split if none suggested).
  const last = (history ?? []).filter((h) => h.date < date && (h.lifting_min + h.cardio_min > 0 || h.exercises > 0) && (!split || h.split === split)).sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <Menu
      label={
        <>
          <Dumbbell className="h-4 w-4" /> Log workout
        </>
      }
    >
      {(close) => (
        <>
          <GroupLabel>Your routines</GroupLabel>
          {!presets?.length && <p className="px-2.5 py-2 text-[13px] leading-relaxed text-slate-500">No routines yet — log one with &ldquo;Custom…&rdquo; below, then tap &ldquo;Save as routine&rdquo;.</p>}
          {sorted.map((p) => (
            <MenuItem
              key={p.id}
              icon={p.icon || "🏋️"}
              title={p.name}
              hint={[p.summary?.exercises != null && `${p.summary.exercises} exercises`, p.summary?.cardio_min ? `${fmt(p.summary.cardio_min)} min cardio` : null, p.summary?.lifting_min ? `${fmt(p.summary.lifting_min)} min lifting` : null].filter(Boolean).join(" · ")}
              badge={p.split === split ? <span className="inline-flex items-center gap-1 rounded-full bg-good-bg px-2 py-0.5 text-[11px] font-semibold text-good-fg"><span className="h-1.5 w-1.5 rounded-full bg-good-fg" aria-hidden />Today</span> : undefined}
              onSelect={() => {
                close();
                onPick(p);
              }}
            />
          ))}
          {last && (
            <>
              <GroupLabel>Repeat</GroupLabel>
              <MenuItem
                icon={<History className="h-4 w-4 text-brand-600" />}
                title={`Repeat last ${last.split ? humanize(last.split) : "workout"}`}
                hint={`Copies ${prettyDate(last.date)} exactly`}
                onSelect={() => {
                  close();
                  copyDay({ from_date: last.date, to_date: date, include: ["workouts"], label: `Repeated ${last.split ? humanize(last.split) : "workout"} from ${prettyDate(last.date)}` });
                }}
              />
            </>
          )}
          <div className="my-1.5 border-t border-line" />
          <GroupLabel>Custom…</GroupLabel>
          <MenuItem icon={<Plus className="h-4 w-4 text-acc-burn" />} title="New lifting session" hint="Split, duration, effort" onSelect={() => (close(), onCustom("session"))} />
          <MenuItem icon={<ListPlus className="h-4 w-4 text-acc-weight" />} title="Single exercise" hint="Sets, reps, weight" onSelect={() => (close(), onCustom("strength"))} />
          <MenuItem icon={<Bike className="h-4 w-4 text-acc-water" />} title="Cardio" hint="Treadmill, cycling…" onSelect={() => (close(), onCustom("cardio"))} />
        </>
      )}
    </Menu>
  );
}
