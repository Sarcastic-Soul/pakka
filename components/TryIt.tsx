"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Microphone, Stop, UploadSimple, Play, Waveform } from "@phosphor-icons/react";
import { diffWords } from "@/lib/diff";
import { g711RoundTrip } from "@/lib/live/g711";
import { mixAtSnr, resampleLinear } from "@/lib/live/mix";
import { encodeWav16 } from "@/lib/live/wav";

const RATE = 16000;
const MAX_RECORD_SEC = 12;
const SNRS = [10, 5, 0, -5, -10] as const;
type Noise = "street" | "fan";

type Status =
  | { kind: "idle" }
  | { kind: "recording"; left: number }
  | { kind: "decoding" }
  | { kind: "ready" }
  | { kind: "sending"; step: "clean" | "noisy" }
  | { kind: "done" }
  | { kind: "error"; message: string };

interface Result {
  clean: string;
  noisy: string;
  label: string;
}

async function decodeToMono16k(data: ArrayBuffer): Promise<Float32Array> {
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

async function transcribe(wav: Uint8Array): Promise<string> {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "content-type": "audio/wav" },
    body: wav as BlobPart,
  });
  let body: { transcript?: unknown; error?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    // fall through to a generic message
  }
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Transcription failed. Try again.");
  }
  return typeof body.transcript === "string" ? body.transcript : "";
}

