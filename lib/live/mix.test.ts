import { describe, expect, it } from "vitest";
import { mixAtSnr, resampleLinear, speechRms } from "./mix";

const RATE = 16000;

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
}

function speech(): Float32Array {
  // 0.5 s silence, 1 s tone, 0.5 s silence
  const x = new Float32Array(RATE * 2);
  for (let i = RATE / 2; i < RATE * 1.5; i++) x[i] = 0.2 * Math.sin((2 * Math.PI * 220 * i) / RATE);
  return x;
}

function noise(length: number): Float32Array {
  const r = rand(7);
  return new Float32Array(length).map(() => r() * 0.3);
}

function achievedSnr(clip: Float32Array, mixed: Float32Array): number {
  const added = mixed.map((v, i) => v - clip[i]);
  let sum = 0;
  for (let i = RATE / 2; i < RATE * 1.5; i++) sum += added[i] * added[i];
  const noiseRms = Math.sqrt(sum / RATE);
  return 20 * Math.log10(speechRms(clip, RATE) / noiseRms);
}

describe("speechRms", () => {
  it("trims leading and trailing silence", () => {
    expect(speechRms(speech(), RATE)).toBeCloseTo(0.2 / Math.SQRT2, 3);
  });

  it("is 0 for silence", () => {
    expect(speechRms(new Float32Array(RATE), RATE)).toBe(0);
  });
});

describe("mixAtSnr", () => {
  for (const snr of [20, 10, 5, 0]) {
    it(`hits ${snr} dB within 0.5 dB`, () => {
      const clip = speech();
      const mixed = mixAtSnr(clip, noise(clip.length), snr, RATE);
      expect(mixed.length).toBe(clip.length);
      expect(Math.abs(achievedSnr(clip, mixed) - snr)).toBeLessThan(0.5);
    });
  }

  it("loops short noise from index 0", () => {
    const clip = speech();
    const short = noise(1000);
    const mixed = mixAtSnr(clip, short, 10, RATE);
    expect(Math.abs(achievedSnr(clip, mixed) - 10)).toBeLessThan(0.5);
    const gain = (mixed[0] - clip[0]) / short[0];
    expect(mixed[1000] - clip[1000]).toBeCloseTo(short[0] * gain, 5);
  });

  it("clamps to [-1, 1]", () => {
    const clip = speech().map((v) => v * 4.9);
    const mixed = mixAtSnr(clip, noise(clip.length), 0, RATE);
    expect(Math.max(...mixed)).toBeLessThanOrEqual(1);
    expect(Math.min(...mixed)).toBeGreaterThanOrEqual(-1);
  });

  it("throws for a silent clip", () => {
    expect(() => mixAtSnr(new Float32Array(RATE), noise(RATE), 10, RATE)).toThrow("clip is silent");
  });

  it("throws for silent noise", () => {
    expect(() => mixAtSnr(speech(), new Float32Array(RATE), 10, RATE)).toThrow();
    expect(() => mixAtSnr(speech(), new Float32Array(0), 10, RATE)).toThrow();
  });
});

describe("resampleLinear", () => {
  it("changes length by the rate ratio", () => {
    expect(resampleLinear(new Float32Array(48000), 48000, 16000).length).toBe(16000);
    expect(resampleLinear(new Float32Array(8000), 8000, 16000).length).toBe(16000);
  });

  it("keeps a slow ramp", () => {
    const x = new Float32Array(100).map((_, i) => i / 100);
    const y = resampleLinear(x, 100, 50);
    expect(y[10]).toBeCloseTo(0.2, 5);
  });
});
