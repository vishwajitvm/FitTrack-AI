// Formatting helpers for numbers, dates and labels.

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function kcal(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${fmt(n)} kcal`;
}

export function grams(n: number | null | undefined, digits = 1): string {
  return n === null || n === undefined ? "—" : `${fmt(n, digits)} g`;
}

/** Format a 0–1 fraction as a percentage. */
export function pct(n: number | null | undefined, digits = 0): string {
  return n === null || n === undefined ? "—" : `${fmt(n * 100, digits)}%`;
}

export function range(low: number | null | undefined, high: number | null | undefined): string | null {
  if (low === null || low === undefined || high === null || high === undefined) return null;
  return `${fmt(low)}–${fmt(high)}`;
}

/** Local-date ISO string (YYYY-MM-DD), not shifted to UTC. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toISODate(new Date());
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function prettyDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" },
): string {
  if (!iso) return "—";
  const d = iso.length <= 10 ? parseISODate(iso) : new Date(iso);
  return d.toLocaleDateString("en-GB", opts);
}

export function shortDate(iso: string): string {
  return prettyDate(iso, { day: "numeric", month: "short" });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function bytes(n: number | null | undefined): string {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
