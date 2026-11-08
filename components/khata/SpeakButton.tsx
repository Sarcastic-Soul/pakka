"use client";

import { useEffect, useRef, useState } from "react";
import { CircleNotch, SpeakerHigh, Stop } from "@phosphor-icons/react";
import { ApiError, speak } from "@/lib/khata/client/api";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "playing" } | { kind: "error"; message: string };

export default function SpeakButton({
  target,
  hi,
  en,
  onUnauthorized,
}: {
  target: { entryId: number } | { customerId: number };
  hi: string;
  en: string;
  onUnauthorized?: () => void;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);

  const release = () => {
    audio.current?.pause();
    audio.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  };

  useEffect(() => release, []);

  const onClick = async () => {
    if (state.kind === "playing") {
      release();
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const blob = await speak(target);
      release();
      url.current = URL.createObjectURL(blob);
      const el = new Audio(url.current);
      audio.current = el;
      el.onended = () => {
        release();
        setState({ kind: "idle" });
      };
      el.onerror = () => {
        release();
        setState({ kind: "error", message: "आवाज़ चल नहीं पाई · Could not play the audio." });
      };
      await el.play();
      setState({ kind: "playing" });
    } catch (err) {
      release();
      if (err instanceof ApiError && err.status === 401) onUnauthorized?.();
      const message =
        err instanceof ApiError
          ? err.message
          : "आवाज़ चल नहीं पाई। फ़ोन की आवाज़ चालू है? · Could not play the audio.";
      setState({ kind: "error", message });
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={state.kind === "loading"}
        aria-busy={state.kind === "loading"}
        className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-sm border-2 border-ink px-5 py-2 text-left disabled:opacity-60 sm:w-auto"
      >
        {state.kind === "loading" ? (
          <CircleNotch aria-hidden size={26} className="animate-spin" />
        ) : state.kind === "playing" ? (
          <Stop aria-hidden size={26} weight="fill" />
        ) : (
          <SpeakerHigh aria-hidden size={26} weight="fill" />
        )}
        <span>
          <span lang="hi" className="block font-medium">
            {state.kind === "loading" ? "आवाज़ बन रही है…" : state.kind === "playing" ? "रोकिए" : hi}
          </span>
          <span className="block text-sm text-ink-soft">
            {state.kind === "loading" ? "Preparing audio" : state.kind === "playing" ? "Stop" : en}
          </span>
        </span>
      </button>
      <p role="status" aria-live="polite" className="mt-2 text-base text-accent empty:hidden">
        {state.kind === "error" ? state.message : ""}
      </p>
    </div>
  );
}
