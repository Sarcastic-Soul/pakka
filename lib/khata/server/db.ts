import net from "node:net";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Node's happy-eyeballs gives each address 250 ms by default, which is too short
// for far-away regions when IPv6 is unreachable. Applies to all fetch calls.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

let client: NeonQueryFunction<false, false> | null = null;

export function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("database is not configured");
    client = neon(url);
  }
  return client;
}

export function iso(v: unknown): string {
  return (v instanceof Date ? v : new Date(String(v))).toISOString();
}

/**
 * Adds one to today's (UTC) counter for `kind` unless it already reached `max`.
 * Returns false when the cap is hit.
 */
/** Today's count for `kind` without changing it. */
export async function peekDaily(kind: string): Promise<number> {
  const rows = (await db()`
    SELECT count FROM usage WHERE day = (now() AT TIME ZONE 'utc')::date AND kind = ${kind}`) as { count: number }[];
  return rows[0]?.count ?? 0;
}

export async function clearDaily(kind: string): Promise<void> {
  await db()`DELETE FROM usage WHERE day = (now() AT TIME ZONE 'utc')::date AND kind = ${kind}`;
}

export async function takeDaily(kind: string, max: number): Promise<boolean> {
  const sql = db();
  const rows = await sql`
    INSERT INTO usage (day, kind, count)
    VALUES ((now() AT TIME ZONE 'utc')::date, ${kind}, 1)
    ON CONFLICT (day, kind) DO UPDATE SET count = usage.count + 1
    WHERE usage.count < ${max}
    RETURNING count`;
  return rows.length > 0;
}
