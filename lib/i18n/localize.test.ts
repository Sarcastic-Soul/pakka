import { describe, expect, it } from "vitest";
import { dict } from "./dict";
import { localize } from "./localize";

describe("localize", () => {
  it("returns English-only messages unchanged", () => {
    expect(localize("Busy, try again.", "hi")).toBe("Busy, try again.");
    expect(localize("Busy, try again.", "en")).toBe("Busy, try again.");
  });

  it("splits the 'Hindi · English' client format", () => {
    const m = "फिर से लॉगिन कीजिए · Please log in again.";
    expect(localize(m, "hi")).toBe("फिर से लॉगिन कीजिए");
    expect(localize(m, "en")).toBe("Please log in again.");
  });

  it("splits the 'English. Hindi।' server format", () => {
    const m = "Shop code or PIN is wrong. कोड या PIN गलत है।";
    expect(localize(m, "en")).toBe("Shop code or PIN is wrong.");
    expect(localize(m, "hi")).toBe("कोड या PIN गलत है।");
  });
});

describe("dict", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(dict.hi).sort()).toEqual(Object.keys(dict.en).sort());
    expect(Object.keys(dict.hi.flags).sort()).toEqual(Object.keys(dict.en.flags).sort());
  });
});
