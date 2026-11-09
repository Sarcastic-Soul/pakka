/** Loose key for matching names: case, nukta, spaces and punctuation do not count. */
export function nameKey(s: string): string {
  return s
    .normalize("NFC")
    .replaceAll("\u093c", "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}
