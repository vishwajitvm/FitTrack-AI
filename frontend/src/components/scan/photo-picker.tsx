"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoPickerProps {
  previewUrl: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
}

/** One-tap camera capture on phones, file picker (or drag and drop) on desktop. */
export function PhotoPicker({ previewUrl, onPick, onClear }: PhotoPickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onPick(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (file) onPick(file);
  };

  return (
    <div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handle} />
      {previewUrl ? (
        <div className="fade-up relative overflow-hidden rounded-2xl border border-line bg-slate-100">
          <img src={previewUrl} alt="Meal preview" className="mx-auto max-h-80 w-full object-contain" />
          <div className="absolute right-3 top-3 flex gap-2">
            <Button size="sm" variant="outline" className="h-9 bg-card/90 backdrop-blur" onClick={() => cameraRef.current?.click()}>
              <Camera className="h-3.5 w-3.5" /> Retake
            </Button>
            <Button size="icon" variant="outline" className="bg-card/90 backdrop-blur" onClick={onClear} aria-label="Remove photo">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-good-border bg-good-bg px-2.5 py-1 text-xs font-semibold text-good-fg shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5" /> Photo ready
          </span>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors sm:py-10",
            dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60 hover:border-brand-500/60",
          )}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-8 ring-brand-50/50">
            <Camera className="h-7 w-7" />
          </span>
          <p className="mt-4 text-base font-semibold text-slate-900">{dragging ? "Drop your photo here" : "Snap your plate"}</p>
          <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-slate-500">A clear photo from above works best. You can also skip the photo and just describe the meal.</p>
          <div className="mt-5 grid w-full max-w-sm gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Button size="lg" className="w-full px-4 text-sm" onClick={() => cameraRef.current?.click()}>
              <Camera className="h-4 w-4" /> Take a photo
            </Button>
            <Button size="lg" variant="outline" className="w-full px-4 text-sm" onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Upload from gallery
            </Button>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
            <Sun className="h-3.5 w-3.5" /> Good light, whole plate in view · JPG, PNG, WEBP
            <span className="hidden lg:inline">· or drag a photo here</span>
          </p>
        </div>
      )}
    </div>
  );
}
