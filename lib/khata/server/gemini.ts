import { createLimiter } from "@/lib/live/limits";
import type { Item } from "@/lib/khata/types";
import type { Extracted } from "./checks";
import { takeDaily } from "./db";
import { numbersIn } from "./numbers";

const MODEL = "gemini-3.5-flash-lite";
const URL_GEN = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 15_000;
const DAILY_MAX = 450;
export const MAX_AMOUNT = 10_000_000;
const MAX_ITEMS = 20;
const MAX_TEXT = 60;

// Free tier is 15 RPM; stay under it.
const perMinute = createLimiter({ perKey: 12, windowMs: 60_000, globalMax: 12 });

export class GeminiBusy extends Error {
  constructor() {
    super("busy");
  }
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    customer: { type: "STRING", nullable: true },
    kind: { type: "STRING", enum: ["udhaar", "jama"] },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          qty: { type: "STRING", nullable: true },
          amount: { type: "INTEGER", nullable: true },
        },
        required: ["name", "qty", "amount"],
      },
    },
    total: { type: "INTEGER", nullable: true },
  },
  required: ["customer", "kind", "items", "total"],
};

const RULES = `You read one spoken entry from an Indian kirana shop's credit ledger (khata) and return JSON.
Fields: customer (name or null), kind ("udhaar" or "jama"), items [{name, qty, amount}], total.
Rules:
- Amounts are whole rupees as integers. NEVER invent an amount that is not spoken. If an item's amount is not said, amount = null.
- qty is the quantity as spoken (for example "2 packet", "1 किलो"), or null. A quantity is not an amount.
- Prefer the raw transcript. Use the cleaned transcript only to fill gaps the raw one leaves.
- If the customer paid money ("जमा", "दिए", "दे गए", "पैसे दे गए", "paid"), kind = "jama". Otherwise kind = "udhaar".
- Match the customer to a name from the existing customer list when it is clearly the same person (spelling or script variants like Ramesh / रमेश / रमेश वर्मा); return that exact list name. Otherwise return the name as spoken. If no name is spoken, customer = null.
- If only a total is spoken, items may be [].
- If items have amounts but no total is spoken, total = sum of the item amounts.
- If no amount at all is spoken, total = null.
- For jama with just an amount, items = [] and total = the amount paid.`;

function buildPrompt(raw: string, clean: string | null, names: string[]): string {
  return [
    RULES,
    "",
    `Existing customers: ${JSON.stringify(names)}`,
    `Raw transcript: ${JSON.stringify(raw)}`,
    `Cleaned transcript: ${clean === null ? "null" : JSON.stringify(clean)}`,
  ].join("\n");
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  return s || null;
}

function amountOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_AMOUNT) return undefined;
  return v;
}

/** Strict check of the model output. Returns null when anything is off. */
export function validateExtraction(v: unknown): Extracted | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.kind !== "udhaar" && o.kind !== "jama") return null;
  if (o.customer !== null && typeof o.customer !== "string") return null;
  if (!Array.isArray(o.items) || o.items.length > MAX_ITEMS) return null;
  const total = amountOrNull(o.total ?? null);
  if (total === undefined) return null;
  const items: Item[] = [];
  for (const raw of o.items) {
    if (!raw || typeof raw !== "object") return null;
    const it = raw as Record<string, unknown>;
    const name = cleanStr(it.name);
    if (!name) return null;
    if (it.qty !== null && it.qty !== undefined && typeof it.qty !== "string") return null;
    const amount = amountOrNull(it.amount ?? null);
    if (amount === undefined) return null;
    items.push({ name, qty: cleanStr(it.qty), amount });
  }
  return { customer: cleanStr(o.customer), kind: o.kind, items, total };
}

export function fallbackExtraction(raw: string, clean: string | null): Extracted {
  const nums = [...numbersIn(raw), ...(clean ? numbersIn(clean) : [])].filter((n) => n > 0 && n <= MAX_AMOUNT);
  return { customer: null, kind: "udhaar", items: [], total: nums.length ? Math.max(...nums) : null };
}

async function callOnce(prompt: string, key: string): Promise<unknown> {
  if (perMinute.check("gemini") !== "ok") throw new GeminiBusy();
  if (!(await takeDaily("gemini", DAILY_MAX))) throw new GeminiBusy();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(URL_GEN, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  console.log(`pakka gemini: status ${res.status} in ${Date.now() - t0} ms`);
  if (res.status === 429) throw new GeminiBusy();
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`gemini status ${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return JSON.parse(text);
}

/**
 * Turns transcripts into a ledger entry. Retries once on bad output, then
 * falls back to the largest number heard. Throws GeminiBusy on rate limits.
 */
export async function extractEntry(raw: string, clean: string | null, names: string[]): Promise<Extracted> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || (!raw.trim() && !clean?.trim())) return fallbackExtraction(raw, clean);
  const prompt = buildPrompt(raw, clean, names.slice(0, 200));
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ok = validateExtraction(await callOnce(prompt, key));
      if (ok) return ok;
      console.error("pakka gemini: output failed validation");
    } catch (err) {
      if (err instanceof GeminiBusy) throw err;
      console.error("pakka gemini: call failed");
    }
  }
  return fallbackExtraction(raw, clean);
}
