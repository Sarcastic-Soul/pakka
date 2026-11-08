import { describe, expect, it } from "vitest";
import { encodeWav16, parseWavHeader } from "./wav";

describe("wav", () => {
  it("round trips the header and duration", () => {
    const samples = new Float32Array(16000 * 2).map((_, i) => Math.sin(i / 10) * 0.5);
    const bytes = encodeWav16(samples, 16000);
    expect(bytes.length).toBe(44 + samples.length * 2);
    expect(parseWavHeader(bytes)).toEqual({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      durationSec: 2,
    });
  });

  it("clamps samples to the int16 range", () => {
    const bytes = encodeWav16(new Float32Array([2, -2, 0]), 8000);
    const view = new DataView(bytes.buffer);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(0);
  });

  it("finds the data chunk after extra chunks", () => {
    const base = encodeWav16(new Float32Array(8000), 8000);
    const list = new Uint8Array([0x4c, 0x49, 0x53, 0x54, 5, 0, 0, 0, 1, 2, 3, 4, 5, 0]);
    const bytes = new Uint8Array(base.length + list.length);
    bytes.set(base.subarray(0, 36), 0);
    bytes.set(list, 36);
    bytes.set(base.subarray(36), 36 + list.length);
    expect(parseWavHeader(bytes)?.durationSec).toBe(1);
  });

  it("returns null for non-WAV bytes", () => {
    expect(parseWavHeader(new TextEncoder().encode("ID3 this is an mp3 file"))).toBeNull();
    expect(parseWavHeader(new Uint8Array(0))).toBeNull();
  });

  it("returns null for non-PCM WAV", () => {
    const bytes = encodeWav16(new Float32Array(100), 8000);
    new DataView(bytes.buffer).setUint16(20, 7, true); // mu-law
    expect(parseWavHeader(bytes)).toBeNull();
  });
});
