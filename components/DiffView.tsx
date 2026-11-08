import { diffWords } from "@/lib/diff";
import type { Token } from "@/lib/types";

function Words({ tokens, missLabel }: { tokens: Token[]; missLabel: string }) {
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i}>
          {t.hit ? (
            t.text
          ) : (
            <span className="text-accent underline decoration-2 underline-offset-[6px]">
              {t.text}
              <span className="sr-only"> ({missLabel})</span>
            </span>
          )}{" "}
        </span>
      ))}
    </>
  );
}

export default function DiffView({
  reference,
  hypothesis,
}: {
  reference: string;
  hypothesis: string;
}) {
  const diff = diffWords(reference, hypothesis);
  const empty = diff.hypothesis.length === 0;

  return (
    <dl className="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-3 text-lg leading-relaxed sm:grid-cols-[8rem_1fr]">
      <dt className="pt-1 text-sm text-ink-soft">Script</dt>
      <dd lang="hi">
        <Words tokens={diff.reference} missLabel="missed" />
      </dd>
      <dt className="pt-1 text-sm text-ink-soft">Prisma heard</dt>
      <dd lang={empty ? "en" : "hi"}>
        {empty ? (
          <span className="text-accent underline decoration-2 underline-offset-[6px]">
            no speech returned
          </span>
        ) : (
          <Words tokens={diff.hypothesis} missLabel="wrong or extra" />
        )}
      </dd>
    </dl>
  );
}
