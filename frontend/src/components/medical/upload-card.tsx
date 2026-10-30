"use client";

import { useRef, useState } from "react";
import { FileText, FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { REPORT_TYPES } from "@/config/constants";
import { api } from "@/lib/api";
import { today } from "@/lib/format";
import { compressImage } from "@/lib/image";
import { notify } from "@/lib/notify";
import type { MedicalReport } from "@/lib/types";
import { cn, toFormData } from "@/lib/utils";

export function UploadCard({ onUploaded }: { onUploaded: (r: MedicalReport) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reportDate, setReportDate] = useState(today);
  const [reportType, setReportType] = useState(REPORT_TYPES[0]);
  const [lab, setLab] = useState("");
  const [notes, setNotes] = useState("");
  const [analyze, setAnalyze] = useState(true);
  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    if (!file) {
      notify.warning("Choose a PDF or photo of the report first");
      return;
    }
    setUploading(true);
    try {
      const payload = file.type.startsWith("image/") ? await compressImage(file) : file;
      const form = toFormData({ file: payload, report_date: reportDate, report_type: reportType, lab_name: lab, notes, analyze: String(analyze) });
      const report = await api.upload<MedicalReport>("/api/medical/reports", form);
      notify.success("Report uploaded", analyze ? "AI is extracting biomarkers…" : undefined);
      setFile(null);
      setLab("");
      setNotes("");
      onUploaded(report);
    } catch (err) {
      notify.error(err, "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="fade-up" style={{ animationDelay: "60ms" }}>
      <CardHeader title="Upload a report" description="PDF or a clear photo of each page" icon={<FileUp className="h-4 w-4" />} />
      <CardBody className="space-y-4">
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "group flex w-full items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            file ? "border-brand-500/60 bg-brand-50/50" : "border-slate-300 bg-slate-50/60 hover:border-brand-500 hover:bg-brand-50/40",
          )}
        >
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors", file ? "bg-navy text-white" : "bg-card text-slate-400 shadow-sm group-hover:text-brand-600")}>
            {file ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{file ? file.name : "Choose file"}</span>
            <span className="block text-xs text-slate-500">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · tap to change` : "PDF, JPG, PNG"}</span>
          </span>
        </button>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Report date">
            <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </Field>
          <Field label="Lab (optional)">
            <Input value={lab} onChange={(e) => setLab(e.target.value)} />
          </Field>
          <Field label="Report type" className="col-span-2">
            <Select value={reportType} onChange={(e) => setReportType(e.target.value)}>
              {REPORT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Notes (optional)" className="col-span-2">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Fasting? Any symptoms or medication?" />
          </Field>
        </div>
        <Switch checked={analyze} onChange={setAnalyze} label="Analyse with AI after upload" />
      </CardBody>
      <CardFooter>
        <Button className="w-full sm:w-auto lg:w-full" onClick={upload} loading={uploading}>
          <Upload className="h-4 w-4" /> Upload report
        </Button>
      </CardFooter>
    </Card>
  );
}
