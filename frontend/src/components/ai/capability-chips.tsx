import { Check } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CAPABILITIES } from "@/config/constants";
import { humanize } from "@/lib/format";
import type { Capability } from "@/lib/types";
import { cn } from "@/lib/utils";

const tone: Record<Capability, BadgeTone> = {
  chat: "neutral",
  vision: "brand",
  reasoning: "warning",
  fast: "ok",
  long_context: "info",
};

export function CapabilityChips({ caps }: { caps: Capability[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {caps.map((c) => (
        <Badge key={c} tone={tone[c] ?? "neutral"}>
          {humanize(c)}
        </Badge>
      ))}
    </div>
  );
}

/** Toggleable capability selector. */
export function CapabilityPicker({ value, onChange }: { value: Capability[]; onChange: (v: Capability[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CAPABILITIES.map((c) => {
        const on = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}
            className={cn(
              "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors active:scale-95",
              on ? "border-navy bg-navy text-white shadow-sm" : "border-line bg-card text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {on && <Check className="h-3.5 w-3.5" />}
            {humanize(c)}
          </button>
        );
      })}
    </div>
  );
}
