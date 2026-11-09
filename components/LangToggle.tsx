"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n/useLang";

const OPTIONS = [
  ["hi", "हिन्दी"],
  ["en", "English"],
] as const;

export default function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <div role="group" aria-label={t.langLabel} className={`inline-flex border border-ink ${className}`}>
      {OPTIONS.map(([code, label], i) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={`min-h-11 min-w-20 px-3 text-base ${i > 0 ? "border-l border-ink" : ""} ${
            lang === code ? "bg-ink text-paper" : "text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Keeps <html lang> in step with the chosen language. */
export function LangSync() {
  const { lang } = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
