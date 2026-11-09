"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Microphone, MicrophoneSlash, Stop } from "@phosphor-icons/react";
import { MAX_SECONDS, recordingSupported } from "@/lib/khata/client/audio";
import { useLang } from "@/lib/i18n/useLang";

export type RecorderError = "denied" | "unsupported" | "failed";

/**
 * Tap to start, tap to stop, auto-stop at MAX_SECONDS. Shows elapsed time and a
 * live input level. Hands the recorded blob to onRecorded.
 */
export default function Recorder({
  disabled,
  onRecorded,
  onError,
}: {
  disabled: boolean;
  onRecorded: (blob: Blob) => void;
  onError: (e: RecorderError) => void;
}) {
  const { lang, t } = useLang();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [supported, setSupported] = useState(true);
  const level = useRef<HTMLDivElement | null>(null);

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);
  const starting = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    // Feature check must run in the browser after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(recordingSupported());
  }, []);

  const teardown = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close();
    ctx.current = null;
    if (level.current) level.current.style.transform = "scaleX(0)";
  }, []);

  useEffect(
    () => () => {
      if (rec.current && rec.current.state !== "inactive") {
        rec.current.onstop = null;
        rec.current.stop();
      }
      teardown();
    },
    [teardown],
  );

  const stop = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (starting.current || rec.current) return;
    if (!recordingSupported()) {
      onError("unsupported");
      return;
    }
    starting.current = true;
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      onError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed");
      return;
    } finally {
      starting.current = false;
    }
    if (!alive.current) {
      s.getTracks().forEach((track) => track.stop());
      return;
    }
    stream.current = s;

    let r: MediaRecorder;
    try {
      r = new MediaRecorder(s);
    } catch {
      teardown();
      onError("unsupported");
      return;
    }
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    r.onstop = () => {
      teardown();
      rec.current = null;
      setRecording(false);
      onRecorded(new Blob(chunks, { type: r.mimeType }));
    };
    rec.current = r;

    // Live level meter from an analyser on the same stream.
    try {
      const ac = new AudioContext();
      ctx.current = ac;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      ac.createMediaStreamSource(s).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const draw = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9);
        const v = Math.max(0, Math.min(1, (db + 60) / 50));
        if (level.current) level.current.style.transform = `scaleX(${v.toFixed(3)})`;
        raf.current = requestAnimationFrame(draw);
      };
      draw();
    } catch {
      // meter is optional
    }

    r.start();
    setElapsed(0);
    setRecording(true);
    const began = Date.now();
    tick.current = setInterval(() => {
      const sec = Math.floor((Date.now() - began) / 1000);
      setElapsed(Math.min(sec, MAX_SECONDS));
      if (sec >= MAX_SECONDS) stop();
    }, 250);
  }, [onError, onRecorded, stop, teardown]);

  if (!supported) {
    return (
      <div lang={lang} className="flex flex-col items-center gap-3 py-6 text-center">
        <MicrophoneSlash aria-hidden size={48} className="text-accent" />
        <p className="text-lg font-medium">{t.recUnsupported}</p>
        <p className="text-base text-ink-soft">{t.recUnsupportedHelp}</p>
      </div>
    );
  }

  const left = MAX_SECONDS - elapsed;

  return (
    <div lang={lang} className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled && !recording}
        aria-pressed={recording}
        aria-label={recording ? t.recStopAria : t.recStartAria}
        className={`group relative flex size-44 flex-col items-center justify-center rounded-full text-paper shadow-[0_6px_0_0_var(--ink)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_var(--ink)] disabled:opacity-50 sm:size-48 ${
          recording ? "bg-ink" : "bg-accent"
        }`}
      >
        {recording && (
          <span aria-hidden className="absolute -inset-2 rounded-full border-4 border-accent motion-safe:animate-pulse" />
        )}
        {recording ? <Stop aria-hidden size={56} weight="fill" /> : <Microphone aria-hidden size={60} weight="fill" />}
        <span className="mt-2 text-2xl font-semibold">{recording ? t.recStop : t.recSpeak}</span>
        <span className="text-sm opacity-90">{recording ? t.recTapStop : t.recTapSpeak}</span>
      </button>

      <div className="h-16 w-full max-w-xs text-center">
        {recording ? (
          <>
            <p className="num text-3xl" aria-live="off">
              0:{String(elapsed).padStart(2, "0")}
              <span className="text-base text-ink-soft"> / 0:{MAX_SECONDS}</span>
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden bg-paper-deep" role="presentation">
              <div ref={level} className="h-full w-full origin-left bg-ink" style={{ transform: "scaleX(0)" }} />
            </div>
            <p className="sr-only" aria-live="polite">
              {left <= 5 ? t.recSecondsLeft(left) : ""}
            </p>
          </>
        ) : (
          <p className="text-lg">
            {t.recPrompt}
            <span className="block text-sm text-ink-soft">{t.recLimit(MAX_SECONDS)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
