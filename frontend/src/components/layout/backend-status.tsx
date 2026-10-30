"use client";

import { useHealth } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

/** Small dot showing whether the FastAPI backend is reachable. */
export function BackendStatus() {
  const { data, error, isLoading } = useHealth();
  const ok = !!data && !error;
  return (
    <div className="flex items-center gap-2 text-xs text-sidebar-muted">
      <span className={cn("h-2 w-2 rounded-full", isLoading ? "bg-sidebar-dim" : ok ? "animate-pulse bg-emerald-500" : "bg-red-500")} />
      {isLoading ? "Connecting…" : ok ? `Backend online · v${data.version}` : "Backend offline"}
    </div>
  );
}
