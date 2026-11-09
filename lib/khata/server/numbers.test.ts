import { describe, expect, it } from "vitest";
import { extractNumbers, numbersIn, parseSpokenNumbers } from "./numbers";

describe("extractNumbers", () => {
  it("drops Indian grouping commas", () => {
    expect(extractNumbers("2,50,000 रुपये")).toEqual(["250000"]);
  });
  it("drops Western grouping commas", () => {
    expect(extractNumbers("1,234,567")).toEqual(["1234567"]);
  });
  it("keeps list commas as separators", () => {
    expect(extractNumbers("1, 2 और 12,3456")).toEqual(["1", "2", "12", "3456"]);
  });
  it("maps Devanagari digits to ASCII", () => {
    expect(extractNumbers("₹२४० दिए")).toEqual(["240"]);
  });
});

describe("parseSpokenNumbers", () => {
  it("reads Hindi hundreds", () => {
    expect(parseSpokenNumbers("दो सौ चालीस")).toEqual([240]);
  });
  it("mixes digits with scale words", () => {
    expect(parseSpokenNumbers("1 करोड़ 25 लाख")).toEqual([12500000]);
    expect(parseSpokenNumbers("2 लाख 50 हज़ार")).toEqual([250000]);
  });
  it("ignores nukta differences", () => {
    expect(parseSpokenNumbers("तीन हजार")).toEqual([3000]);
    expect(parseSpokenNumbers("अडतालीस")).toEqual([48]);
  });
  it("reads English words", () => {
    expect(parseSpokenNumbers("two hundred and forty five rupees")).toEqual([245]);
    expect(parseSpokenNumbers("twenty five")).toEqual([25]);
  });
  it("splits repeated scales into separate numbers", () => {
    expect(parseSpokenNumbers("दो लाख तीन लाख")).toEqual([200000, 300000]);
  });
  it("leaves bare digits to extractNumbers", () => {
    expect(parseSpokenNumbers("240 रुपये")).toEqual([]);
  });
  it("splits Hindi number words that cannot combine", () => {
    expect(parseSpokenNumbers("बीस पाँच")).toEqual([20, 5]);
  });
});

describe("fraction words", () => {
  it.each([
    ["डेढ़ सौ", 150],
    ["डेढ सौ", 150],
    ["dedh sau", 150],
    ["डेढ़ हज़ार", 1500],
    ["ढाई सौ", 250],
    ["ढ़ाई सौ", 250],
    ["dhai hazar", 2500],
    ["ढाई हज़ार", 2500],
    ["सवा सौ", 125],
    ["sawa sau", 125],
    ["sava sau", 125],
    ["सवा दो सौ", 225],
    ["सवा हज़ार", 1250],
    ["साढ़े तीन सौ", 350],
    ["साढे तीन सौ", 350],
    ["sadhe तीन sau", 350],
    ["saade 3 sau", 350],
    ["साढ़े 3 सौ", 350],
    ["साढ़े चार हज़ार", 4500],
    ["पौने दो सौ", 175],
    ["paune 2 sau", 175],
    ["पौने तीन हज़ार", 2750],
  ])("%s = %i", (text, value) => {
    expect(parseSpokenNumbers(text)).toEqual([value]);
    expect(numbersIn(text).has(value)).toBe(true);
  });
  it("adds no stray unit value", () => {
    expect(numbersIn("डेढ़ सौ")).toEqual(new Set([150]));
    // Digits are still read on their own, as with "2 लाख".
    expect(numbersIn("साढ़े 3 सौ")).toEqual(new Set([3, 350]));
  });
  it("reads a fraction amount inside a sentence", () => {
    expect(numbersIn("रमेश को डेढ़ सौ का सामान दिया")).toEqual(new Set([150]));
  });
  it("joins a larger scale before the fraction", () => {
    expect(parseSpokenNumbers("दो लाख ढाई हज़ार")).toEqual([202500]);
  });
  it("ignores bare fraction words with no unit", () => {
    expect(numbersIn("डेढ़ किलो चीनी").size).toBe(0);
    expect(numbersIn("ढाई").size).toBe(0);
    expect(numbersIn("सवा").size).toBe(0);
  });
  it("never adds non-integers", () => {
    for (const n of numbersIn("डेढ़ किलो साढ़े तीन सौ पौने दो सौ")) {
      expect(Number.isInteger(n)).toBe(true);
    }
  });
});

describe("numbersIn", () => {
  it("unions digits and words", () => {
    expect([...numbersIn("2,50,000 रुपये")]).toEqual([250000]);
    const s = numbersIn("2 Maggi 30 रुपये और एक दूध अट्ठाईस");
    expect(s).toEqual(new Set([2, 30, 1, 28]));
  });
  it("keeps digit-only amounts as before", () => {
    expect(numbersIn("2 Maggi 30")).toEqual(new Set([2, 30]));
  });
  it("is empty for no numbers", () => {
    expect(numbersIn("रमेश जी").size).toBe(0);
  });
});
