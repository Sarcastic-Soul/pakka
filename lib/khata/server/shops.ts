import type { EntryKind, Item, Shop } from "@/lib/khata/types";
import { generateShopCode, toShop } from "./auth";
import { db } from "./db";

type ShopRow = { id: number; code: string; name: string; is_demo: boolean };

/** Inserts a shop with a fresh unique code (retries on the rare collision). */
export async function createShop(name: string, pinHash: string | null, isDemo: boolean): Promise<Shop> {
  const sql = db();
  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = (await sql`
      INSERT INTO shops (code, name, pin_hash, is_demo)
      VALUES (${generateShopCode()}, ${name}, ${pinHash}, ${isDemo})
      ON CONFLICT (code) DO NOTHING
      RETURNING id, code, name, is_demo`) as ShopRow[];
    if (rows[0]) return toShop(rows[0]);
  }
  throw new Error("could not create a unique shop code");
}

export async function findShopByCode(code: string) {
  const rows = (await db()`
    SELECT id, code, name, is_demo, pin_hash FROM shops WHERE code = ${code}`) as (ShopRow & {
    pin_hash: string | null;
  })[];
  return rows[0] ?? null;
}

export async function deleteOldDemoShops(): Promise<void> {
  await db()`DELETE FROM shops WHERE is_demo AND created_at < now() - interval '24 hours'`;
}

const DEMO_CUSTOMERS = ["रमेश वर्मा", "सुनीता साहू", "अनिल तिवारी", "Pooja", "गुड्डू भैया"];

type Seed = { customer: number; daysAgo: number; kind: EntryKind; items: Item[]; total: number; said: string };

const it = (name: string, qty: string | null, amount: number | null): Item => ({ name, qty, amount });

const DEMO_ENTRIES: Seed[] = [
  { customer: 0, daysAgo: 9, kind: "udhaar", items: [it("आटा", "5 किलो", 225), it("तेल", "1 लीटर", 155)], total: 380, said: "रमेश वर्मा के खाते में 5 किलो आटा 225 और 1 लीटर तेल 155" },
  { customer: 1, daysAgo: 8, kind: "udhaar", items: [it("दूध", "2 पैकेट", 56), it("Parle-G", "4 पैकेट", 40)], total: 96, said: "सुनीता साहू 2 दूध 56 रुपये, 4 Parle-G 40 रुपये" },
  { customer: 2, daysAgo: 7, kind: "udhaar", items: [it("चीनी", "2 किलो", 96), it("Maggi", "6 पैकेट", 90)], total: 186, said: "अनिल तिवारी चीनी 2 किलो 96, 6 Maggi 90" },
  { customer: 0, daysAgo: 6, kind: "udhaar", items: [it("Maggi", "4 पैकेट", 60), it("दूध", "1 पैकेट", 28)], total: 88, said: "रमेश जी 4 Maggi 60 रुपये, एक दूध 28" },
  { customer: 3, daysAgo: 5, kind: "udhaar", items: [it("आटा", "3 किलो", 135), it("चीनी", "1 किलो", 48)], total: 183, said: "Pooja का 3 किलो आटा 135, चीनी 1 किलो 48" },
  { customer: 1, daysAgo: 4, kind: "jama", items: [], total: 50, said: "सुनीता जी 50 रुपये जमा कर गईं" },
  { customer: 4, daysAgo: 3, kind: "udhaar", items: [it("तेल", "1 लीटर", 160), it("Parle-G", "2 पैकेट", 20)], total: 180, said: "गुड्डू भैया तेल 160, दो Parle-G 20" },
  { customer: 0, daysAgo: 2, kind: "jama", items: [], total: 300, said: "रमेश वर्मा 300 रुपये दे गए" },
  { customer: 2, daysAgo: 1, kind: "udhaar", items: [it("दूध", "2 पैकेट", 56)], total: 56, said: "अनिल के खाते में 2 दूध 56 रुपये" },
  { customer: 4, daysAgo: 0, kind: "udhaar", items: [it("Maggi", "2 पैकेट", 30), it("चीनी", "500 ग्राम", 24)], total: 54, said: "गुड्डू भैया 2 Maggi 30, आधा किलो चीनी 24" },
];

export async function createDemoShop(): Promise<Shop> {
  const shop = await createShop("Sharma Kirana (demo)", null, true);
  const sql = db();
  const now = Date.now();
  await sql.transaction([
    ...DEMO_CUSTOMERS.map((name) => sql`INSERT INTO customers (shop_id, name) VALUES (${shop.id}, ${name})`),
    ...DEMO_ENTRIES.map((e) => {
      // Spread entries over the day, between 9 am and 8 pm-ish.
      const at = new Date(now - e.daysAgo * 86_400_000 - ((e.customer * 7 + e.daysAgo * 3) % 10) * 3_600_000);
      return sql`
        INSERT INTO entries (shop_id, customer_id, kind, items, total_rupees, transcript_raw, transcript_clean, flags, created_at)
        SELECT ${shop.id}, id, ${e.kind}, ${JSON.stringify(e.items)}::jsonb, ${e.total}, ${e.said}, ${e.said},
          '[]'::jsonb, ${at.toISOString()}
        FROM customers WHERE shop_id = ${shop.id} AND name = ${DEMO_CUSTOMERS[e.customer]}`;
    }),
  ]);
  return shop;
}
