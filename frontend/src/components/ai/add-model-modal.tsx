"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { withToast } from "@/lib/notify";
import type { Capability, Provider } from "@/lib/types";
import { CapabilityPicker } from "./capability-chips";

interface AddModelModalProps {
  open: boolean;
  onClose: () => void;
  providers: Provider[];
  providerId?: string;
  onSaved: () => void;
}

export function AddModelModal({ open, onClose, providers, providerId, onSaved }: AddModelModalProps) {
  const [provider, setProvider] = useState(providerId ?? "");
  const [modelId, setModelId] = useState("");
  const [name, setName] = useState("");
  const [caps, setCaps] = useState<Capability[]>(["chat"]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProvider(providerId ?? providers[0]?.id ?? "");
    setModelId("");
    setName("");
    setCaps(["chat"]);
  }, [open, providerId, providers]);

  const save = async () => {
    if (!provider || !modelId.trim()) return;
    setSaving(true);
    const ok = await withToast(
      () => api.post("/api/ai/models", { provider_id: provider, model_id: modelId.trim(), display_name: name.trim() || modelId.trim(), capabilities: caps }),
      "Model added",
    );
    setSaving(false);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a custom model"
      description="Use the exact model ID from the provider's docs (e.g. meta-llama/llama-3.3-70b-instruct:free)."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!modelId.trim() || !provider}>
            Add model
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Provider">
          <Select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={!!providerId}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Model ID">
          <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="provider/model-name" />
        </Field>
        <Field label="Display name (optional)">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Capabilities" info="capabilities" hint="Vision models are used for food photos and scanned reports; reasoning models for coaching.">
          <CapabilityPicker value={caps} onChange={setCaps} />
        </Field>
      </div>
    </Modal>
  );
}
