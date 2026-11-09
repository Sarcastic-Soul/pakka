import type { Customer, Entry, EntryKind, Flag, Item } from "@/lib/khata/types";
import { db, iso } from "./db";
import { matchCustomer } from "./names";

type CustomerRow = { id: number; name: string; balance: string | number; last_entry_at: unknown };
type EntryRow = {
  id: number;
  customer_id: number;
  customer_name: string;
  kind: EntryKind;
  items: Item[];
  total_rupees: number;
  flags: Flag[];
  transcript_raw: string;
  transcript_clean: string | null;
  created_at: unknown;
};

function toCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    name: r.name,
    balance: Number(r.balance),
    lastEntryAt: r.last_entry_at ? iso(r.last_entry_at) : null,
  };
}

function toEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    kind: r.kind,
    items: r.items ?? [],
    total: r.total_rupees,
    flags: r.flags ?? [],
    transcriptRaw: r.transcript_raw,
    transcriptClean: r.transcript_clean,
    createdAt: iso(r.created_at),
  };
}

export async function listCustomers(shopId: number): Promise<Customer[]> {
  const rows = (await db()`
    SELECT c.id, c.name,
      COALESCE(SUM(CASE WHEN e.kind = 'udhaar' THEN e.total_rupees ELSE -e.total_rupees END), 0) AS balance,
      MAX(e.created_at) AS last_entry_at
    FROM customers c
    LEFT JOIN entries e ON e.customer_id = c.id
    WHERE c.shop_id = ${shopId}
    GROUP BY c.id
    ORDER BY balance DESC, last_entry_at DESC NULLS LAST, c.id`) as CustomerRow[];
  return rows.map(toCustomer);
}

export async function customerNames(shopId: number): Promise<{ id: number; name: string }[]> {
  return (await db()`SELECT id, name FROM customers WHERE shop_id = ${shopId} ORDER BY id`) as {
    id: number;
    name: string;
  }[];
}

export async function getCustomer(shopId: number, customerId: number): Promise<Customer | null> {
  const rows = (await db()`
    SELECT c.id, c.name,
      COALESCE(SUM(CASE WHEN e.kind = 'udhaar' THEN e.total_rupees ELSE -e.total_rupees END), 0) AS balance,
      MAX(e.created_at) AS last_entry_at
    FROM customers c
    LEFT JOIN entries e ON e.customer_id = c.id
    WHERE c.shop_id = ${shopId} AND c.id = ${customerId}
    GROUP BY c.id`) as CustomerRow[];
  return rows[0] ? toCustomer(rows[0]) : null;
}

export async function listEntries(shopId: number, customerId: number): Promise<Entry[]> {
  const rows = (await db()`
    SELECT e.id, e.customer_id, c.name AS customer_name, e.kind, e.items, e.total_rupees, e.flags,
      e.transcript_raw, e.transcript_clean, e.created_at
    FROM entries e JOIN customers c ON c.id = e.customer_id
    WHERE e.shop_id = ${shopId} AND e.customer_id = ${customerId}
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 500`) as EntryRow[];
  return rows.map(toEntry);
}

export async function getEntry(shopId: number, entryId: number): Promise<Entry | null> {
  const rows = (await db()`
    SELECT e.id, e.customer_id, c.name AS customer_name, e.kind, e.items, e.total_rupees, e.flags,
      e.transcript_raw, e.transcript_clean, e.created_at
    FROM entries e JOIN customers c ON c.id = e.customer_id
    WHERE e.shop_id = ${shopId} AND e.id = ${entryId}`) as EntryRow[];
  return rows[0] ? toEntry(rows[0]) : null;
}

/** Finds the customer by loose name match, else creates it. Returns the id. */
export async function findOrCreateCustomer(shopId: number, name: string): Promise<number> {
  const existing = matchCustomer(name, await customerNames(shopId));
  if (existing) return existing.id;
  const sql = db();
  const inserted = (await sql`
    INSERT INTO customers (shop_id, name) VALUES (${shopId}, ${name})
    ON CONFLICT (shop_id, lower(name)) DO NOTHING
    RETURNING id`) as { id: number }[];
  if (inserted[0]) return inserted[0].id;
  // Lost a race with another insert of the same name.
  const rows = (await sql`
    SELECT id FROM customers WHERE shop_id = ${shopId} AND lower(name) = lower(${name})`) as { id: number }[];
  return rows[0].id;
}

export type NewEntry = {
  customerId: number;
  kind: EntryKind;
  items: Item[];
  total: number;
  flags: Flag[];
  transcriptRaw: string;
  transcriptClean: string | null;
  createdAt?: Date;
};

export async function insertEntry(shopId: number, e: NewEntry): Promise<number> {
  const createdAt = (e.createdAt ?? new Date()).toISOString();
  const rows = (await db()`
    INSERT INTO entries (shop_id, customer_id, kind, items, total_rupees, transcript_raw, transcript_clean, flags, created_at)
    VALUES (${shopId}, ${e.customerId}, ${e.kind}, ${JSON.stringify(e.items)}::jsonb, ${e.total},
      ${e.transcriptRaw}, ${e.transcriptClean}, ${JSON.stringify(e.flags)}::jsonb, ${createdAt})
    RETURNING id`) as { id: number }[];
  return rows[0].id;
}

/** Deletes one entry of this shop. Returns its customer id, or null if not found. */
export async function deleteEntry(shopId: number, entryId: number): Promise<number | null> {
  const rows = (await db()`
    DELETE FROM entries WHERE shop_id = ${shopId} AND id = ${entryId}
    RETURNING customer_id`) as { customer_id: number }[];
  return rows[0]?.customer_id ?? null;
}
