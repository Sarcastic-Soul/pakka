import type { EntryKind, Flag, Item } from "@/lib/khata/types";
import { currentShop } from "@/lib/khata/server/auth";
import { fail, MSG, readJson } from "@/lib/khata/server/http";
import { findOrCreateCustomer, getCustomer, getEntry, insertEntry } from "@/lib/khata/server/ledger";
import { cleanName } from "@/lib/khata/server/names";

const MAX_TOTAL = 10_000_000;
const MAX_ITEMS = 20;
const MAX_TRANSCRIPT = 2000;
const FLAGS: readonly Flag[] = [
  "numbers_differ",
  "raw_empty",
  "amount_not_heard",
  "sum_mismatch",
  "new_customer",
  "no_total",
  "denoise_unavailable",
  "ai_unavailable",
];

type Valid = {
  customerName: string;
  kind: EntryKind;
  items: Item[];
  total: number;
  flags: Flag[];
  transcriptRaw: string;
  transcriptClean: string | null;
};

const isAmount = (v: unknown, min: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= MAX_TOTAL;

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s && s.length <= max ? s : null;
}

function validate(b: Record<string, unknown>): Valid | string {
  if (typeof b.customerName !== "string") return "Enter the customer's name. ग्राहक का नाम लिखें।";
  const customerName = cleanName(b.customerName);
  if (!customerName || b.customerName.trim().length > 60) return "Customer name must be 1 to 60 letters.";
  if (b.kind !== "udhaar" && b.kind !== "jama") return MSG.badRequest;
  if (!isAmount(b.total, 1)) return "Enter a total between ₹1 and ₹1,00,00,000. कुल रकम लिखें।";
  if (!Array.isArray(b.items) || b.items.length > MAX_ITEMS) return "Up to 20 items per entry.";
  const items: Item[] = [];
  for (const raw of b.items) {
    if (!raw || typeof raw !== "object") return MSG.badRequest;
    const it = raw as Record<string, unknown>;
    const name = text(it.name, 60);
    if (!name) return "Every item needs a name of up to 60 letters.";
    const qty = it.qty === null || it.qty === undefined || it.qty === "" ? null : text(it.qty, 60);
    if (qty === null && it.qty !== null && it.qty !== undefined && it.qty !== "") return MSG.badRequest;
    const amount = it.amount === null || it.amount === undefined ? null : it.amount;
    if (amount !== null && !isAmount(amount, 0)) return "Item amounts must be whole rupees.";
    items.push({ name, qty, amount });
  }
  const flags = Array.isArray(b.flags) ? b.flags : [];
  if (!flags.every((f): f is Flag => FLAGS.includes(f as Flag))) return MSG.badRequest;
  const transcriptRaw = typeof b.transcriptRaw === "string" ? b.transcriptRaw.slice(0, MAX_TRANSCRIPT) : "";
  const transcriptClean = typeof b.transcriptClean === "string" ? b.transcriptClean.slice(0, MAX_TRANSCRIPT) : null;
  return {
    customerName,
    kind: b.kind,
    items,
    total: b.total,
    flags: [...new Set(flags)],
    transcriptRaw,
    transcriptClean,
  };
}

export async function POST(req: Request) {
  try {
    const shop = await currentShop();
    if (!shop) return fail(401, MSG.signIn);
    const body = await readJson(req);
    if (!body) return fail(400, MSG.badRequest);
    const v = validate(body);
    if (typeof v === "string") return fail(400, v);

    const customerId = await findOrCreateCustomer(shop.id, v.customerName);
    const entryId = await insertEntry(shop.id, { ...v, customerId });
    const [entry, customer] = await Promise.all([getEntry(shop.id, entryId), getCustomer(shop.id, customerId)]);
    return Response.json({ entry, customer });
  } catch {
    console.error("pakka entries: failed");
    return fail(500, MSG.server);
  }
}
