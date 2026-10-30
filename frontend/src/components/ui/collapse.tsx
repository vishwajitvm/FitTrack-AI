"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Fired on window by "Collapse all / Expand all"; every collapsible on the page follows it. */
export const COLLAPSE_ALL_EVENT = "fittrack:collapse-all";

const storageKey = (path: string, id: string) => `fittrack.collapsed.${path}.${id}`;

/**
 * Open/closed state for one collapsible block, remembered per page in this browser (keyed by `id`; no id = not
 * remembered) and driven by the page-wide "Collapse all" button.
 */
export function useCollapseState(id: string | null, defaultCollapsed = false) {
  const path = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // only animate after the user toggles, not when the remembered state is restored on load
  const [moving, setMoving] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    if (!id) return;
    try {
      const v = localStorage.getItem(storageKey(path, id));
      if (v !== null) setCollapsed(v === "1");
    } catch {
      /* storage unavailable */
    }
  }, [id, path]);

  const set = useCallback(
    (next: boolean) => {
      setMoving(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMoving(false), 320);
      setCollapsed(next);
      if (!id) return;
      try {
        localStorage.setItem(storageKey(path, id), next ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
    },
    [id, path],
  );

  useEffect(() => {
    const onAll = (e: Event) => set(Boolean((e as CustomEvent<{ collapsed: boolean }>).detail?.collapsed));
    window.addEventListener(COLLAPSE_ALL_EVENT, onAll);
    return () => window.removeEventListener(COLLAPSE_ALL_EVENT, onAll);
  }, [set]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { collapsed, toggle: () => set(!collapsed), moving };
}

export type CollapseState = ReturnType<typeof useCollapseState>;

export const CollapseContext = createContext<CollapseState | null>(null);

/** The surrounding card's collapse state, or null when it is not collapsible. */
export const useCollapse = () => useContext(CollapseContext);

/** Round chevron button that opens/closes the surrounding collapsible. Renders nothing outside one. */
export function CollapseButton({ className, label = "section" }: { className?: string; label?: string }) {
  const c = useCollapse();
  if (!c) return null;
  return (
    <button
      type="button"
      onClick={c.toggle}
      aria-expanded={!c.collapsed}
      aria-label={c.collapsed ? `Expand ${label}` : `Collapse ${label}`}
      title={c.collapsed ? "Expand" : "Collapse"}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-slate-50/70 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900",
        className,
      )}
    >
      <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", c.collapsed && "-rotate-90")} />
    </button>
  );
}

/**
 * The part of a collapsible that hides. Height animates with the grid-rows trick; content is clipped only while
 * closed or moving (so popovers and focus rings are not cut off when open) and is invisible when closed (so it
 * leaves the tab order).
 */
export function CollapseBody({ children, className, innerClassName }: { children: ReactNode; className?: string; innerClassName?: string }) {
  const c = useCollapse();
  if (!c) return <>{children}</>;
  return (
    <div
      aria-hidden={c.collapsed || undefined}
      className={cn("grid grid-cols-[minmax(0,1fr)]", c.moving && "transition-[grid-template-rows] duration-300 ease-out", c.collapsed ? "grid-rows-[0fr]" : "flex-1 grid-rows-[1fr]", className)}
    >
      <div className={cn("flex min-h-0 min-w-0 flex-col", (c.collapsed || c.moving) && "overflow-hidden", c.collapsed && !c.moving && "invisible", innerClassName)}>{children}</div>
    </div>
  );
}

/** Provider for a custom-built collapsible (a card with its own header, a page section). */
export function Collapsible({ id, defaultCollapsed, children }: { id: string | null; defaultCollapsed?: boolean; children: (state: CollapseState) => ReactNode }) {
  const state = useCollapseState(id, defaultCollapsed);
  return <CollapseContext.Provider value={state}>{children(state)}</CollapseContext.Provider>;
}
