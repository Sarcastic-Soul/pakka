"use client";

import { useEffect, useRef, useState } from "react";
import { cleanStat, curve } from "@/lib/results";
import type { ResultsFile } from "@/lib/types";

const DASHES = ["", "7 5", "2 4", "10 3 2 3"];
const TICKS = [0, 5, 10, 20];
const THRESHOLD = 0.9;

export default function Curve({
  data,
  model,
}: {
  data: ResultsFile;
  model: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(300, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = width < 520;
  const height = narrow ? 300 : 360;
  const m = { top: 20, right: narrow ? 64 : 96, bottom: 48, left: 48 };
  const cleanGap = narrow ? 44 : 64;
  const plotRight = width - m.right - cleanGap;
  const x = (snr: number) => m.left + (snr / 20) * (plotRight - m.left);
  const xClean = width - m.right;
  const y = (acc: number) => m.top + (1 - acc) * (height - m.top - m.bottom);

  const noises = Array.from(
    new Set(data.conditions.flatMap((c) => (c.kind === "noise" ? [c.noise] : []))),
  );
  const series = noises
    .map((noise, i) => ({ noise, dash: DASHES[i % DASHES.length], points: curve(data, model, noise) }))
    .filter((s) => s.points.length > 0);
  const clean = cleanStat(data, model);
  const breaks = data.breakpoints.filter(
    (b) => b.model === model && b.snr_db !== null && Number.isFinite(b.snr_db),
  );

  // Direct labels sit right of each line's last point; nudge apart if they collide.
  const labels = series
    .map((s) => {
      const last = s.points[s.points.length - 1];
      return { noise: s.noise, x: x(last.snr) + 8, y: y(last.entityAccuracy) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 15) labels[i].y = labels[i - 1].y + 15;
  }

  const summary = series
    .map(
      (s) =>
        `${s.noise}: ${s.points
          .map((p) => `${Math.round(p.entityAccuracy * 100)}% at ${p.snr} dB`)
          .join(", ")}`,
    )
    .join(". ");

  return (
    <div ref={box} className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-labelledby="curve-title curve-desc"
        className="block overflow-visible text-ink"
      >
        <title id="curve-title">{`Entity accuracy against noise level, ${model}`}</title>
        <desc id="curve-desc">
          {series.length > 0
            ? `${summary}. Clean speech: ${clean ? Math.round(clean.entityAccuracy * 100) + "%" : "not run"}. The exact numbers are in the table below.`
            : "No noise results yet."}
        </desc>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={m.left} x2={xClean} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={t === 0 ? 1 : 0.5} />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-ink-soft" fontSize={11}>
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}

        {TICKS.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={height - m.bottom} y2={height - m.bottom + 5} stroke="var(--ink)" />
            <text x={x(t)} y={height - m.bottom + 18} textAnchor="middle" className="num fill-ink" fontSize={11}>
              {t}
            </text>
          </g>
        ))}
        <line x1={xClean} x2={xClean} y1={height - m.bottom} y2={height - m.bottom + 5} stroke="var(--ink)" />
        <text x={xClean} y={height - m.bottom + 18} textAnchor="middle" className="fill-ink" fontSize={11}>
          clean
        </text>
        <text x={(m.left + plotRight) / 2} y={height - 8} textAnchor="middle" className="fill-ink-soft" fontSize={11}>
          signal-to-noise ratio, dB (louder noise to the left)
        </text>
        <line x1={plotRight + cleanGap / 2} x2={plotRight + cleanGap / 2} y1={m.top} y2={height - m.bottom} stroke="var(--rule)" strokeDasharray="1 3" />

        <line x1={m.left} x2={xClean} y1={y(THRESHOLD)} y2={y(THRESHOLD)} stroke="var(--ink)" strokeWidth={1} strokeDasharray="4 4" />
        <text x={xClean + 6} y={y(THRESHOLD)} dy="0.32em" className="num fill-ink" fontSize={11}>
          90%
        </text>

        {breaks.map((b) => {
          const bx = x(Math.min(20, Math.max(0, b.snr_db as number)));
          return (
            <g key={b.noise}>
              <line x1={bx} x2={bx} y1={m.top} y2={height - m.bottom} stroke="var(--accent)" strokeWidth={1.25} />
              <circle cx={bx} cy={y(THRESHOLD)} r={4.5} fill="var(--paper)" stroke="var(--accent)" strokeWidth={2} />
              <text x={bx - 6} y={height - m.bottom - 8} textAnchor="end" className="num fill-accent" fontSize={11}>
                {`${b.noise} breaks at ${Math.round((b.snr_db as number) * 10) / 10} dB`}
              </text>
            </g>
          );
        })}

        {series.map((s) => (
          <g key={s.noise}>
            <polyline
              points={s.points.map((p) => `${x(p.snr)},${y(p.entityAccuracy)}`).join(" ")}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={1.75}
              strokeDasharray={s.dash || undefined}
              className="transition-all duration-300"
            />
            {s.points.map((p) => (
              <circle key={p.snr} cx={x(p.snr)} cy={y(p.entityAccuracy)} r={3} fill="var(--ink)" />
            ))}
          </g>
        ))}
        {labels.map((l) => (
          <text key={l.noise} x={l.x} y={l.y} dy="0.32em" className="fill-ink" fontSize={12}>
            {l.noise}
          </text>
        ))}

        {clean && (
          <g>
            <rect x={xClean - 4} y={y(clean.entityAccuracy) - 4} width={8} height={8} fill="var(--ink)" />
            <text x={xClean} y={y(clean.entityAccuracy) + 16} textAnchor="middle" className="num fill-ink" fontSize={11}>
              {Math.round(clean.entityAccuracy * 100)}%
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
