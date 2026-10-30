import type { Config } from "tailwindcss";

/** Colour backed by a CSS variable holding an "R G B" triplet (see globals.css). */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
/** Same, but scaled by another variable, so surfaces/tints/lines can be see-through (glass). */
const va = (name: string, alpha: string) => `rgb(var(--${name}) / calc(<alpha-value> * var(--${alpha})))`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral scale flips in dark mode, so `text-slate-900` / `bg-slate-50` work in both themes.
        slate: {
          50: va("slate-50", "tint-a"),
          100: va("slate-100", "tint-a"),
          200: v("slate-200"),
          300: v("slate-300"),
          400: v("slate-400"),
          500: v("slate-500"),
          600: v("slate-600"),
          700: v("slate-700"),
          800: v("slate-800"),
          900: v("slate-900"),
          950: v("slate-950"),
        },
        card: va("card", "card-a"),
        line: va("line", "line-a"),
        navy: { DEFAULT: v("navy"), 800: v("navy-800"), 700: v("navy-700") },
        // The sidebar follows the theme (light sidebar in light mode, near-black in dark).
        sidebar: {
          DEFAULT: v("sidebar"),
          text: v("sidebar-fg"),
          muted: v("sidebar-muted"),
          dim: v("sidebar-dim"),
          hover: v("sidebar-hover"),
          active: v("sidebar-active"),
          "active-fg": v("sidebar-active-fg"),
        },
        crit: { bg: v("crit-bg"), fg: v("crit-fg"), border: v("crit-border") },
        warn: { bg: v("warn-bg"), fg: v("warn-fg"), border: v("warn-border") },
        good: { bg: v("good-bg"), fg: v("good-fg"), border: v("good-border") },
        info: { bg: v("info-bg"), fg: v("info-fg"), border: v("info-border") },
        acc: {
          kcal: v("acc-kcal"),
          protein: v("acc-protein"),
          burn: v("acc-burn"),
          balance: v("acc-balance"),
          weight: v("acc-weight"),
          sleep: v("acc-sleep"),
          water: v("acc-water"),
        },
        brand: {
          50: v("brand-50"),
          100: v("brand-100"),
          500: v("brand-500"),
          600: v("brand-600"),
          700: v("brand-700"),
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "inset 0 1px 0 0 rgb(255 255 255 / 0.3), 0 8px 28px -14px rgb(var(--shadow) / 0.25)",
        pop: "0 30px 60px -24px rgb(var(--shadow) / 0.45)",
        glow: "0 10px 30px -10px rgb(var(--hero-from) / 0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
