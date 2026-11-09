import type { Lang } from "./dict";

const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * Pick one language out of a message that carries both.
 * Client messages look like "हिंदी · English". Server messages look like
 * "English sentence. हिंदी वाक्य।". English-only messages come back unchanged.
 */
export function localize(message: string, lang: Lang): string {
  if (!DEVANAGARI.test(message)) return message;
  const dot = message.split(" · ");
  if (dot.length === 2) return lang === "hi" ? dot[0] : dot[1];
  const m = /^([\s\S]*?[.!?])\s+([\s\S]*[ऀ-ॿ][\s\S]*)$/.exec(message);
  if (m) return lang === "hi" ? m[2] : m[1];
  return message;
}
