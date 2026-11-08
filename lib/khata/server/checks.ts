import type { Flag, Item } from "@/lib/khata/types";
import { matchCustomer } from "./names";
import { numbersIn } from "./numbers";

export type Extracted = {
  customer: string | null;
  kind: "udhaar" | "jama";
  items: Item[];
  total: number | null;
};

function sameSet(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function runChecks(
  raw: string,
  clean: string | null,
  parsed: Extracted,
  customers: readonly { id: number; name: string }[],
): { flags: Flag[]; customerId: number | null; customer: string | null } {
  const flags: Flag[] = [];
  const rawNums = numbersIn(raw);
  const cleanNums = clean === null ? null : numbersIn(clean);

  if (cleanNums && !sameSet(rawNums, cleanNums)) flags.push("numbers_differ");
  if (!raw.trim()) flags.push("raw_empty");

  const heard = new Set([...rawNums, ...(cleanNums ?? [])]);
  const amounts = parsed.items.map((i) => i.amount).filter((a): a is number => a !== null);
  const sum = amounts.reduce((s, a) => s + a, 0);
  const totalHeard = parsed.total === null || heard.has(parsed.total) || (amounts.length > 0 && parsed.total === sum);
  if (amounts.some((a) => !heard.has(a)) || !totalHeard) flags.push("amount_not_heard");

  if (amounts.length > 0 && parsed.total !== null && sum !== parsed.total) flags.push("sum_mismatch");

  const match = matchCustomer(parsed.customer, customers);
  if (!match) flags.push("new_customer");
  if (parsed.total === null) flags.push("no_total");

  return { flags, customerId: match?.id ?? null, customer: match?.name ?? parsed.customer };
}
