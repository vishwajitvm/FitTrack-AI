// Reads a nutrition database serving hint ("1 pack cooked ≈ 250 g", "1 roti ≈ 35-40 g", "100 g") into grams + a unit.

export interface Serving {
  /** Grams in one serving. */
  grams: number;
  /** Unit for one serving ("pack", "katori", "roti"…), or null when the serving is just grams. */
  unit: string | null;
  /** Short label for one serving, e.g. "1 pack" or "100 g". */
  label: string;
}

const DEFAULT: Serving = { grams: 100, unit: null, label: "100 g" };

export function parseServing(hint: string | null | undefined): Serving {
  if (!hint) return DEFAULT;
  const g = /(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?\s*(?:g|ml)\b/i.exec(hint);
  if (!g) return DEFAULT;
  const grams = g[2] ? (Number(g[1]) + Number(g[2])) / 2 : Number(g[1]);
  if (!grams) return DEFAULT;
  // "1 pack cooked ≈ 250 g" → unit "pack"; a hint that is only grams has no unit
  const head = hint.slice(0, g.index).replace(/[≈~=(]/g, " ").trim();
  const u = /^(\d+(?:\.\d+)?|½|a|an|one)?\s*([a-z][a-z/ ]*?)(?:\s+(?:cooked|raw|boiled|plain|serving|portion))?\s*$/i.exec(head);
  const unit = u?.[2]?.trim().split(" ")[0] || null;
  return unit ? { grams, unit, label: `1 ${unit}` } : { grams, unit: null, label: `${Math.round(grams)} g` };
}

/** Macros for `grams` of a food given per-100 g values. */
export function scaleTo<T extends Record<string, number>>(per100: T, grams: number): T {
  const out = {} as Record<string, number>;
  for (const [k, v] of Object.entries(per100)) out[k] = (v * grams) / 100;
  return out as T;
}
