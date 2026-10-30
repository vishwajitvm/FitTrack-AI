"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

/** Shown instead of a blank "Application error" screen when one page fails to render; the sidebar keeps working. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="glass mx-auto mt-10 max-w-lg rounded-3xl border p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-crit-bg text-crit-fg">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">This page hit a problem</h1>
      <p className="mt-2 text-sm text-slate-600">Your data is safe. Try again, or go back to the dashboard.</p>
      {error.message && <p className="mt-3 break-words rounded-xl bg-slate-100 px-3 py-2 text-left font-mono text-xs text-slate-600">{error.message}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="btn-3d inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white">
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
        <Link href="/" className="glass inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-sm font-medium text-slate-700">
          <Home className="h-4 w-4" /> Dashboard
        </Link>
      </div>
    </div>
  );
}
