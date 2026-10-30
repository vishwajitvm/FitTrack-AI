import { useMemo } from "react";
import { useTheme } from "@/components/layout/theme-provider";

/** Colours for Recharts (SVG attributes can't read Tailwind classes, so they come from here). */
export function useChartTheme() {
  const { resolved } = useTheme();
  return useMemo(() => {
    const dark = resolved === "dark";
    return {
      dark,
      grid: dark ? "#232832" : "#EEF0F3",
      axis: dark ? "#949CAA" : "#687282",
      text: dark ? "#E2E8F0" : "#0F172A",
      ink: dark ? "#E2E8F0" : "#0F172A",
      muted: dark ? "#475569" : "#CBD5E1",
      tooltip: {
        contentStyle: {
          background: dark ? "#12151C" : "#FFFFFF",
          border: `1px solid ${dark ? "#2A303B" : "#E6E9EE"}`,
          borderRadius: 12,
          fontSize: 12,
          color: dark ? "#E2E8F0" : "#0F172A",
          boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
        },
        labelStyle: { color: dark ? "#F1F5F9" : "#0F172A", fontWeight: 600, marginBottom: 4 },
        itemStyle: { color: dark ? "#CBD5E1" : "#334155", padding: 0 },
        cursor: { fill: dark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.04)" },
      },
      legend: { fontSize: 12, color: dark ? "#CBD5E1" : "#334155" },
      c: {
        protein: dark ? "#A78BFA" : "#8B5CF6",
        carbs: "#38BDF8",
        fat: "#F59E0B",
        fibre: "#84CC16",
        intake: dark ? "#FB923C" : "#F97316",
        tdee: dark ? "#E2E8F0" : "#0F172A",
        deficit: "#10B981",
        surplus: "#EF4444",
        exercise: dark ? "#F472B6" : "#EC4899",
        bmr: dark ? "#64748B" : "#334155",
        neat: "#38BDF8",
        tef: "#A78BFA",
        lifting: dark ? "#94A3B8" : "#334155",
        cardio: "#38BDF8",
        energy: "#10B981",
        bloating: "#EF4444",
        late: "#F59E0B",
        sleep: "#818CF8",
        band: dark ? "rgba(16,185,129,0.14)" : "rgba(16,185,129,0.12)",
        window: dark ? "rgba(239,68,68,0.16)" : "rgba(239,68,68,0.10)",
      },
    };
  }, [resolved]);
}

export type ChartTheme = ReturnType<typeof useChartTheme>;
