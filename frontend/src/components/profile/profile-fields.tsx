"use client";

import { Field } from "@/components/ui/field";
import type { GlossaryKey } from "@/config/glossary";
import { Input, Select } from "@/components/ui/input";
import type { Profile } from "@/lib/types";
import { toNumberOrNull } from "@/lib/utils";

export type ProfileDraft = Profile;
export type SetDraft = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;

// Optional profile fields count too, so `undefined` is stripped before checking the value type.
type NumKey = { [K in keyof Profile]-?: Exclude<Profile[K], undefined> extends number | null ? K : never }[keyof Profile];
type StrKey = { [K in keyof Profile]-?: Exclude<Profile[K], undefined> extends string | null ? K : never }[keyof Profile];

interface BaseProps {
  draft: ProfileDraft;
  set: SetDraft;
  label: string;
  hint?: string;
  info?: GlossaryKey;
}

export function NumField({ draft, set, k, label, hint, info, step = "any" }: BaseProps & { k: NumKey; step?: string }) {
  const v = draft[k] as number | null;
  return (
    <Field label={label} hint={hint} info={info}>
      <Input type="number" step={step} inputMode="decimal" value={v ?? ""} onChange={(e) => set(k, toNumberOrNull(e.target.value) as never)} />
    </Field>
  );
}

export function TextField({ draft, set, k, label, hint, info, type = "text", placeholder }: BaseProps & { k: StrKey; type?: string; placeholder?: string }) {
  const v = draft[k] as string | null;
  return (
    <Field label={label} hint={hint} info={info}>
      <Input type={type} value={v ?? ""} placeholder={placeholder} onChange={(e) => set(k, (e.target.value || null) as never)} />
    </Field>
  );
}

export function SelectField({ draft, set, k, label, hint, info, options }: BaseProps & { k: StrKey; options: { value: string; label: string }[] }) {
  const v = draft[k] as string | null;
  return (
    <Field label={label} hint={hint} info={info}>
      <Select value={v ?? ""} onChange={(e) => set(k, (e.target.value || null) as never)}>
        <option value="">Not set</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
