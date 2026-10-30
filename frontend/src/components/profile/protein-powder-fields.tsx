import type { ReactNode } from "react";
import { Milk } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ACCENT, type Accent } from "@/components/ui/fx";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NumField, SelectField, TextField, type ProfileDraft, type SetDraft } from "./profile-fields";

const TYPES = [
  { value: "whey_concentrate", label: "Whey concentrate (some lactose)" },
  { value: "whey_isolate", label: "Whey isolate (almost lactose-free)" },
  { value: "plant", label: "Plant protein (no lactose)" },
  { value: "casein", label: "Casein (slow, milk-based)" },
  { value: "other", label: "Other" },
];

/** "Protein powder" card with a live per-scoop preview. */
export function ProteinPowderFields({ draft, set, footer }: { draft: ProfileDraft; set: SetDraft; footer?: ReactNode }) {
  const p = { draft, set };
  const protein = draft.protein_per_scoop_g;
  const kcal = draft.calories_per_scoop;
  const has = (v: number | null | undefined): v is number => v !== null && v !== undefined;

  return (
    <Card>
      <CardHeader
        title="Protein powder"
        info="protein_powder"
        description="Copy these from the label once — then one tap logs a scoop."
        icon={<Milk className="h-4 w-4" />}
      />
      <CardBody className="space-y-5">
        <div className="rounded-2xl border border-line bg-slate-50/70 p-3" aria-live="polite">
          <p className="num mb-2.5 px-1 text-[13px] font-medium text-slate-600">
            1 scoop = {has(protein) ? `${fmt(protein, 1)} g protein` : "? g protein"}, {has(kcal) ? `${fmt(kcal)} kcal` : "? kcal"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Protein" value={has(protein) ? fmt(protein, 1) : "—"} unit="g" accent="protein" />
            <Tile label="Calories" value={has(kcal) ? fmt(kcal) : "—"} unit="kcal" accent="kcal" />
            <Tile label="Carbs" value={has(draft.carbs_per_scoop_g) ? fmt(draft.carbs_per_scoop_g, 1) : "—"} unit="g" />
            <Tile label="Fat" value={has(draft.fat_per_scoop_g) ? fmt(draft.fat_per_scoop_g, 1) : "—"} unit="g" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField {...p} k="protein_supplement_name" label="Product name" placeholder="e.g. MuscleBlaze Biozyme Whey" />
          <SelectField {...p} k="protein_supplement_type" label="Type" options={TYPES} info="supplement_type" />
          <NumField {...p} k="scoop_size_g" label="Scoop size (g)" step="0.5" info="protein_powder" hint="From the label, per scoop" />
          <NumField {...p} k="protein_per_scoop_g" label="Protein per scoop (g)" step="0.1" />
          <NumField {...p} k="calories_per_scoop" label="Calories per scoop (kcal)" step="1" />
          <NumField {...p} k="carbs_per_scoop_g" label="Carbs per scoop (g)" step="0.1" />
          <NumField {...p} k="fat_per_scoop_g" label="Fat per scoop (g)" step="0.1" />
        </div>
      </CardBody>
      {footer}
    </Card>
  );
}

function Tile({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: Accent }) {
  return (
    <div className={cn("rounded-xl px-3 py-2", accent ? ACCENT[accent].tint : "bg-card")}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("num text-lg font-semibold leading-tight", accent ? ACCENT[accent].text : "text-slate-900")}>
        {value}
        <span className="ml-0.5 text-xs font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}
