"use client";

import { useId, useState } from "react";
import { CheckIcon, XIcon } from "@phosphor-icons/react";
import DiffView from "@/components/DiffView";
import { findResult } from "@/lib/results";
import type { Condition, ResultsFile } from "@/lib/types";

const SNR_STOPS = [10, 5, 0, -5, -10];
const LINE_WIDEBAND = "wideband";

type Stop = { label: string; valueText: string; condition?: Condition };

function codecName(codec: string): string {
  return codec.replace("_", "-").toUpperCase();
}

export default function Meter({ data }: { data: ResultsFile }) {
  const uid = useId();
  const model = data.models[0];
  const featured = data.clips.filter((c) => c.audio_base !== null);
  const clips = featured.length > 0 ? featured : data.clips;

  const noises = Array.from(
    new Set(
      data.conditions.flatMap((c) => (c.kind === "noise" ? [c.noise] : [])),
    ),
  );
  const codecs = data.conditions.filter(
    (c): c is Extract<Condition, { kind: "codec" }> => c.kind === "codec",
  );
  const clean = data.conditions.find((c) => c.kind === "clean");

  const [clipId, setClipId] = useState(clips[0]?.id);
  const [noise, setNoise] = useState(noises[0] ?? "");
  const [stopIndex, setStopIndex] = useState(0);
  const [line, setLine] = useState(LINE_WIDEBAND);

  const clip = clips.find((c) => c.id === clipId) ?? clips[0];
  if (!clip || !model) {
    return <p className="text-ink-soft">No clips in the results file yet.</p>;
  }

  const stops: Stop[] = [
    { label: "clean", valueText: "clean, no added noise", condition: clean },
    ...SNR_STOPS.map((snr) => ({
      label: `${snr} dB`,
      valueText: `${noise} noise, ${snr} dB`,
      condition: data.conditions.find(
        (c) => c.kind === "noise" && c.noise === noise && c.snr_db === snr,
      ),
    })),
  ];
  const stop = stops[stopIndex];
  const codecCondition = codecs.find((c) => c.id === line);
  const condition = codecCondition ?? stop.condition;
  const result = condition
    ? findResult(data, clip.id, condition.id, model)
    : undefined;
  const settingText = codecCondition
    ? `clean speech through the ${codecName(codecCondition.codec)} phone codec`
    : stop.valueText;

  const chip =
    "cursor-pointer border border-rule px-3 py-1.5 text-sm transition-colors has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="min-w-0 space-y-8">
        <fieldset>
          <legend className="mb-3 text-sm text-ink-soft">Clip</legend>
          <div className="border-t border-rule">
            {clips.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-baseline gap-3 border-b border-rule py-2.5 has-[:checked]:font-medium"
              >
                <input
                  type="radio"
                  name={`${uid}-clip`}
                  value={c.id}
                  checked={c.id === clip.id}
                  onChange={() => setClipId(c.id)}
                  className="translate-y-0.5"
                />
                <span className="num w-16 shrink-0 text-xs uppercase text-ink-soft">
                  {c.category}
                </span>
                <span lang="hi" className="truncate">
                  {c.text}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {noises.length > 0 && (
          <fieldset disabled={!!codecCondition}>
            <legend className="mb-3 text-sm text-ink-soft">Noise type</legend>
            <div className="flex flex-wrap gap-2">
              {noises.map((n) => (
                <label key={n} className={chip}>
                  <input
                    type="radio"
                    name={`${uid}-noise`}
                    value={n}
                    checked={n === noise}
                    onChange={() => setNoise(n)}
                    className="sr-only"
                  />
                  {n}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className={codecCondition ? "opacity-40" : ""}>
          <label htmlFor={`${uid}-snr`} className="mb-3 block text-sm text-ink-soft">
            Noise level (signal-to-noise ratio, lower is louder noise)
          </label>
          <input
            id={`${uid}-snr`}
            type="range"
            min={0}
            max={stops.length - 1}
            step={1}
            value={stopIndex}
            disabled={!!codecCondition}
            onChange={(e) => setStopIndex(Number(e.target.value))}
            aria-valuetext={stop.valueText}
            className="w-full cursor-pointer"
          />
          <div className="num mt-1 flex justify-between text-xs text-ink-soft" aria-hidden="true">
            {stops.map((s, i) => (
              <span key={s.label} className={i === stopIndex ? "text-ink" : ""}>
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {codecs.length > 0 && (
          <fieldset>
            <legend className="mb-3 text-sm text-ink-soft">Phone line</legend>
            <div className="flex flex-wrap gap-2">
              {[{ id: LINE_WIDEBAND, label: "no codec" }, ...codecs.map((c) => ({ id: c.id, label: codecName(c.codec) }))].map(
                (o) => (
                  <label key={o.id} className={chip}>
                    <input
                      type="radio"
                      name={`${uid}-line`}
                      value={o.id}
                      checked={o.id === line}
                      onChange={() => setLine(o.id)}
                      className="sr-only"
                    />
                    {o.label}
                  </label>
                ),
              )}
            </div>
          </fieldset>
        )}
      </div>

      <div
        key={`${clip.id}-${condition?.id ?? stop.label}`}
        className="settle border-t-2 border-ink pt-4"
        aria-live="polite"
      >
        <p className="num mb-5 text-xs uppercase tracking-wide text-ink-soft">
          {clip.id} / {settingText}
        </p>

        {clip.audio_base && condition && (
          <audio
            controls
            preload="none"
            src={`${clip.audio_base}/${condition.id}.mp3`}
            className="mb-6 w-full"
          >
            Your browser cannot play this audio.
          </audio>
        )}

        {result ? (
          <>
            <DiffView reference={clip.text} hypothesis={result.transcript} />
            <dl className="mt-6 grid grid-cols-2 border-t border-rule">
              <div className="border-r border-rule py-3 pr-4">
                <dt className="text-sm text-ink-soft">
                  {clip.category === "amount"
                    ? "Amount"
                    : clip.category === "digits"
                      ? "Phone number"
                      : clip.category === "name"
                        ? "Name"
                        : "Key detail"}
                </dt>
                <dd
                  className={`mt-1 flex items-center gap-1.5 text-lg font-medium ${
                    result.entity_ok ? "" : "text-accent"
                  }`}
                >
                  {result.entity_ok ? (
                    <CheckIcon weight="bold" aria-hidden="true" />
                  ) : (
                    <XIcon weight="bold" aria-hidden="true" />
                  )}
                  {result.entity_ok ? "Correct" : "Wrong"}
                </dd>
              </div>
              <div className="py-3 pl-4">
                <dt className="text-sm text-ink-soft">Word error rate</dt>
                <dd className="num mt-1 text-lg">{result.wer.toFixed(2)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="border border-dashed border-rule px-4 py-6 text-ink-soft">
            Not run for this setting.
          </p>
        )}
      </div>
    </div>
  );
}
