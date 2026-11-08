const rupeeFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** "₹1,23,456" with Indian grouping. Negative values get a leading minus. */
export function formatRupees(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}₹${rupeeFormat.format(Math.abs(Math.round(n)))}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Short relative date in Hindi: आज, कल, 3 दिन पहले, 2 हफ़्ते पहले, 4 महीने पहले. */
export function relativeHindi(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "कोई एंट्री नहीं";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS);
  if (days <= 0) return "आज";
  if (days === 1) return "कल";
  if (days < 7) return `${days} दिन पहले`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? "1 हफ़्ता पहले" : `${w} हफ़्ते पहले`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return m === 1 ? "1 महीना पहले" : `${m} महीने पहले`;
  }
  const y = Math.floor(days / 365);
  return y === 1 ? "1 साल पहले" : `${y} साल पहले`;
}

/** Date and time for entry history, e.g. "9 नव॰ 2026, 4:05 pm". */
export function formatEntryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("hi-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

const DEVANAGARI_ZERO = 0x0966;

/** Convert Devanagari digits (०-९) to ASCII digits. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[०-९]/g, (c) => String(c.charCodeAt(0) - DEVANAGARI_ZERO));
}

// A number: digits (ASCII or Devanagari), optionally grouped with commas, optional decimals.
const NUMBER_RE = /[0-9०-९]+(?:,[0-9०-९]+)*(?:\.[0-9०-९]+)?/g;

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "num"; text: string; value: string; differs: boolean };

/** Normalised numeric value of a matched token: ASCII digits, commas removed. */
function numberValue(token: string): string {
  return toAsciiDigits(token).replace(/,/g, "");
}

/** All numbers in a transcript, normalised, in order. */
export function extractNumbers(text: string): string[] {
  return (text.match(NUMBER_RE) ?? []).map(numberValue);
}

/**
 * Split a transcript into text and number segments. When `other` is given, a
 * number is marked `differs` if the other transcript does not contain it
 * (counted as a multiset, so "30 30" vs "30" marks the second 30).
 */
export function highlightNumbers(text: string, other: string | null = null): Segment[] {
  const remaining = new Map<string, number>();
  if (other !== null) {
    for (const v of extractNumbers(other)) remaining.set(v, (remaining.get(v) ?? 0) + 1);
  }
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(NUMBER_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    const value = numberValue(m[0]);
    let differs = false;
    if (other !== null) {
      const left = remaining.get(value) ?? 0;
      if (left > 0) remaining.set(value, left - 1);
      else differs = true;
    }
    out.push({ kind: "num", text: m[0], value, differs });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Numbers that appear in one transcript but not the other (multiset difference). */
export function diffNumbers(a: string, b: string): { onlyA: string[]; onlyB: string[] } {
  const pick = (segs: Segment[]) =>
    segs.flatMap((s) => (s.kind === "num" && s.differs ? [s.value] : []));
  return { onlyA: pick(highlightNumbers(a, b)), onlyB: pick(highlightNumbers(b, a)) };
}

/**
 * Parse a rupee amount typed by the shop owner. Accepts ASCII or Devanagari
 * digits and commas. Returns null for empty or invalid input.
 */
export function parseRupees(input: string): number | null {
  const s = toAsciiDigits(input).replace(/[,₹\s]/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}
