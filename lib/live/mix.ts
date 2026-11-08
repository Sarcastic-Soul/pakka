const SILENCE_DBFS = -40;

function rms(x: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += x[i] * x[i];
  return end > start ? Math.sqrt(sum / (end - start)) : 0;
}

/** Span [start, end) from the first to the last sample above -40 dBFS, or null. */
function speechSpan(x: Float32Array): [number, number] | null {
  const threshold = 10 ** (SILENCE_DBFS / 20);
  let start = -1;
  let end = -1;
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]) > threshold) {
      if (start < 0) start = i;
      end = i + 1;
    }
  }
  return start < 0 ? null : [start, end];
}

// sampleRate is kept for API symmetry with the pipeline; the span rule does not need it.
export function speechRms(x: Float32Array, sampleRate: number): number {
  void sampleRate;
  const span = speechSpan(x);
  return span ? rms(x, span[0], span[1]) : 0;
}

export function mixAtSnr(
  clip: Float32Array,
  noise: Float32Array,
  snrDb: number,
  sampleRate: number,
): Float32Array {
  void sampleRate;
  const span = speechSpan(clip);
  if (!span) throw new Error("clip is silent");
  if (noise.length === 0) throw new Error("noise is silent");

  const window = new Float32Array(clip.length);
  for (let i = 0; i < clip.length; i++) window[i] = noise[i % noise.length];

  // Same rule as the pipeline: noise RMS over the speech span.
  const [start, end] = span;
  const noiseRms = rms(window, start, end);
  if (noiseRms === 0) throw new Error("noise is silent");
  const gain = rms(clip, start, end) / (noiseRms * 10 ** (snrDb / 20));

  const out = new Float32Array(clip.length);
  for (let i = 0; i < clip.length; i++) {
    out[i] = Math.max(-1, Math.min(1, clip[i] + window[i] * gain));
  }
  return out;
}

export function resampleLinear(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x.slice();
  const length = Math.max(1, Math.round((x.length * to) / from));
  const out = new Float32Array(length);
  const step = from / to;
  for (let i = 0; i < length; i++) {
    const pos = i * step;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, x.length - 1);
    const frac = pos - i0;
    const a = x[Math.min(i0, x.length - 1)] ?? 0;
    const b = x[i1] ?? 0;
    out[i] = a + (b - a) * frac;
  }
  return out;
}
