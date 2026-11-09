import type { Flag } from "@/lib/khata/types";

export const FLAG_ORDER: Flag[] = [
  "numbers_differ",
  "raw_empty",
  "amount_not_heard",
  "no_total",
  "sum_mismatch",
  "denoise_unavailable",
  "new_customer",
];

export function sortFlags(flags: Flag[]): Flag[] {
  return [...new Set(flags)].sort((a, b) => FLAG_ORDER.indexOf(a) - FLAG_ORDER.indexOf(b));
}
