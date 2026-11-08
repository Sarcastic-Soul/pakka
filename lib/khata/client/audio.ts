import { resampleLinear } from "@/lib/live/mix";
import { encodeWav16 } from "@/lib/live/wav";

export const RATE = 16000;
export const MAX_SECONDS = 15;

/** Decode any browser-recorded audio to 16 kHz mono samples. Browser only. */
export async function decodeToMono16k(data: ArrayBuffer): Promise<Float32Array> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(data);
    const mono = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / buf.numberOfChannels;
    }
    return resampleLinear(mono, buf.sampleRate, RATE);
  } finally {
    void ctx.close();
  }
}

/** 16-bit PCM WAV, at most MAX_SECONDS long. */
export function toWav(samples: Float32Array): Uint8Array {
  const max = RATE * MAX_SECONDS;
  return encodeWav16(samples.length > max ? samples.slice(0, max) : samples, RATE);
}

export function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.AudioContext !== "undefined"
  );
}
