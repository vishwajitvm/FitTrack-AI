"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { withToast } from "@/lib/notify";
import type { Biomarker, BiomarkerStatus } from "@/lib/types";
import { toNumberOrNull } from "@/lib/utils";
import { RangeBar, STATUS_META, StatusPill } from "./range-bar";

const STATUSES: BiomarkerStatus[] = ["normal", "low", "high", "borderline", "unknown"];

interface BiomarkerModalProps {
  open: boolean;
  onClose: () => void;
  reportId: number;
  editing: Biomarker | null;
  onSaved: () => void;
}

export function BiomarkerModal({ open, onClose, reportId, editing, onSaved }: BiomarkerModalProps) {
  const [f, setF] = useState({ name: "", category: "", value: "", value_text: "", unit: "", ref_low: "", ref_high: "", status: "unknown" as BiomarkerStatus, notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
    setF({
      name: editing?.name ?? "",
      category: editing?.category ?? "",
      value: s(editing?.value),
      value_text: editing?.value_text ?? "",
      unit: editing?.unit ?? "",
      ref_low: s(editing?.ref_low),
      ref_high: s(editing?.ref_high),
      status: editing?.status ?? "unknown",
      notes: editing?.notes ?? "",
    });
  }, [open, editing]);

  const save = async () => {
    if (!f.name.trim()) return;
    const body = {
      name: f.name.trim(),
      category: f.category || null,
      value: toNumberOrNull(f.value),
      value_text: f.value_text || null,
      unit: f.unit || null,
      ref_low: toNumberOrNull(f.ref_low),
      ref_high: toNumberOrNull(f.ref_high),
      status: f.status,
      notes: f.notes || null,
    };
    setSaving(true);
    const ok = await withToast(
      () => (editing ? api.put(`/api/medical/biomarkers/${editing.id}`, body) : api.post(`/api/medical/reports/${reportId}/biomarkers`, body)),
      editing ? "Biomarker updated" : "Biomarker added",
    );
    setSaving(false);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const preview = toNumberOrNull(f.value);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit biomarker" : "Add biomarker"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!f.name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" className="col-span-2">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Vitamin D (25-OH)" />
        </Field>
        <Field label="Category">
          <Input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Vitamins, Lipids…" />
        </Field>
        <Field label="Status" info="biomarker_status">
          <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Value">
          <Input type="number" step="any" value={f.value} onChange={(e) => set("value", e.target.value)} />
        </Field>
        <Field label="Unit">
          <Input value={f.unit} onChange={(e) => set("unit", e.target.value)} />
        </Field>
        <Field label="Reference low" info="reference_range">
          <Input type="number" step="any" value={f.ref_low} onChange={(e) => set("ref_low", e.target.value)} />
        </Field>
        <Field label="Reference high">
          <Input type="number" step="any" value={f.ref_high} onChange={(e) => set("ref_high", e.target.value)} />
        </Field>
        <Field label="Text value (if not numeric)" className="col-span-2">
          <Input value={f.value_text} onChange={(e) => set("value_text", e.target.value)} placeholder="e.g. Negative, Trace" />
        </Field>
        <Field label="Notes" className="col-span-2">
          <Input value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        {preview !== null && (f.ref_low !== "" || f.ref_high !== "") && (
          <div className="col-span-2 rounded-2xl border border-line bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-slate-700">Preview</p>
              <StatusPill status={f.status} />
            </div>
            <RangeBar value={preview} low={toNumberOrNull(f.ref_low)} high={toNumberOrNull(f.ref_high)} status={f.status} />
          </div>
        )}
      </div>
    </Modal>
  );
}
