import { describe, expect, it } from "vitest";
import { diffWords } from "./diff";

const texts = (tokens: { text: string }[]) => tokens.map((t) => t.text);
const hits = (tokens: { hit: boolean }[]) => tokens.map((t) => t.hit);

describe("diffWords", () => {
  it("marks identical text as all hits", () => {
    const d = diffWords("कुल 2,50,000 रुपये चाहिए", "कुल 2,50,000 रुपये चाहिए");
    expect(hits(d.reference)).toEqual([true, true, true, true]);
    expect(hits(d.hypothesis)).toEqual([true, true, true, true]);
  });

  it("flags a wrong digit on both sides and keeps the rest", () => {
    const d = diffWords("मेरा नंबर 12345 है", "मेरा नंबर 12335 है");
    expect(texts(d.reference)).toEqual(["मेरा", "नंबर", "12345", "है"]);
    expect(hits(d.reference)).toEqual([true, true, false, true]);
    expect(texts(d.hypothesis)).toEqual(["मेरा", "नंबर", "12335", "है"]);
    expect(hits(d.hypothesis)).toEqual([true, true, false, true]);
  });

  it("marks every reference token as a miss when the hypothesis is empty", () => {
    const d = diffWords("मेरा नाम राहुल है", "");
    expect(hits(d.reference)).toEqual([false, false, false, false]);
    expect(d.hypothesis).toEqual([]);
  });

  it("marks every hypothesis token as a miss when the reference is empty", () => {
    const d = diffWords("", "मेरा नाम");
    expect(d.reference).toEqual([]);
    expect(hits(d.hypothesis)).toEqual([false, false]);
  });

  it("returns empty lists for two empty strings", () => {
    expect(diffWords("", "  ")).toEqual({ reference: [], hypothesis: [] });
  });

  it("flags an extra hypothesis word", () => {
    const d = diffWords("a b c", "a x b c");
    expect(hits(d.reference)).toEqual([true, true, true]);
    expect(hits(d.hypothesis)).toEqual([true, false, true, true]);
  });

  it("flags a dropped hypothesis word", () => {
    const d = diffWords("a b c", "a c");
    expect(hits(d.reference)).toEqual([true, false, true]);
    expect(hits(d.hypothesis)).toEqual([true, true]);
  });

  it("ignores case and punctuation when matching but keeps display text", () => {
    const d = diffWords("Hello, World!", "hello world");
    expect(texts(d.reference)).toEqual(["Hello,", "World!"]);
    expect(hits(d.reference)).toEqual([true, true]);
    expect(texts(d.hypothesis)).toEqual(["hello", "world"]);
    expect(hits(d.hypothesis)).toEqual([true, true]);
  });

  it("ignores the Devanagari danda and currency symbols", () => {
    const d = diffWords("ठीक है।", "ठीक है");
    expect(hits(d.reference)).toEqual([true, true]);
    const e = diffWords("₹500 दीजिए", "500 दीजिए");
    expect(hits(e.reference)).toEqual([true, true]);
  });

  it("does not strip combining marks", () => {
    const d = diffWords("नहीं", "नही");
    expect(hits(d.reference)).toEqual([false]);
    expect(hits(d.hypothesis)).toEqual([false]);
  });

  it("splits on any whitespace", () => {
    const d = diffWords("a\tb\n c", "a b c");
    expect(hits(d.reference)).toEqual([true, true, true]);
  });
});
