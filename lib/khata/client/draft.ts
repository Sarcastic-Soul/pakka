import { dict, type Dict } from "@/lib/i18n/dict";
import type { EntryKind, Flag, ParseResult } from "@/lib/khata/types";
import type { NewEntry } from "./api";
import { parseRupees } from "./format";

/** Editable form state for the confirm card. Amounts stay as typed text until saved. */
export type DraftItem = { key: string; name: string; qty: string; amount: string };

export type Draft = {
  customer: string;
  kind: EntryKind;
  items: DraftItem[];
  total: string;
  transcriptRaw: string;
  transcriptClean: string | null;
  flags: Flag[];
  snrDb: number | null;
  fromVoice: boolean;
};

let seq = 0;

export function newItem(name = "", qty = "", amount = ""): DraftItem {
  seq += 1;
  return { key: `item-${seq}`, name, qty, amount };
}

export function draftFromParse(p: ParseResult): Draft {
  const items = p.items.map((it) =>
    newItem(it.name, it.qty ?? "", it.amount === null ? "" : String(it.amount)),
  );
  return {
    customer: p.customer ?? "",
    kind: p.kind,
    items: items.length > 0 ? items : [newItem()],
    total: p.total === null ? "" : String(p.total),
    transcriptRaw: p.transcriptRaw,
    transcriptClean: p.transcriptClean,
    flags: p.flags,
    snrDb: p.noise.snrDb,
    fromVoice: true,
  };
}

export function emptyDraft(): Draft {
  return {
    customer: "",
    kind: "udhaar",
    items: [newItem()],
    total: "",
    transcriptRaw: "",
    transcriptClean: null,
    flags: [],
    snrDb: null,
    fromVoice: false,
  };
}

/** Sum of item amounts that parse, or null when no item has an amount. */
export function itemsSum(items: DraftItem[]): number | null {
  let sum = 0;
  let any = false;
  for (const it of items) {
    const n = parseRupees(it.amount);
    if (n !== null) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}

export function isNewCustomer(name: string, existing: string[]): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return !existing.some((e) => e.trim().toLowerCase() === n);
}

/**
 * Flags for the card as it stands now. sum_mismatch and no_total depend on what
 * is typed in the form, so they are recomputed instead of kept from the parse.
 */
export function liveFlags(d: Pick<Draft, "flags" | "items" | "total">): Flag[] {
  const flags: Flag[] = d.flags.filter((f) => f !== "sum_mismatch" && f !== "no_total");
  const sum = itemsSum(d.items);
  const total = parseRupees(d.total);
  if (sum !== null && total !== null && sum !== total) flags.push("sum_mismatch");
  if (total === null && d.flags.includes("no_total")) flags.push("no_total");
  return flags;
}

/** Flags that should turn the card red (everything except new_customer). */
export function warningFlags(flags: Flag[]): Flag[] {
  return flags.filter((f) => f !== "new_customer");
}

export const MAX_TOTAL = 10_000_000;
export const MAX_ITEMS = 20;
export const MAX_TEXT = 60;

/** True when the draft holds anything worth asking about before it is thrown away. */
export function isDirty(d: Draft): boolean {
  return (
    d.fromVoice ||
    d.customer.trim() !== "" ||
    d.total.trim() !== "" ||
    d.items.some((it) => it.name.trim() || it.qty.trim() || it.amount.trim())
  );
}

export type FinalizeResult = { ok: true; entry: NewEntry } | { ok: false; error: string };

/** Validate the draft and turn it into the POST /api/entries body. */
export function finalizeDraft(
  d: Draft,
  existingCustomers: string[],
  msg: Dict["draftErrors"] = dict.en.draftErrors,
): FinalizeResult {
  const customerName = d.customer.trim();
  if (!customerName) {
    return { ok: false, error: msg.name };
  }
  const total = parseRupees(d.total);
  if (total === null || total === 0) {
    return { ok: false, error: msg.total };
  }
  if (total > MAX_TOTAL) {
    return { ok: false, error: msg.totalTooBig };
  }
  const items: NewEntry["items"] = [];
  for (const it of d.items) {
    const name = it.name.trim();
    const qty = it.qty.trim();
    const amountText = it.amount.trim();
    if (!name && !qty && !amountText) continue;
    if (!name) {
      return { ok: false, error: msg.itemName };
    }
    let amount: number | null = null;
    if (amountText) {
      amount = parseRupees(amountText);
      if (amount === null || amount > MAX_TOTAL) {
        return { ok: false, error: msg.itemAmount };
      }
    }
    items.push({ name, qty: qty || null, amount });
  }
  const flags: Flag[] = warningFlags(liveFlags(d));
  if (isNewCustomer(customerName, existingCustomers)) flags.push("new_customer");
  return {
    ok: true,
    entry: {
      customerName,
      kind: d.kind,
      items,
      total,
      transcriptRaw: d.transcriptRaw,
      transcriptClean: d.transcriptClean,
      flags,
    },
  };
}
