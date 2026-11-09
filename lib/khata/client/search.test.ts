import { describe, expect, it } from "vitest";
import { nameKey } from "./search";

describe("nameKey", () => {
  it("ignores case, spaces, punctuation and nukta", () => {
    expect(nameKey(" Ramesh  V. ")).toBe("rameshv");
    expect(nameKey("हज़ारी लाल")).toBe(nameKey("हजारी लाल"));
  });
  it("is empty for blank input", () => {
    expect(nameKey("  ..")).toBe("");
  });
});
