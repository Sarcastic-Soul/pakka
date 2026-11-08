import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import {
  CODE_ALPHABET,
  generateShopCode,
  hashPin,
  isValidPin,
  makeSessionToken,
  readSessionToken,
  verifyPin,
} from "./auth";

const key = Buffer.from("ab".repeat(32), "hex");
const other = Buffer.from("cd".repeat(32), "hex");

describe("session token", () => {
  it("round-trips", () => {
    const t = makeSessionToken(42, Date.now(), key);
    expect(readSessionToken(t, Date.now(), key)).toBe(42);
  });
  it("rejects a token signed with another key", () => {
    expect(readSessionToken(makeSessionToken(42, Date.now(), other), Date.now(), key)).toBeNull();
  });
  it("rejects a changed shop id", () => {
    const [, exp, mac] = makeSessionToken(42, Date.now(), key).split(".");
    expect(readSessionToken(`43.${exp}.${mac}`, Date.now(), key)).toBeNull();
  });
  it("rejects an expired token", () => {
    const t = makeSessionToken(42, Date.now(), key);
    expect(readSessionToken(t, Date.now() + 31 * 86_400_000, key)).toBeNull();
  });
  it("rejects junk", () => {
    expect(readSessionToken(undefined, Date.now(), key)).toBeNull();
    expect(readSessionToken("a.b.c", Date.now(), key)).toBeNull();
    expect(readSessionToken("1.2", Date.now(), key)).toBeNull();
  });
});

describe("pin", () => {
  it("accepts 4 to 6 digits only", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin(1234)).toBe(false);
  });
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPin("4321");
    const b = await hashPin("4321");
    expect(a).not.toBe(b);
    expect(await verifyPin("4321", a)).toBe(true);
    expect(await verifyPin("4322", a)).toBe(false);
    expect(await verifyPin("4321", null)).toBe(false);
  });
});

describe("shop code", () => {
  it("is 6 chars from the alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateShopCode();
      expect(c).toHaveLength(6);
      for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
    }
  });
});
