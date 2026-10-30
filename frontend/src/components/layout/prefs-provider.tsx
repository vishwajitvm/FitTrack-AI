"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { TEXT_SIZE_KEY } from "@/lib/init-scripts";

export { TEXT_SIZE_KEY };

export type ViewMode = "simple" | "detailed";
export type TextSize = "normal" | "large";

export const MODE_KEY = "fittrack.mode";
export const WIZARD_KEY = "fittrack.setupWizard"; // "done" | "skipped"

interface PrefsValue {
  mode: ViewMode;
  simple: boolean;
  setMode: (m: ViewMode) => void;
  textSize: TextSize;
  setTextSize: (s: TextSize) => void;
  /** Pick the wording for the current mode: plain words in Simple, technical in Detailed. */
  t: (simpleText: string, detailedText: string) => string;
}

const PrefsContext = createContext<PrefsValue>({
  mode: "simple",
  simple: true,
  setMode: () => {},
  textSize: "normal",
  setTextSize: () => {},
  t: (s) => s,
});

function read<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — preference lasts for this visit only */
  }
}

export function applyTextSize(size: TextSize) {
  document.documentElement.style.fontSize = size === "large" ? "112.5%" : "";
}

/** Simple/Detailed view mode and text size, saved per browser. New browsers start in Simple mode. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>("simple");
  const [textSize, setTextSizeState] = useState<TextSize>("normal");

  useEffect(() => {
    setModeState(read<ViewMode>(MODE_KEY, ["simple", "detailed"], "simple"));
    setTextSizeState(read<TextSize>(TEXT_SIZE_KEY, ["normal", "large"], "normal"));
  }, []);

  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    write(MODE_KEY, m);
  }, []);

  const setTextSize = useCallback((s: TextSize) => {
    setTextSizeState(s);
    write(TEXT_SIZE_KEY, s);
    applyTextSize(s);
  }, []);

  const simple = mode === "simple";
  const t = useCallback((s: string, d: string) => (simple ? s : d), [simple]);

  return <PrefsContext.Provider value={{ mode, simple, setMode, textSize, setTextSize, t }}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  return useContext(PrefsContext);
}
