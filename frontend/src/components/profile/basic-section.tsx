import type { ReactNode } from "react";
import { User } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NumField, SelectField, TextField, type ProfileDraft, type SetDraft } from "./profile-fields";

const SEX = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export function BasicSection({ draft, set, footer }: { draft: ProfileDraft; set: SetDraft; footer?: ReactNode }) {
  const p = { draft, set };
  return (
    <Card>
      <CardHeader title="About you" description="Age and sex are required for BMR, TDEE and an accurate deficit." icon={<User className="h-4 w-4" />} />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <TextField {...p} k="name" label="Name" placeholder="What should we call you?" />
        <NumField {...p} k="age" label="Age (years)" step="1" info="bmr" />
        <SelectField {...p} k="sex" label="Biological sex" options={SEX} info="pending_biometrics" hint="Used only for the Mifflin–St Jeor equation." />
        <NumField {...p} k="height_cm" label="Height (cm)" step="0.1" hint="5′8″ ≈ 172.7 cm" />
        <NumField {...p} k="starting_weight_kg" label="Starting weight (kg)" step="0.1" />
        <NumField {...p} k="current_weight_kg" label="Current weight (kg)" step="0.1" info="morning_weight" hint="Auto-updates from morning check-ins." />
        <NumField {...p} k="target_weight_kg" label="Target weight (kg)" step="0.1" />
        <TextField {...p} k="start_date" label="Start date (Day 1)" type="date" />
        <div className="sm:col-span-2">
          <TextField {...p} k="goal" label="Goal" placeholder="Fat loss while preserving muscle and strength" />
        </div>
      </CardBody>
      {footer}
    </Card>
  );
}
