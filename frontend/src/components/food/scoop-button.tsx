"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Milk } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { useQuickActions } from "@/hooks/use-quick-actions";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One tap logs n scoops of the protein powder saved in Profile (1 / 2 / 3), with Undo. */
export function ScoopButton({ date, className }: { date?: string; className?: string }) {
  const { data: profile } = useProfile();
  const { logScoops } = useQuickActions();
  const [busy, setBusy] = useState<number | null>(null);

  const perScoopProtein = profile?.protein_per_scoop_g ?? null;
  if (profile && !perScoopProtein) {
    return (
      <Link href="/profile" className={cn("inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-card px-3.5 text-sm font-medium text-slate-600 transition-colors hover:border-acc-protein/50 hover:text-slate-900", className)}>
        <Milk className="h-4 w-4 text-acc-protein" /> Set up your protein powder
      </Link>
    );
  }

  const log = async (n: number) => {
    if (!profile) return;
    setBusy(n);
    await logScoops(profile, n, { date });
    setBusy(null);
  };

  const disabled = !profile || busy !== null;
  return (
    <div role="group" aria-label="Log protein powder scoops" className={cn("inline-flex h-11 overflow-hidden rounded-xl border border-line bg-card shadow-sm", className)}>
      <button
        type="button"
        onClick={() => log(1)}
        disabled={disabled}
        title={perScoopProtein ? `1 scoop = ${fmt(perScoopProtein, 1)} g protein` : undefined}
        className="flex items-center gap-1.5 px-3.5 text-sm font-medium text-slate-800 transition-colors hover:bg-acc-protein/10 disabled:opacity-50"
      >
        {busy === 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Milk className="h-4 w-4 text-acc-protein" />}+ 1 scoop
      </button>
      {[2, 3].map((n) => (
        <button key={n} type="button" onClick={() => log(n)} disabled={disabled} aria-label={`Log ${n} scoops`} className="num w-11 border-l border-line text-sm font-medium text-slate-600 transition-colors hover:bg-acc-protein/10 hover:text-slate-900 disabled:opacity-50">
          {busy === n ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : `×${n}`}
        </button>
      ))}
    </div>
  );
}
