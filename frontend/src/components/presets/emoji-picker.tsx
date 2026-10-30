"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export const PRESET_EMOJIS = ["🏋️", "💪", "🦵", "🏃", "🚴", "🧘", "🔥", "⚡", "🍳", "🥣", "🍛", "🍚", "🥗", "🥪", "🍌", "🥚", "🧀", "🍗", "🐟", "🥛", "🍵", "☕", "🌙", "⭐"];

/** Small popover grid of ~24 emoji for preset icons. */
export function EmojiPicker({ value, onPick }: { value: string | null; onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // The grid sits in a portal on <body>, so surrounding glass cards can't draw over it.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const width = 272, height = 190;
      const top = r.bottom + 8 + height > window.innerHeight ? r.top - 8 - height : r.bottom + 8;
      setPos({ top: Math.max(8, top), left: Math.min(Math.max(8, r.left), window.innerWidth - width - 8) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Change icon"
        aria-expanded={open}
        title="Change icon"
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl border bg-slate-50 text-xl transition-all hover:border-slate-300 hover:bg-card active:scale-95",
          open ? "border-brand-500 ring-2 ring-brand-500/20" : "border-line",
        )}
      >
        {value || "⭐"}
      </button>
      {open && pos && createPortal(
        <div ref={panelRef} style={{ top: pos.top, left: pos.left }} className="glass-strong fade-up fixed z-[60] grid w-[17rem] grid-cols-6 gap-1 rounded-2xl border p-2 shadow-pop">
          {PRESET_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-transform hover:scale-110 hover:bg-slate-100", value === e && "bg-brand-50 ring-2 ring-brand-500")}
              aria-label={`Use ${e}`}
            >
              {e}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
