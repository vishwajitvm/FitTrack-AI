"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { GLOSSARY, type GlossaryKey } from "@/config/glossary";
import { cn } from "@/lib/utils";

interface InfoTipProps {
  /** Glossary key — preferred, keeps all wording in config/glossary.ts. */
  term?: GlossaryKey;
  /** Ad-hoc content when no glossary entry fits. */
  title?: string;
  children?: ReactNode;
  className?: string;
  /** Use "light" on the always-dark sidebar/top bar. */
  tone?: "default" | "light";
}

const WIDTH = 300;
const GAP = 8;
const MARGIN = 8;

/**
 * "?" help icon. Opens on hover (mouse) and on tap/click (touch, pins it open),
 * Enter/Space via keyboard; closes on Esc, outside click, or mouse leave when not pinned.
 * Rendered in a portal and clamped to the viewport so it never clips at screen edges.
 */
export function InfoTip({ term, title, children, className, tone = "default" }: InfoTipProps) {
  const entry = term ? GLOSSARY[term] : null;
  const heading = title ?? entry?.title;
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; above: boolean } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPinned(false);
  }, []);

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(WIDTH, vw - MARGIN * 2);
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, MARGIN), vw - width - MARGIN);
    const h = popRef.current?.offsetHeight ?? 160;
    const above = r.bottom + GAP + h > vh - MARGIN && r.top - GAP - h > MARGIN;
    const top = above ? r.top - GAP - h : Math.min(r.bottom + GAP, Math.max(MARGIN, vh - h - MARGIN));
    setPos({ top, left, width, above });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, close, place]);

  useEffect(() => cancelClose, []);

  const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={heading ? `What is ${heading}?` : "More information"}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pinned) close();
          else {
            setOpen(true);
            setPinned(true);
          }
        }}
        onMouseEnter={() => {
          if (!canHover()) return;
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={() => {
          if (canHover() && !pinned) scheduleClose();
        }}
        className={cn(
          // 16px icon with a 36px invisible tap area around it
          "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle transition-colors before:absolute before:-inset-2.5 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          tone === "light" ? "text-sidebar-muted hover:text-sidebar-text" : "text-slate-400 hover:text-slate-700",
          open && (tone === "light" ? "text-white" : "text-slate-700"),
          className,
        )}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            id={id}
            role="tooltip"
            onMouseEnter={cancelClose}
            onMouseLeave={() => !pinned && scheduleClose()}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? WIDTH }}
            className="glass-strong fixed z-[70] rounded-2xl border p-3 text-left normal-case tracking-normal shadow-pop"
          >
            {heading && <p className="text-[13px] font-semibold text-slate-900">{heading}</p>}
            {entry && <p className="mt-1 text-xs leading-relaxed text-slate-600">{entry.body}</p>}
            {children && <div className="mt-1 text-xs leading-relaxed text-slate-600">{children}</div>}
            {entry && "example" in entry && entry.example && (
              <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-700">
                <span className="font-semibold">Example: </span>
                {entry.example}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Label text followed by a "?" — handy inside headers and table cells. */
export function WithTip({ children, term, className }: { children: ReactNode; term: GlossaryKey; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <InfoTip term={term} />
    </span>
  );
}
