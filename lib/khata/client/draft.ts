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

/** Flags that should turn the card red (everything except new_customer). */
export function warningFlags(flags: Flag[]): Flag[] {
  return flags.filter((f) => f !== "new_customer");
}

export type FinalizeResult = { ok: true; entry: NewEntry } | { ok: false; error: string };

/** Validate the draft and turn it into the POST /api/entries body. */
export function finalizeDraft(d: Draft, existingCustomers: string[]): FinalizeResult {
  const customerName = d.customer.trim();
  if (!customerName) {
    return { ok: false, error: "ग्राहक का नाम लिखिए · Enter the customer's name." };
  }
  const total = parseRupees(d.total);
  if (total === null || total === 0) {
    return { ok: false, error: "कुल रकम पूरे रुपयों में भरिए · Enter the total in whole rupees." };
  }
  const items: NewEntry["items"] = [];
  for (const it of d.items) {
    const name = it.name.trim();
    const qty = it.qty.trim();
    const amountText = it.amount.trim();
    if (!name && !qty && !amountText) continue;
    if (!name) {
      return { ok: false, error: "हर सामान का नाम लिखिए · Every item needs a name." };
    }
    let amount: number | null = null;
    if (amountText) {
      amount = parseRupees(amountText);
      if (amount === null) {
        return { ok: false, error: "रकम सिर्फ़ अंकों में लिखिए · Item amounts must be whole rupees." };
      }
    }
    items.push({ name, qty: qty || null, amount });
  }
  const flags: Flag[] = warningFlags(d.flags);
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
