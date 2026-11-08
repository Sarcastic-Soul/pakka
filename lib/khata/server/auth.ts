import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import type { Shop } from "@/lib/khata/types";
import { db } from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "pakka_session";
const SESSION_DAYS = 30;
const KEY_LEN = 32;

// No 0/O, 1/I/L, 5/S, 2/Z, 8/B.
export const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
export const CODE_LENGTH = 6;

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^[0-9]{4,6}$/.test(pin);
}

export function generateShopCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pin, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const want = Buffer.from(keyHex, "hex");
  const got = await scryptAsync(pin, Buffer.from(saltHex, "hex"), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("session secret is not configured");
  return Buffer.from(s, "hex");
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

export function makeSessionToken(shopId: number, now = Date.now(), key = secret()): string {
  const expiry = Math.floor(now / 1000) + SESSION_DAYS * 24 * 3600;
  const payload = `${shopId}.${expiry}`;
  return `${payload}.${sign(payload, key)}`;
}

/** Returns the shop id for a valid, unexpired token, else null. */
export function readSessionToken(token: string | undefined, now = Date.now(), key = secret()): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idStr, expStr, mac] = parts;
  if (!/^[0-9]+$/.test(idStr) || !/^[0-9]+$/.test(expStr) || !/^[0-9a-f]{64}$/.test(mac)) return null;
  const want = Buffer.from(sign(`${idStr}.${expStr}`, key), "hex");
  const got = Buffer.from(mac, "hex");
  if (!timingSafeEqual(want, got)) return null;
  if (Number(expStr) * 1000 <= now) return null;
  return Number(idStr);
}

export async function setSession(shopId: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, makeSessionToken(shopId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

type ShopRow = { id: number; code: string; name: string; is_demo: boolean };

export function toShop(r: ShopRow): Shop {
  return { id: r.id, code: r.code, name: r.name, isDemo: r.is_demo };
}

/** The signed-in shop, or null when there is no valid session or the shop is gone. */
export async function currentShop(): Promise<Shop | null> {
  const store = await cookies();
  const id = readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (id === null) return null;
  const rows = (await db()`SELECT id, code, name, is_demo FROM shops WHERE id = ${id}`) as ShopRow[];
  return rows[0] ? toShop(rows[0]) : null;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
