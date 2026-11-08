import { describe, expect, it } from "vitest";
import { g711RoundTrip, muLawDecode, muLawEncode } from "./g711";

describe("mu-law", () => {
  it("decode(encode(x)) stays close to x", () => {
    for (const x of [0, 1, -1, 100, -100, 1000, -1000, 10000, -10000, 32000, -32000]) {
      const y = muLawDecode(muLawEncode(x));
      // mu-law error grows with magnitude: about 1/16 of the segment
      expect(Math.abs(y - x)).toBeLessThanOrEqual(Math.max(8, Math.abs(x) * 0.07));
    }
  });

  it("encodes to a byte", () => {
    for (const x of [-40000, -1, 0, 1, 40000]) {
      const b = muLawEncode(x);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
    expect(muLawEncode(0)).toBe(0xff);
  });
});

describe("g711RoundTrip", () => {
  it("returns 8 kHz samples close to the input", () => {
    const x = new Float32Array(16000).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 200 * i) / 16000));
    const y = g711RoundTrip(x, 16000);
    expect(y.length).toBe(8000);
    for (let i = 0; i < y.length; i += 97) {
      expect(Math.abs(y[i] - x[i * 2])).toBeLessThan(0.05);
    }
  });
});
