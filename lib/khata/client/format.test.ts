import { describe, expect, it } from "vitest";
import {
  diffNumbers,
  extractNumbers,
  formatRupees,
  highlightNumbers,
  parseRupees,
  relativeEnglish,
  relativeHindi,
  toAsciiDigits,
} from "./format";

describe("formatRupees", () => {
  it("uses Indian grouping", () => {
    expect(formatRupees(0)).toBe("₹0");
    expect(formatRupees(58)).toBe("₹58");
    expect(formatRupees(1250)).toBe("₹1,250");
    expect(formatRupees(123456)).toBe("₹1,23,456");
    expect(formatRupees(10000000)).toBe("₹1,00,00,000");
  });
  it("puts the minus before the rupee sign", () => {
    expect(formatRupees(-1500)).toBe("-₹1,500");
  });
});

describe("relativeEnglish", () => {
  const now = new Date(2026, 10, 9, 12);
  it("handles today, yesterday and plurals", () => {
    expect(relativeEnglish(null, now)).toBe("No entries");
    expect(relativeEnglish(new Date(2026, 10, 9, 8).toISOString(), now)).toBe("Today");
    expect(relativeEnglish(new Date(2026, 10, 8, 23).toISOString(), now)).toBe("Yesterday");
    expect(relativeEnglish(new Date(2026, 10, 6).toISOString(), now)).toBe("3 days ago");
    expect(relativeEnglish(new Date(2026, 10, 2).toISOString(), now)).toBe("1 week ago");
    expect(relativeEnglish(new Date(2026, 9, 20).toISOString(), now)).toBe("2 weeks ago");
    expect(relativeEnglish(new Date(2025, 9, 1).toISOString(), now)).toBe("1 year ago");
  });
});

describe("relativeHindi", () => {
  const now = new Date(2026, 10, 9, 18, 0, 0);
  it("handles null", () => {
    expect(relativeHindi(null, now)).toBe("कोई एंट्री नहीं");
  });
  it("uses calendar days", () => {
    expect(relativeHindi(new Date(2026, 10, 9, 8).toISOString(), now)).toBe("आज");
    expect(relativeHindi(new Date(2026, 10, 8, 23).toISOString(), now)).toBe("कल");
    expect(relativeHindi(new Date(2026, 10, 6).toISOString(), now)).toBe("3 दिन पहले");
  });
  it("rolls up to weeks, months and years", () => {
    expect(relativeHindi(new Date(2026, 10, 2).toISOString(), now)).toBe("1 हफ़्ता पहले");
    expect(relativeHindi(new Date(2026, 9, 20).toISOString(), now)).toBe("2 हफ़्ते पहले");
    expect(relativeHindi(new Date(2026, 8, 1).toISOString(), now)).toBe("2 महीने पहले");
    expect(relativeHindi(new Date(2025, 9, 1).toISOString(), now)).toBe("1 साल पहले");
  });
  it("treats future dates as today and bad input as empty", () => {
    expect(relativeHindi(new Date(2026, 10, 10).toISOString(), now)).toBe("आज");
    expect(relativeHindi("not a date", now)).toBe("");
  });
});

describe("numbers in transcripts", () => {
  it("converts Devanagari digits", () => {
    expect(toAsciiDigits("२८ रुपये")).toBe("28 रुपये");
  });

  it("extracts ASCII, Devanagari and comma-grouped numbers", () => {
    expect(extractNumbers("रमेश के खाते में 2 Maggi 30, दूध २८ और 1,200")).toEqual([
      "2",
      "30",
      "28",
      "1200",
    ]);
  });

  it("splits text into segments that join back to the original", () => {
    const text = "2 Maggi 30, दूध 28";
    const segs = highlightNumbers(text);
    expect(segs.map((s) => s.text).join("")).toBe(text);
    expect(segs.filter((s) => s.kind === "num").map((s) => s.text)).toEqual(["2", "30", "28"]);
    expect(segs.some((s) => s.kind === "num" && s.differs)).toBe(false);
  });

  it("marks numbers missing from the other transcript", () => {
    const raw = "2 Maggi 30, दूध 38";
    const clean = "2 Maggi 30, दूध 28";
    const segs = highlightNumbers(raw, clean);
    const nums = segs.flatMap((s) => (s.kind === "num" ? [[s.text, s.differs]] : []));
    expect(nums).toEqual([
      ["2", false],
      ["30", false],
      ["38", true],
    ]);
    expect(diffNumbers(raw, clean)).toEqual({ onlyA: ["38"], onlyB: ["28"] });
  });

  it("matches numbers across digit scripts", () => {
    expect(diffNumbers("दूध २८", "दूध 28")).toEqual({ onlyA: [], onlyB: [] });
  });

  it("counts repeated numbers as a multiset", () => {
    expect(diffNumbers("30 और 30", "30")).toEqual({ onlyA: ["30"], onlyB: [] });
  });

  it("treats an empty other transcript as all different", () => {
    expect(diffNumbers("कुल 58", "")).toEqual({ onlyA: ["58"], onlyB: [] });
  });
});

describe("parseRupees", () => {
  it("parses typed amounts", () => {
    expect(parseRupees("58")).toBe(58);
    expect(parseRupees(" 1,250 ")).toBe(1250);
    expect(parseRupees("₹२८")).toBe(28);
  });
  it("rejects empty, decimal and negative input", () => {
    expect(parseRupees("")).toBeNull();
    expect(parseRupees("12.5")).toBeNull();
    expect(parseRupees("-5")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
  });
});
