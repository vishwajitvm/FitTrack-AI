"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { ArrowRight, Check, ChevronDown, Sparkles, TriangleAlert } from "lucide-react";
import { fmt, today } from "@/lib/format";
import type { BriefTone, DailyBrief as Brief } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPEN_KEY = "fittrack.brief.open";

const TONE: Record<BriefTone, { ring: string; label: string }> = {
  start: { ring: "from-[rgb(var(--hero-from))] to-[rgb(var(--hero-via))]", label: "Fresh start" },
  great: { ring: "from-emerald-400 to-teal-500", label: "On track" },
  good: { ring: "from-emerald-400 to-sky-500", label: "Looking good" },
  mixed: { ring: "from-amber-400 to-orange-500", label: "A few things to fix" },
  off: { ring: "from-rose-500 to-orange-500", label: "Off track today" },
};

/**
 * "Your day so far" at the top of the dashboard: a human note about today's food and training — what's going well,
 * what to watch and what to do next. The server stores it and only rewrites it when today's logs change.
 */
export function DailyBrief({ fallback }: { fallback: string }) {
  const { data, error, isLoading } = useSWR<Brief>(`/api/brief?date=${today()}`, { revalidateOnFocus: false, keepPreviousData: true });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(OPEN_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !o;
    });
  };

  if (!data) {
    return (
      <div className="glass mt-3 flex max-w-3xl items-start gap-3 rounded-2xl border px-4 py-3 text-sm text-slate-600">
        <span className="bg-hero mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white">
          <Sparkles className={cn("h-4 w-4", isLoading && "animate-pulse")} />
        </span>
        <p className="flex-1 leading-relaxed">{isLoading && !error ? <span className="shimmer rounded">Reading your day so far…</span> : fallback}</p>
      </div>
    );
  }

  const n = data.numbers;
  const tone = TONE[data.tone] ?? TONE.good;
  const hasMore = data.good.length + data.watch.length + data.next.length > 0;
  const updated = new Date(data.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const by = data.source === "rules" ? "written from your numbers" : `written by ${data.source.split("/").pop()}`;

  return (
    <section className="glass fade-up mt-3 overflow-hidden rounded-2xl border" aria-label="Your day so far">
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", tone.ring)} title={tone.label}>
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-relaxed text-slate-800">{data.headline}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <Chip label="Eaten" value={`${fmt(n.eaten_kcal)}${n.goal_kcal ? ` / ${fmt(n.goal_kcal)}` : ""} kcal`} accent="text-acc-kcal" />
            {n.burned_kcal !== null && <Chip label="Burning" value={`~${fmt(n.burned_kcal)} kcal`} accent="text-acc-burn" />}
            {n.protein_target_g !== null && <Chip label="Protein" value={`${fmt(n.protein_g)} / ${fmt(n.protein_target_g)} g`} accent="text-acc-protein" />}
            {n.exercise_kcal > 0 && <Chip label="Training" value={`${fmt(n.exercise_kcal)} kcal`} accent="text-acc-weight" />}
          </div>
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex h-9 shrink-0 items-center gap-1 rounded-xl border border-line bg-slate-50/70 px-2.5 text-xs font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <span className="hidden sm:inline">{open ? "Less" : "More"}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>

      {open && hasMore && (
        <div className="grid gap-3 border-t border-line px-4 py-3 md:grid-cols-3">
          <List title="Going well" items={data.good} icon={<Check className="h-3.5 w-3.5" />} color="bg-good-bg text-good-fg" empty="Nothing logged that stands out yet." />
          <List title="Watch out" items={data.watch} icon={<TriangleAlert className="h-3.5 w-3.5" />} color="bg-warn-bg text-warn-fg" empty="Nothing worrying right now." />
          <List title="Do next" items={data.next} icon={<ArrowRight className="h-3.5 w-3.5" />} color="bg-brand-50 text-brand-600" empty="Keep going as you are." />
        </div>
      )}

      <p className="border-t border-line px-4 py-1.5 text-[11px] text-slate-500">
        Updated {updated} after your last log · {by}
      </p>
    </section>
  );
}

function Chip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <span className="num inline-flex items-center gap-1 rounded-full border border-line bg-card px-2.5 py-1">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-semibold", accent)}>{value}</span>
    </span>
  );
}

function List({ title, items, icon, color, empty }: { title: string; items: string[]; icon: React.ReactNode; color: string; empty: string }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", color)}>{icon}</span>
        {title}
      </p>
      {items.length ? (
        <ul className="space-y-1.5 text-[13px] leading-relaxed text-slate-700">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-slate-500">{empty}</p>
      )}
    </div>
  );
}
