"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { usePrefs } from "@/components/layout/prefs-provider";
import { cn } from "@/lib/utils";

/**
 * Technical content: shown directly in Detailed mode, folded behind "Show details" in Simple mode.
 */
export function ShowDetails({ children, label = "Show details", className }: { children: ReactNode; label?: string; className?: string }) {
  const { simple } = usePrefs();
  const [open, setOpen] = useState(false);
  if (!simple) return <>{children}</>;
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        {open ? "Hide details" : label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** Rendered only in Detailed mode. */
export function DetailedOnly({ children }: { children: ReactNode }) {
  const { simple } = usePrefs();
  return simple ? null : <>{children}</>;
}

/** Rendered only in Simple mode. */
export function SimpleOnly({ children }: { children: ReactNode }) {
  const { simple } = usePrefs();
  return simple ? <>{children}</> : null;
}
