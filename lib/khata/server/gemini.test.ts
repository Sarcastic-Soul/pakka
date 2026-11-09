import { describe, expect, it } from "vitest";
import { fallbackExtraction, validateExtraction } from "./gemini";

describe("validateExtraction", () => {
  it("accepts good output and trims strings", () => {
    const v = validateExtraction({
      customer: "  रमेश  वर्मा ",
      kind: "udhaar",
      items: [{ name: "Maggi", qty: "2 packet", amount: 30 }, { name: "x".repeat(80), qty: null, amount: null }],
      total: 30,
    });
    expect(v).toEqual({
      customer: "रमेश वर्मा",
      kind: "udhaar",
      items: [
        { name: "Maggi", qty: "2 packet", amount: 30 },
        { name: "x".repeat(60), qty: null, amount: null },
      ],
      total: 30,
    });
  });
  it("rejects bad kinds, fractions, negatives and huge values", () => {
    const base = { customer: null, kind: "jama", items: [], total: 500 };
    expect(validateExtraction(base)).not.toBeNull();
    expect(validateExtraction({ ...base, kind: "loan" })).toBeNull();
    expect(validateExtraction({ ...base, total: 10.5 })).toBeNull();
    expect(validateExtraction({ ...base, total: -1 })).toBeNull();
    expect(validateExtraction({ ...base, total: 10_000_001 })).toBeNull();
    expect(validateExtraction({ ...base, total: "500" })).toBeNull();
    expect(validateExtraction({ ...base, items: [{ name: "", qty: null, amount: 1 }] })).toBeNull();
    expect(validateExtraction({ ...base, items: Array(21).fill({ name: "a", qty: null, amount: 1 }) })).toBeNull();
    expect(validateExtraction(null)).toBeNull();
    expect(validateExtraction([])).toBeNull();
  });
});

describe("fallbackExtraction", () => {
  it("uses the largest number heard", () => {
    expect(fallbackExtraction("2 Maggi 30 और दो सौ", null)).toEqual({ customer: null, kind: "udhaar", items: [], total: 200, guessed: true });
    expect(fallbackExtraction("कुछ नहीं", "")).toEqual({ customer: null, kind: "udhaar", items: [], total: null, guessed: true });
  });
});
