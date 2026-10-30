"use client";

import { cn } from "@/lib/utils";
import { usePrefs, type ViewMode } from "./prefs-provider";

const OPTIONS: { value: ViewMode; label: string; title: string }[] = [
  { value: "simple", label: "Simple", title: "Plain words and the few numbers that matter" },
  { value: "detailed", label: "Detailed", title: "Every number, chart and technical term" },
];

/** Simple / Detailed view switch (sidebar). */
export function ModeToggle() {
  const { mode, setMode } = usePrefs();
  return (
    <div role="radiogroup" aria-label="How much detail to show" className="inline-flex rounded-xl bg-slate-100 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          title={o.title}
          onClick={() => setMode(o.value)}
          className={cn(
            "min-h-[32px] rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            mode === o.value ? "bg-card text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
