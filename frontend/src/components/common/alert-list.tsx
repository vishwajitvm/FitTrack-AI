import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { Alert } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles = {
  critical: { edge: "before:bg-crit-fg", icon: "bg-crit-bg text-crit-fg", Icon: AlertOctagon, word: "Important" },
  warning: { edge: "before:bg-warn-fg", icon: "bg-warn-bg text-warn-fg", Icon: AlertTriangle, word: "Heads-up" },
  ok: { edge: "before:bg-good-fg", icon: "bg-good-bg text-good-fg", Icon: CheckCircle2, word: "Good" },
  info: { edge: "before:bg-info-fg", icon: "bg-info-bg text-info-fg", Icon: Info, word: "Note" },
} as const;

const order = { critical: 0, warning: 1, info: 2, ok: 3 } as const;

export function AlertList({ alerts, empty = "No alerts — everything looks on track." }: { alerts: Alert[] | undefined; empty?: string }) {
  if (!alerts || alerts.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-good-bg px-3 py-2.5 text-sm text-good-fg">
        <CheckCircle2 className="h-4 w-4" /> {empty}
      </p>
    );
  const sorted = [...alerts].sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9));
  return (
    <ul className="space-y-2">
      {sorted.map((a, i) => {
        const s = styles[a.level] ?? styles.info;
        return (
          <li
            key={`${a.code}-${i}`}
            className={cn(
              "relative flex gap-3 overflow-hidden rounded-xl border border-line bg-card py-3 pl-4 pr-3 transition-colors hover:bg-slate-50/80",
              "before:absolute before:inset-y-0 before:left-0 before:w-1",
              s.edge,
            )}
          >
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", s.icon)}>
              <s.Icon className="h-4 w-4" />
              <span className="sr-only">{s.word}: </span>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{a.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{a.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
