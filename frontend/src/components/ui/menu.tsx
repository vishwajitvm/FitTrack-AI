"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuProps {
  label: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  buttonClassName?: string;
  width?: string;
}

const GAP = 8;
const MARGIN = 12;

/**
 * Click-to-open dropdown; closes on outside click, Esc or when an item calls close().
 * The panel is rendered in a portal on <body> with fixed positioning, so glass/tilted/animated cards around the
 * button can never draw on top of it. It opens below the button, or above when there is more room there.
 */
export function Menu({ label, children, align = "right", buttonClassName, width = "w-80" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number; maxHeight: number } | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const below = window.innerHeight - b.bottom - GAP - MARGIN;
    const above = b.top - GAP - MARGIN;
    const up = below < 280 && above > below;
    const horizontal = align === "right" ? { right: Math.max(MARGIN, window.innerWidth - b.right) } : { left: Math.max(MARGIN, b.left) };
    setPos({
      ...(up ? { bottom: window.innerHeight - b.top + GAP } : { top: b.bottom + GAP }),
      ...horizontal,
      maxHeight: Math.max(160, Math.min(window.innerHeight * 0.7, up ? above : below)),
    });
  }, [align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn("btn-3d inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white", buttonClassName)}
      >
        {label}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, maxHeight: pos.maxHeight }}
            className={cn("glass-strong fade-up scrollbar-thin fixed z-[60] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl border p-1.5 shadow-pop", width)}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}

interface MenuItemProps {
  onSelect: () => void;
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  badge?: ReactNode;
}

export function MenuItem({ onSelect, icon, title, hint, badge }: MenuItemProps) {
  return (
    <button type="button" role="menuitem" onClick={onSelect} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-100">
      {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{title}</span>
        {hint && <span className="block truncate text-[11px] text-slate-500">{hint}</span>}
      </span>
      {badge}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pb-1 pt-2 text-xs font-medium text-slate-500">{children}</p>;
}
