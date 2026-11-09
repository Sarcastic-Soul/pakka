"use client";

import { useSyncExternalStore } from "react";
import { dict, type Dict, type Lang } from "./dict";

const KEY = "pakka-lang";
const listeners = new Set<() => void>();
// Used when localStorage is blocked, so the toggle still works for this visit.
let chosen: Lang | null = null;

function detect(): Lang {
  if (chosen) return chosen;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "hi" || saved === "en") return saved;
  } catch {
    // storage blocked: fall through to the browser language
  }
  return navigator.language?.toLowerCase().startsWith("hi") ? "hi" : "en";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setLang(lang: Lang) {
  chosen = lang;
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    // keep the in-memory choice
  }
  listeners.forEach((l) => l());
}

/** Current UI language and its text. Server render and first paint are English. */
export function useLang(): { lang: Lang; t: Dict; setLang: (l: Lang) => void } {
  const lang = useSyncExternalStore(subscribe, detect, (): Lang => "en");
  return { lang, t: dict[lang], setLang };
}
