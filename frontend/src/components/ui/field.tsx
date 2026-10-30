import type { LabelHTMLAttributes, ReactNode } from "react";
import type { GlossaryKey } from "@/config/glossary";
import { cn } from "@/lib/utils";
import { InfoTip } from "./info-tip";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-slate-700", className)} {...props} />;
}

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  /** Glossary key for a "?" next to the label. */
  info?: GlossaryKey;
  children: ReactNode;
}

/** Label + control + optional hint, stacked. */
export function Field({ label, hint, htmlFor, className, info, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {info && <InfoTip term={info} />}
      </div>
      {children}
      {hint && <p className="text-xs leading-snug text-slate-500 [overflow-wrap:anywhere]">{hint}</p>}
    </div>
  );
}