function Transcript({ title, tokens }: { title: string; tokens: { text: string; hit: boolean }[] }) {
  return (
    <div className="flex-1 min-w-0 border-t pt-3" style={{ borderColor: "var(--rule, #d6d0c4)" }}>
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      {tokens.length === 0 ? (
        <p className="italic opacity-70">no speech returned</p>
      ) : (
        <p lang="hi" className="leading-relaxed">
          {tokens.map((t, i) => (
            <span key={i}>
              {t.hit ? (
                t.text
              ) : (
                <mark
                  className="underline decoration-2 underline-offset-4 bg-transparent"
                  style={{ color: "var(--accent, #b4441c)" }}
                >
                  {t.text}
                  <span className="sr-only"> (changed)</span>
                </mark>
              )}{" "}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export default function TryIt() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [clip, setClip] = useState<Float32Array | null>(null);
  const [noise, setNoise] = useState<Noise>("street");
  const [snr, setSnr] = useState<number>(0);
  const [phone, setPhone] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [noisyUrl, setNoisyUrl] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const noiseCache = useRef<Partial<Record<Noise, Float32Array>>>({});
  const audioEl = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (noisyUrl) URL.revokeObjectURL(noisyUrl);
    };
  }, [noisyUrl]);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const resetOutput = useCallback(() => {
    setResult(null);
    setNoisyUrl(null);
  }, []);

  const loadClip = useCallback(
    async (data: ArrayBuffer) => {
      setStatus({ kind: "decoding" });
      resetOutput();
      try {
        const samples = await decodeToMono16k(data);
        if (samples.length < RATE * 0.3) throw new Error("short");
        setClip(samples.length > RATE * MAX_RECORD_SEC ? samples.slice(0, RATE * MAX_RECORD_SEC) : samples);
        setStatus({ kind: "ready" });
      } catch {
        setClip(null);
        setStatus({ kind: "error", message: "Could not read that audio. Try a different file or record again." });
      }
    },
    [resetOutput],
  );

  const stopRecording = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const startRecording = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus({ kind: "error", message: "Microphone access was blocked. You can choose a file instead." });
      return;
    }
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      const blob = new Blob(chunks, { type: rec.mimeType });
      await loadClip(await blob.arrayBuffer());
    };
    recorder.current = rec;
    rec.start();
    resetOutput();
    let left = MAX_RECORD_SEC;
    setStatus({ kind: "recording", left });
    timer.current = setInterval(() => {
      left -= 1;
      if (left <= 0) stopRecording();
      else setStatus({ kind: "recording", left });
    }, 1000);
  }, [loadClip, resetOutput, stopRecording]);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) await loadClip(await file.arrayBuffer());
    },
    [loadClip],
  );

  const getNoise = useCallback(async (kind: Noise): Promise<Float32Array> => {
    const cached = noiseCache.current[kind];
    if (cached) return cached;
    const res = await fetch(`/noise/${kind}.mp3`);
    if (!res.ok) throw new Error("noise");
    const samples = await decodeToMono16k(await res.arrayBuffer());
    noiseCache.current[kind] = samples;
    return samples;
  }, []);

  const run = useCallback(async () => {
    if (!clip) return;
    resetOutput();
    let noisy: Float32Array;
    let noisyRate = RATE;
    try {
      const n = await getNoise(noise);
      noisy = mixAtSnr(clip, n, snr, RATE);
      if (phone) {
        noisy = g711RoundTrip(noisy, RATE);
        noisyRate = 8000;
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message === "clip is silent"
          ? "Your clip seems silent. Record again a little closer to the mic."
          : `Could not load the ${noise} noise sample. Try the other noise type or reload the page.`;
      setStatus({ kind: "error", message });
      return;
    }
    const cleanWav = encodeWav16(clip, RATE);
    const noisyWav = encodeWav16(noisy, noisyRate);
    setNoisyUrl(URL.createObjectURL(new Blob([noisyWav as BlobPart], { type: "audio/wav" })));
    try {
      setStatus({ kind: "sending", step: "clean" });
      const clean = await transcribe(cleanWav);
      setStatus({ kind: "sending", step: "noisy" });
      const noisyText = await transcribe(noisyWav);
      setResult({ clean, noisy: noisyText, label: `With ${noise} noise at ${snr} dB${phone ? ", phone line" : ""}` });
      setStatus({ kind: "done" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Transcription failed. Try again." });
    }
  }, [clip, getNoise, noise, phone, resetOutput, snr]);

  const busy = status.kind === "recording" || status.kind === "decoding" || status.kind === "sending";
  const diff = result ? diffWords(result.clean, result.noisy) : null;

  const statusText = (() => {
    switch (status.kind) {
      case "idle":
        return "Record up to 12 seconds or choose a file.";
      case "recording":
        return `Recording. ${status.left} seconds left.`;
      case "decoding":
        return "Reading your audio.";
      case "ready":
        return "Clip ready. Pick a noise and press Run.";
      case "sending":
        return status.step === "clean" ? "Sending the clean clip (1 of 2)." : "Sending the noisy clip (2 of 2).";
      case "done":
        return "Done.";
      case "error":
        return status.message;
    }
  })();

  const button =
    "inline-flex items-center gap-2 border px-3 py-2 text-sm rounded-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2";
  const buttonStyle = {
    borderColor: "var(--ink, #1f1c18)",
    outlineColor: "var(--accent, #b4441c)",
  } as const;

  return (
    <section
      aria-labelledby="tryit-title"
      className="flex flex-col gap-5"
      style={{ color: "var(--ink, #1f1c18)", background: "var(--paper, #f6f2ea)" }}
    >
      <h3 id="tryit-title" className="text-xl font-semibold">
        Try your own clip
      </h3>

      <div className="flex flex-wrap items-center gap-3">
        {status.kind === "recording" ? (
          <button type="button" className={button} style={buttonStyle} onClick={stopRecording}>
            <Stop aria-hidden weight="fill" /> Stop ({status.left}s)
          </button>
        ) : (
          <button type="button" className={button} style={buttonStyle} onClick={startRecording} disabled={busy}>
            <Microphone aria-hidden /> Record
          </button>
        )}
        <label
          className={`${button} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2`}
          style={{ ...buttonStyle, opacity: busy ? 0.5 : 1 }}
        >
          <UploadSimple aria-hidden /> Choose a file
          <input type="file" accept="audio/*" className="sr-only" onChange={onFile} disabled={busy} />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm mb-1">Noise</legend>
          <div className="flex gap-4">
            {(["street", "fan"] as const).map((n) => (
              <label key={n} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="tryit-noise"
                  value={n}
                  checked={noise === n}
                  onChange={() => setNoise(n)}
                  style={{ accentColor: "var(--accent, #b4441c)" }}
                />
                {n === "street" ? "Street" : "Fan"}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm mb-1">Signal to noise</legend>
          <div className="flex gap-4">
            {SNRS.map((s) => (
              <label key={s} className="inline-flex items-center gap-2 text-sm font-mono">
                <input
                  type="radio"
                  name="tryit-snr"
                  value={s}
                  checked={snr === s}
                  onChange={() => setSnr(s)}
                  style={{ accentColor: "var(--accent, #b4441c)" }}
                />
                {s} dB
              </label>
            ))}
          </div>
        </fieldset>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={phone}
            onChange={(e) => setPhone(e.target.checked)}
            style={{ accentColor: "var(--accent, #b4441c)" }}
          />
          Phone line (G.711)
        </label>

        <button type="button" className={button} style={buttonStyle} onClick={run} disabled={!clip || busy}>
          <Waveform aria-hidden /> Run
        </button>
      </div>

      <p className="text-sm opacity-80">Your clip is sent to Gnani for transcription and is not stored by this site.</p>

      <p aria-live="polite" role="status" className="text-sm" style={status.kind === "error" ? { color: "var(--accent, #b4441c)" } : undefined}>
        {statusText}
      </p>

      {noisyUrl && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={button}
            style={buttonStyle}
            onClick={() => {
              const el = audioEl.current;
              if (!el) return;
              el.currentTime = 0;
              void el.play();
            }}
          >
            <Play aria-hidden weight="fill" /> Play noisy clip
          </button>
          <audio ref={audioEl} src={noisyUrl} preload="auto" />
        </div>
      )}

      {diff && result && (
        <div className="flex flex-col gap-4 md:flex-row">
          <Transcript title="Clean" tokens={diff.reference} />
          <Transcript title={result.label} tokens={diff.hypothesis} />
        </div>
      )}
    </section>
  );
}
