"use client";

import { useEffect, useRef, useState } from "react";
import { CircleNotch, SpeakerHigh, Stop } from "@phosphor-icons/react";
import { ApiError, speak } from "@/lib/khata/client/api";
import { localize } from "@/lib/i18n/localize";
import { useLang } from "@/lib/i18n/useLang";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "playing" } | { kind: "error"; message: string };

export default function SpeakButton({
  target,
  label,
  onUnauthorized,
}: {
  target: { entryId: number } | { customerId: number };
  label: string;
  onUnauthorized?: () => void;
}) {
  const { lang, t } = useLang();
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
        setState({ kind: "error", message: t.playFail });
      };
      await el.play();
      setState({ kind: "playing" });
    } catch (err) {
      release();
      if (err instanceof ApiError && err.status === 401) onUnauthorized?.();
      setState({ kind: "error", message: err instanceof ApiError ? err.message : t.playFailVolume });
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
        <span lang={lang} className="font-medium">
          {state.kind === "loading" ? t.speakLoading : state.kind === "playing" ? t.speakStop : label}
        </span>
      </button>
      <p lang={lang} role="status" aria-live="polite" className="mt-2 text-base text-accent empty:hidden">
        {state.kind === "error" ? localize(state.message, lang) : ""}
      </p>
    </div>
  );
}
