"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY } from "@/lib/init-scripts";

export { THEME_STORAGE_KEY };

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeChoice;
  resolved: ResolvedTheme;
  setTheme: (t: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "system", resolved: "light", setTheme: () => {} });

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

/** Light / Dark / System theme. "System" follows the OS setting live. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  // Don't touch <html> until the saved choice is read — the inline script already set it,
  // and applying the "system" default first would flash the wrong theme.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setThemeState(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const mq = media();
    const update = () => {
      const r: ResolvedTheme = theme === "system" ? (mq.matches ? "dark" : "light") : theme;
      setResolved(r);
      apply(r);
    };
    update();
    if (theme !== "system") return;
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [theme, ready]);

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    try {
      if (t === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* storage unavailable — choice lasts for this visit only */
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
