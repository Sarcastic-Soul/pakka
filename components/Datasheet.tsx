import type { Condition, ResultsFile } from "@/lib/types";

const DASH = "\u2014";

export function pct(x: number | undefined): string {
  return x !== undefined && Number.isFinite(x) ? `${Math.round(x * 100)}%` : DASH;
}

export function dec(x: number | undefined, digits = 2): string {
  return x !== undefined && Number.isFinite(x) ? x.toFixed(digits) : DASH;
}

export function db(x: number | null | undefined): string {
  if (x === undefined) return DASH;
  if (x === null) return "not reached";
  return Number.isFinite(x) ? `${Math.round(x * 10) / 10} dB` : DASH;
}

export function conditionLabel(c: Condition): string {
  if (c.kind === "clean") return "clean";
  if (c.kind === "noise") return `${c.noise} noise, ${c.snr_db} dB`;
  return `${c.codec.replace("_", "-").toUpperCase()} codec`;
}

export default function Datasheet({
  data,
  model,
}: {
  data: ResultsFile;
  model: string;
}) {
  const rows = data.conditions
    .map((c) => ({
      c,
      agg: data.aggregates.find((a) => a.model === model && a.condition === c.id),
    }))
    .filter((r) => r.agg);
  const breaks = data.breakpoints.filter((b) => b.model === model);

  const th = "border-b border-ink py-2 pr-4 text-left text-sm font-medium";
  const td = "border-b border-rule py-2 pr-4";

  return (
    <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse text-sm sm:text-base">
          <caption className="pb-3 text-left text-sm text-ink-soft">
            Every condition, {model}. Entity accuracy is the share of clips
            where the amount, number or name came out right.
          </caption>
          <thead>
            <tr>
              <th scope="col" className={th}>Condition</th>
              <th scope="col" className={`${th} text-right`}>Clips</th>
              <th scope="col" className={`${th} text-right`}>Entity accuracy</th>
              <th scope="col" className={`${th} text-right`}>WER</th>
              <th scope="col" className={`${th} text-right`}>WER vs clean</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, agg }) => (
              <tr key={c.id}>
                <th scope="row" className={`${td} text-left font-normal`}>
                  {conditionLabel(c)}
                </th>
                <td className={`${td} num text-right`}>{agg?.n ?? DASH}</td>
                <td
                  className={`${td} num text-right ${
                    agg && agg.entity_accuracy < 0.9 ? "text-accent" : ""
                  }`}
                >
                  {pct(agg?.entity_accuracy)}
                  {agg && agg.entity_accuracy < 0.9 && (
                    <span className="sr-only"> (below 90%)</span>
                  )}
                </td>
                <td className={`${td} num text-right`}>{dec(agg?.wer)}</td>
                <td className={`${td} num text-right`}>
                  {agg ? `${agg.delta_wer >= 0 ? "+" : ""}${dec(agg.delta_wer)}` : DASH}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={td}>No results yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div>
        <table className="w-full border-collapse">
          <caption className="pb-3 text-left text-sm text-ink-soft">
            Breakpoint: the noise level where entity accuracy first drops
            below 90%.
          </caption>
          <thead>
            <tr>
              <th scope="col" className={th}>Noise</th>
              <th scope="col" className={`${th} text-right`}>Breakpoint</th>
            </tr>
          </thead>
          <tbody>
            {breaks.map((b) => (
              <tr key={b.noise}>
                <th scope="row" className={`${td} text-left font-normal`}>
                  {b.noise}
                </th>
                <td
                  className={`${td} num text-right ${
                    b.snr_db !== null ? "text-accent" : ""
                  }`}
                >
                  {db(b.snr_db)}
                </td>
              </tr>
            ))}
            {breaks.length === 0 && (
              <tr>
                <td colSpan={2} className={td}>{DASH}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
