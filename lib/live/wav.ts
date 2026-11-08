export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSec: number;
}

function ascii(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

export function encodeWav16(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const write = (at: number, s: string) => {
    for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
  }
  return out;
}

export function parseWavHeader(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 12 || ascii(bytes, 0) !== "RIFF" || ascii(bytes, 8) !== "WAVE") {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fmt: { format: number; channels: number; sampleRate: number; bits: number } | null = null;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const id = ascii(bytes, at);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (id === "fmt ") {
      if (size < 16 || body + 16 > bytes.length) return null;
      fmt = {
        format: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      // PCM (1) or WAVE_FORMAT_EXTENSIBLE (0xfffe) only
      if (!fmt || (fmt.format !== 1 && fmt.format !== 0xfffe)) return null;
      if (fmt.channels < 1 || fmt.sampleRate < 1 || fmt.bits < 8) return null;
      const available = Math.min(size, bytes.length - body);
      const frameBytes = fmt.channels * (fmt.bits / 8);
      return {
        sampleRate: fmt.sampleRate,
        channels: fmt.channels,
        bitsPerSample: fmt.bits,
        durationSec: available / frameBytes / fmt.sampleRate,
      };
    }
    at = body + size + (size % 2);
  }
  return null;
}
