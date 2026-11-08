import { describe, expect, it } from "vitest";
import { encodeWav16 } from "@/lib/live/wav";
import { estimateSnrDb } from "./snr";

describe("estimateSnrDb", () => {
  it("is high for loud speech-like bursts over quiet noise", () => {
    const sr = 16000;
    const s = new Float32Array(sr * 2);
    for (let i = 0; i < s.length; i++) {
      const loud = Math.floor(i / 3200) % 2 === 0;
      s[i] = (loud ? 0.5 * Math.sin(i / 5) : 0) + 0.005 * (Math.random() * 2 - 1);
    }
    const db = estimateSnrDb(encodeWav16(s, sr))!;
    expect(db).toBeGreaterThan(30);
  });
  it("is near zero for steady noise", () => {
    const sr = 16000;
    const s = new Float32Array(sr);
    for (let i = 0; i < s.length; i++) s[i] = 0.3 * Math.sin(i / 3);
    expect(Math.abs(estimateSnrDb(encodeWav16(s, sr))!)).toBeLessThan(1);
  });
  it("is null for too-short or non-WAV input", () => {
    expect(estimateSnrDb(encodeWav16(new Float32Array(100), 16000))).toBeNull();
    expect(estimateSnrDb(new Uint8Array(10))).toBeNull();
  });
});
