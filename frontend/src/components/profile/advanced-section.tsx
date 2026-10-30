"use client";

import type { ReactNode } from "react";
import { Clock, Dumbbell, HeartPulse, Ruler, Salad, Target } from "lucide-react";
import { TagInput } from "@/components/common/tag-input";
import { Field } from "@/components/ui/field";
import { IconBubble, type Accent } from "@/components/ui/fx";
import { Textarea } from "@/components/ui/input";
import { ACTIVITY_LEVELS, DIET_TYPES, WEEKDAYS } from "@/config/constants";
import { humanize } from "@/lib/format";
import { NumField, SelectField, TextField, type ProfileDraft, type SetDraft } from "./profile-fields";

const EXPERIENCE = [
  { value: "beginner", label: "Beginner (< 1 year)" },
  { value: "intermediate", label: "Intermediate (1–3 years)" },
  { value: "advanced", label: "Advanced (3+ years)" },
];

function Group({ title, description, icon, accent, children }: { title: string; description: string; icon: ReactNode; accent: Accent; children: ReactNode }) {
  return (
    <section className="pt-6 first:pt-0">
      <div className="mb-4 flex items-center gap-3">
        <IconBubble accent={accent} className="h-8 w-8">
          {icon}
        </IconBubble>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

type ArrayKey = "allergies" | "intolerances" | "medical_conditions" | "medications" | "supplements";

const ARRAYS: { k: ArrayKey; label: string; suggestions: string[] }[] = [
  { k: "intolerances", label: "Intolerances", suggestions: ["lactose", "gluten", "FODMAPs", "spicy food"] },
  { k: "allergies", label: "Allergies", suggestions: ["peanuts", "tree nuts", "shellfish", "soy", "eggs"] },
  { k: "medical_conditions", label: "Medical conditions", suggestions: ["acid reflux / GERD", "IBS", "thyroid", "pre-diabetes", "hypertension"] },
  { k: "medications", label: "Medications", suggestions: [] },
  { k: "supplements", label: "Supplements", suggestions: ["whey protein", "creatine", "vitamin D3", "omega-3", "multivitamin", "magnesium"] },
];

export function AdvancedSection({ draft, set }: { draft: ProfileDraft; set: SetDraft }) {
  const p = { draft, set };
  return (
    <div className="divide-y divide-line [&>section]:pb-6 [&>section:last-child]:pb-0">
      <Group title="Goal & activity" description="How fast to lose and how active you are outside the gym" icon={<Target className="h-4 w-4" />} accent="balance">
        <NumField {...p} k="weekly_rate_kg" label="Target loss per week (kg)" step="0.05" info="deficit" hint="0.5–1.0 kg/week preserves muscle best." />
        <SelectField {...p} k="activity_level" label="Lifestyle (excl. gym)" options={ACTIVITY_LEVELS} info="neat" />
        <NumField {...p} k="avg_daily_steps" label="Average daily steps" step="100" info="steps" hint="Used for NEAT when a day has no step count." />
        <NumField {...p} k="protein_target_g_per_kg" label="Protein target (g/kg)" step="0.1" info="protein_target" hint="1.6–2.2 g/kg during a cut." />
      </Group>
      <Group title="Body composition" description="Tape measurements give a body-fat estimate" icon={<Ruler className="h-4 w-4" />} accent="weight">
        <NumField {...p} k="body_fat_pct" label="Body fat (%)" step="0.1" info="body_fat" />
        <NumField {...p} k="waist_cm" label="Waist (cm)" step="0.1" info="body_fat" hint="At the navel." />
        <NumField {...p} k="neck_cm" label="Neck (cm)" step="0.1" />
        <NumField {...p} k="hip_cm" label="Hip (cm)" step="0.1" hint="Needed for the female US-Navy formula." />
      </Group>
      <Group title="Training" description="Your split, experience and usual gym time" icon={<Dumbbell className="h-4 w-4" />} accent="burn">
        <TextField {...p} k="training_split" label="Split" info="ppl_split" placeholder="Push / Pull / Legs + cardio" />
        <SelectField {...p} k="training_experience" label="Experience" options={EXPERIENCE} />
        <SelectField {...p} k="rest_day" info="rest_day" label="Weekly rest day" options={WEEKDAYS.map((d) => ({ value: d, label: humanize(d) }))} />
        <TextField {...p} k="gym_start_time" label="Usual gym start" type="time" />
      </Group>
      <Group title="Daily schedule" description="Used for meal timing and sleep reminders" icon={<Clock className="h-4 w-4" />} accent="sleep">
        <TextField {...p} k="wake_time" label="Wake time" type="time" />
        <TextField {...p} k="gym_return_time" label="Gym return time" type="time" info="chart_meal_timing" hint="Used to warn against heavy late meals." />
        <TextField {...p} k="bedtime" label="Bedtime" type="time" />
        <NumField {...p} k="sleep_target_hours" label="Sleep target (h)" step="0.25" info="sleep_quality" />
      </Group>
      <Group title="Nutrition preferences" description="Shapes meal ideas and water targets" icon={<Salad className="h-4 w-4" />} accent="kcal">
        <SelectField {...p} k="diet_type" label="Diet type" options={DIET_TYPES} />
        <TextField {...p} k="preferred_cuisine" label="Preferred cuisine" placeholder="North Indian, home-cooked" />
        <NumField {...p} k="water_target_ml" label="Water target (ml)" step="100" info="water" />
        <TextField {...p} k="timezone" label="Timezone" placeholder="Asia/Kolkata" />
      </Group>
      <Group title="Health" description="Kept private — used to avoid foods and flag risks" icon={<HeartPulse className="h-4 w-4" />} accent="balance">
        {ARRAYS.map((a) => (
          <Field key={a.k} label={a.label}>
            <TagInput value={draft[a.k] ?? []} onChange={(v) => set(a.k, v)} suggestions={a.suggestions} />
          </Field>
        ))}
        <Field label="Notes">
          <Textarea rows={3} value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
        </Field>
      </Group>
    </div>
  );
}
