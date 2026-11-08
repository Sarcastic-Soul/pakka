// Customer name matching: case, nukta, punctuation and whitespace do not count.
export function nameKey(name: string): string {
  return name
    .normalize("NFC")
    .replaceAll("\u093c", "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
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
