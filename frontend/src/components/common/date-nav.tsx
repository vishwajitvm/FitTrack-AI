"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays, prettyDate, today } from "@/lib/format";

interface DateNavProps {
  value: string;
  onChange: (date: string) => void;
}

/** Prev / date picker / next / today control. */
export function DateNav({ value, onChange }: DateNavProps) {
  const isToday = value === today();
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => onChange(addDays(value, -1))} aria-label="Previous day">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="relative">
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="h-11 rounded-xl border border-line bg-card px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          aria-label="Select date"
        />
      </div>
      <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => onChange(addDays(value, 1))} aria-label="Next day">
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isToday && (
        <Button variant="ghost" size="sm" onClick={() => onChange(today())}>
          Today
        </Button>
      )}
      <span className="hidden text-xs text-slate-500 md:inline">{prettyDate(value, { weekday: "long", day: "numeric", month: "long" })}</span>
    </div>
  );
}

/** Date navigator that stays pinned under the top bar while scrolling. */
export function StickyDateNav(props: DateNavProps & { children?: React.ReactNode }) {
  const { children, ...nav } = props;
  return (
    <div className="glass sticky top-16 z-20 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 xl:top-4">
      <DateNav {...nav} />
      {children}
    </div>
  );
}
