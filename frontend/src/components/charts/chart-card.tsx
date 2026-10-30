import type { ReactNode } from "react";
import { Info, Lightbulb } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { GlossaryKey } from "@/config/glossary";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** "How to read this chart" glossary entry. */
  info: GlossaryKey;
  /** Auto-generated plain-language takeaway ("What this means"). */
  insight?: string | null;
  /** Extra caveat, e.g. pending biometrics. */
  note?: string | null;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Card chrome shared by every chart: header, plot, then the plain-language takeaway and any caveat. */
export function ChartCard({ title, description, icon, info, insight, note, action, className, children }: ChartCardProps) {
  return (
    <Card className={cn("fade-up flex flex-col", className)}>
      <CardHeader title={title} description={description} icon={icon} info={info} action={action} />
      <CardBody className="flex flex-1 flex-col gap-4">
        {children}
        {(insight || note) && (
          <div className="mt-auto space-y-2">
            {insight && (
              <div className="flex gap-3 rounded-xl border border-line bg-slate-50/80 px-3.5 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Lightbulb className="h-3.5 w-3.5" />
                </span>
                <p className="text-[13px] leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-900">What this means. </span>
                  {insight}
                </p>
              </div>
            )}
            {note && (
              <p className="flex gap-2 rounded-xl border border-warn-border bg-warn-bg px-3.5 py-2.5 text-xs leading-relaxed text-warn-fg">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{note}</span>
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
