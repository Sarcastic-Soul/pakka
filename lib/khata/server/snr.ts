import { parseWavHeader } from "@/lib/live/wav";

/** Byte offset and length of the data chunk, or null. */
function dataChunk(bytes: Uint8Array): { at: number; size: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 12;
  while (at + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
    const size = view.getUint32(at + 4, true);
    if (id === "data") return { at: at + 8, size: Math.min(size, bytes.length - at - 8) };
    at += 8 + size + (size % 2);
  }
  return null;
}

/**
 * Rough SNR in dB: loud frames (90th percentile energy) over quiet frames
 * (10th percentile), 20 ms frames, first channel only. Null when too short
 * or silent.
 */
export function estimateSnrDb(wav: Uint8Array): number | null {
  const info = parseWavHeader(wav);
  const chunk = dataChunk(wav);
  if (!info || !chunk || info.bitsPerSample !== 16) return null;
  const view = new DataView(wav.buffer, wav.byteOffset + chunk.at, chunk.size);
  const stride = info.channels * 2;
  const total = Math.floor(chunk.size / stride);
  const frame = Math.max(1, Math.round(info.sampleRate * 0.02));
  const frames = Math.floor(total / frame);
  if (frames < 10) return null;
  const energies: number[] = [];
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) {
      const s = view.getInt16(i * stride, true);
      sum += s * s;
    }
    energies.push(sum / frame);
  }
  energies.sort((a, b) => a - b);
  const lo = energies[Math.floor(frames * 0.1)];
  const hi = energies[Math.min(frames - 1, Math.floor(frames * 0.9))];
  if (hi <= 0) return null;
  const db = 10 * Math.log10(hi / Math.max(lo, 1));
  return Math.round(db * 10) / 10;
}
