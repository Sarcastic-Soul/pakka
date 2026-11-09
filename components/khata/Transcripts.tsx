"use client";

import { highlightNumbers, type Segment } from "@/lib/khata/client/format";
import { useLang } from "@/lib/i18n/useLang";

function Line({ segments, differs }: { segments: Segment[]; differs: string }) {
  return (
    <p lang="hi" className="text-lg leading-relaxed">
      {segments.map((s, i) =>
        s.kind === "text" ? (
          <span key={i}>{s.text}</span>
        ) : s.differs ? (
          <mark
            key={i}
            className="num bg-transparent font-medium text-accent underline decoration-2 underline-offset-4"
          >
            {s.text}
            <span className="sr-only">{differs}</span>
          </mark>
        ) : (
          <span key={i} className="num font-medium underline decoration-rule decoration-2 underline-offset-4">
            {s.text}
          </span>
        ),
      )}
    </p>
  );
}

/** The raw and cleaned transcripts, numbers underlined, numbers that differ in red. */
export default function Transcripts({ raw, clean }: { raw: string; clean: string | null }) {
  const { lang, t } = useLang();
  const compare = clean !== null;
  const empty = (text: string) => (
    <p lang={lang} className="italic text-ink-soft">
      {text}
    </p>
  );
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <h3 lang={lang} className="text-base font-medium">
          {t.heard}
        </h3>
        <div className="mt-1">
          {raw.trim() ? (
            <Line segments={highlightNumbers(raw, compare ? clean : null)} differs={t.differsSr} />
          ) : (
            empty(t.nothingHeard)
          )}
        </div>
      </div>
      <div>
        <h3 lang={lang} className="text-base font-medium">
          {t.cleaned}
        </h3>
        <div className="mt-1">
          {clean === null ? (
            empty(t.stepSkipped)
          ) : clean.trim() ? (
            <Line segments={highlightNumbers(clean, raw)} differs={t.differsSr} />
          ) : (
            empty(t.nothingHeard)
          )}
        </div>
      </div>
    </div>
  );
}
