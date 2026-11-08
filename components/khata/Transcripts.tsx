import { highlightNumbers, type Segment } from "@/lib/khata/client/format";

function Line({ segments }: { segments: Segment[] }) {
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
            <span className="sr-only"> (दूसरी बार अलग · differs)</span>
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
  const compare = clean !== null;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <h3 className="text-sm text-ink-soft">
          <span lang="hi" className="text-base font-medium text-ink">
            जो सुना
          </span>{" "}
          · Heard (raw)
        </h3>
        <div className="mt-1">
          {raw.trim() ? (
            <Line segments={highlightNumbers(raw, compare ? clean : null)} />
          ) : (
            <p lang="hi" className="italic text-ink-soft">
              कुछ सुनाई नहीं दिया
            </p>
          )}
        </div>
      </div>
      <div>
        <h3 className="text-sm text-ink-soft">
          <span lang="hi" className="text-base font-medium text-ink">
            साफ़ आवाज़ से
          </span>{" "}
          · Cleaned
        </h3>
        <div className="mt-1">
          {clean === null ? (
            <p lang="hi" className="italic text-ink-soft">
              यह कदम नहीं चला
            </p>
          ) : clean.trim() ? (
            <Line segments={highlightNumbers(clean, raw)} />
          ) : (
            <p lang="hi" className="italic text-ink-soft">
              कुछ सुनाई नहीं दिया
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
