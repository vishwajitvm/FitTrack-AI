/** One colour per metric (globals.css `--acc-*`), the same everywhere in the app. */
export type Accent = "kcal" | "protein" | "burn" | "balance" | "weight" | "sleep" | "water";

// Literal class names so Tailwind keeps them.
export const ACCENT: Record<Accent, { text: string; tint: string; solid: string; border: string; varName: string }> = {
  kcal: { text: "text-acc-kcal", tint: "bg-acc-kcal/10", solid: "bg-acc-kcal", border: "border-acc-kcal/30", varName: "--acc-kcal" },
  protein: { text: "text-acc-protein", tint: "bg-acc-protein/10", solid: "bg-acc-protein", border: "border-acc-protein/30", varName: "--acc-protein" },
  burn: { text: "text-acc-burn", tint: "bg-acc-burn/10", solid: "bg-acc-burn", border: "border-acc-burn/30", varName: "--acc-burn" },
  balance: { text: "text-acc-balance", tint: "bg-acc-balance/10", solid: "bg-acc-balance", border: "border-acc-balance/30", varName: "--acc-balance" },
  weight: { text: "text-acc-weight", tint: "bg-acc-weight/10", solid: "bg-acc-weight", border: "border-acc-weight/30", varName: "--acc-weight" },
  sleep: { text: "text-acc-sleep", tint: "bg-acc-sleep/10", solid: "bg-acc-sleep", border: "border-acc-sleep/30", varName: "--acc-sleep" },
  water: { text: "text-acc-water", tint: "bg-acc-water/10", solid: "bg-acc-water", border: "border-acc-water/30", varName: "--acc-water" },
};

export const accentColor = (a: Accent, alpha = 1) => `rgb(var(${ACCENT[a].varName}) / ${alpha})`;
