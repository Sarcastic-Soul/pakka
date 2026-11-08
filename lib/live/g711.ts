import { resampleLinear } from "./mix";

const BIAS = 0x84;
const CLIP = 32635;

export function muLawEncode(sample16: number): number {
  let s = Math.max(-32768, Math.min(32767, Math.round(sample16)));
  const sign = s < 0 ? 0x80 : 0;
  if (s < 0) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

export function muLawDecode(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const magnitude = (((mantissa << 3) + BIAS) << exponent) - BIAS;
  return sign ? -magnitude : magnitude;
}

/** Simulates a G.711 phone line. Returns 8 kHz samples. */
export function g711RoundTrip(samples: Float32Array, sampleRate: number): Float32Array {
  const narrow = resampleLinear(samples, sampleRate, 8000);
  const out = new Float32Array(narrow.length);
  for (let i = 0; i < narrow.length; i++) {
    const s = Math.max(-1, Math.min(1, narrow[i]));
    out[i] = muLawDecode(muLawEncode(s * 32767)) / 32768;
  }
  return out;
}
