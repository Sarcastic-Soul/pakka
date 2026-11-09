// Customer name matching: case, nukta, punctuation, whitespace and a polite
// word like जी / भैया / श्री do not count.
const HONORIFIC_SUFFIXES = new Set(
  [
    "जी", "जि", "भैया", "भाई", "भइया", "साहब", "साब", "बाबू", "दीदी", "बहन", "बहनजी", "अंकल", "आंटी",
    "ji", "bhaiya", "bhai", "sahab", "didi", "uncle", "aunty",
  ].map(foldWord),
);
const HONORIFIC_PREFIXES = new Set(["श्री", "shri", "mr", "mrs"].map(foldWord));

function foldWord(w: string): string {
  return w.normalize("NFC").replaceAll("\u093c", "").toLowerCase();
}

/** Drops one leading and one trailing honorific word, never the whole name. */
export function stripHonorifics(name: string): string {
  const words = name.normalize("NFC").split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  if (words.length > 1 && (HONORIFIC_PREFIXES.has(foldWord(words[0])) || HONORIFIC_SUFFIXES.has(foldWord(words[0])))) {
    words.shift();
  }
  if (words.length > 1 && HONORIFIC_SUFFIXES.has(foldWord(words[words.length - 1]))) {
    words.pop();
  }
  return words.join(" ");
}

export function nameKey(name: string): string {
  return foldWord(stripHonorifics(name)).replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}

export function cleanName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function matchCustomer<T extends { id: number; name: string }>(
  name: string | null,
  customers: readonly T[],
): T | null {
  if (!name) return null;
  const key = nameKey(name);
  if (!key) return null;
  return customers.find((c) => nameKey(c.name) === key) ?? null;
}

/**
 * For the confirm card only: like matchCustomer, but a lone first name ("रमेश जी")
 * also matches when exactly one customer has it. The owner sees the full name on
 * the card before saving; saving itself uses the strict matchCustomer.
 */
export function suggestCustomer<T extends { id: number; name: string }>(
  name: string | null,
  customers: readonly T[],
): T | null {
  const exact = matchCustomer(name, customers);
  if (exact || !name) return exact;
  const key = nameKey(name);
  if (!key || stripHonorifics(name).split(" ").length !== 1) return null;
  const byFirst = customers.filter((c) => nameKey(stripHonorifics(c.name).split(" ")[0] ?? "") === key);
  return byFirst.length === 1 ? byFirst[0] : null;
}
