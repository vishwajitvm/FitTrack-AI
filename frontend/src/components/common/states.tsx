"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/misc";
import { friendlyError } from "@/lib/errors";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

/** Guided empty state: what this is for + the one action to get started. */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="glass flex flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-12 text-center">
      <div className="float mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-hero text-white shadow-glow">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Friendly error box with the technical text tucked behind "Details". */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const f = friendlyError(error);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-crit-border bg-crit-bg px-4 py-3 text-sm text-crit-fg">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{f.title}</p>
        <p className="mt-0.5 text-xs opacity-90">{f.message}</p>
        {f.technical && f.technical !== f.message && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[11px] underline opacity-80">
            {open ? "Hide details" : "Details"}
          </button>
        )}
        {open && <p className="mt-1 break-words font-mono text-[11px] opacity-80">{f.technical}</p>}
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-[36px] px-2 text-xs font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
