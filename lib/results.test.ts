import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertResultsFile, cleanStat, curve, findResult } from "./results";
import type { ResultsFile } from "./types";

// public/data/results.json is a hand-written 3-clip fixture until the real
// run (Task 8) replaces it. Only contract checks run against that file, so
// the helper tests below use their own inline data and survive the swap.
const resultsUrl = new URL("../public/data/results.json", import.meta.url);

function makeData(): ResultsFile {
  const row = (condition: string, wer: number) => ({
    clip: "amt_01",
    condition,
    model: "prisma-v3.0",
    transcript: "कुल 2,50,000 रुपये चाहिए",
    entity_ok: true,
    wer,
    cer: wer,
    delta_wer: wer,
  });
  const agg = (condition: string, entity_accuracy: number) => ({
    model: "prisma-v3.0",
    condition,
    entity_accuracy,
    wer: 0.1,
    delta_wer: 0.05,
    n: 1,
  });
  return {
    generated_at: "2026-11-09T10:00:00Z",
    models: ["prisma-v3.0"],
    conditions: [
      { id: "street_snr20", kind: "noise", noise: "street", snr_db: 20 },
      { id: "street_snr5", kind: "noise", noise: "street", snr_db: 5 },
      { id: "street_snr10", kind: "noise", noise: "street", snr_db: 10 },
      { id: "street_snr0", kind: "noise", noise: "street", snr_db: 0 },
      { id: "clean", kind: "clean" },
      { id: "g711", kind: "codec", codec: "g711" },
    ],
    clips: [
      {
        id: "amt_01",
        category: "amount",
        text: "कुल 2,50,000 रुपये चाहिए",
        audio_base: "/audio/amt_01",
        has_entity: true,
      },
    ],
    results: [row("clean", 0), row("street_snr20", 0), row("street_snr5", 0.25)],
    aggregates: [
      { ...agg("clean", 1), wer: 0.02, delta_wer: 0 },
      agg("street_snr20", 0.95),
      agg("street_snr5", 0.5),
      agg("g711", 0.9),
    ],
    breakpoints: [
      { model: "prisma-v3.0", noise: "street", snr_db: 8.33 },
      { model: "prisma-v3.0", noise: "fan", snr_db: null },
    ],
  };
}

describe("assertResultsFile", () => {
  it("accepts a valid file and returns it", () => {
    const data = makeData();
    expect(assertResultsFile(data)).toBe(data);
  });

  it("accepts a null audio_base and a null breakpoint", () => {
    const data = makeData();
    data.clips[0].audio_base = null;
    expect(() => assertResultsFile(data)).not.toThrow();
  });

  it("rejects an aggregate with NaN entity_accuracy", () => {
    const data = makeData();
    data.aggregates[0].entity_accuracy = NaN;
    expect(() => assertResultsFile(data)).toThrow(
      "aggregates[0].entity_accuracy is not a finite number",
    );
  });

  it("rejects Infinity in a result row", () => {
    const data = makeData();
    data.results[2].wer = Infinity;
    expect(() => assertResultsFile(data)).toThrow(
      "results[2].wer is not a finite number",
    );
  });

  it("rejects a missing field", () => {
    const data = makeData() as unknown as Record<string, unknown>;
    const rows = data.results as Record<string, unknown>[];
    delete rows[1].delta_wer;
    expect(() => assertResultsFile(data)).toThrow(
      "results[1].delta_wer is not a finite number",
    );
  });

  it("rejects a wrong type", () => {
    const data = makeData() as unknown as Record<string, unknown>;
    const rows = data.results as Record<string, unknown>[];
    rows[0].entity_ok = "yes";
    expect(() => assertResultsFile(data)).toThrow(
      "results[0].entity_ok is not a boolean",
    );
  });

  it("rejects a non-string transcript but accepts an empty one", () => {
    const data = makeData();
    data.results[0].transcript = "";
    expect(() => assertResultsFile(data)).not.toThrow();
    (data.results[0] as unknown as Record<string, unknown>).transcript = null;
    expect(() => assertResultsFile(data)).toThrow(
      "results[0].transcript is not a string",
    );
  });

  it("rejects a non-finite breakpoint snr_db but accepts null", () => {
    const data = makeData();
    expect(data.breakpoints[1].snr_db).toBeNull();
    data.breakpoints[0].snr_db = NaN;
    expect(() => assertResultsFile(data)).toThrow(
      "breakpoints[0].snr_db is not a finite number or null",
    );
  });

  it("rejects a noise condition without snr_db", () => {
    const data = makeData() as unknown as Record<string, unknown>;
    const conds = data.conditions as Record<string, unknown>[];
    delete conds[0].snr_db;
    expect(() => assertResultsFile(data)).toThrow(
      "conditions[0].snr_db is not a finite number",
    );
  });

  it("rejects an unknown condition kind", () => {
    const data = makeData() as unknown as Record<string, unknown>;
    const conds = data.conditions as Record<string, unknown>[];
    conds[4].kind = "mystery";
    expect(() => assertResultsFile(data)).toThrow("conditions[4].kind");
  });

  it("rejects a non-array section and non-object input", () => {
    const data = makeData() as unknown as Record<string, unknown>;
    data.clips = {};
    expect(() => assertResultsFile(data)).toThrow("clips is not an array");
    expect(() => assertResultsFile(null)).toThrow("results file is not an object");
    expect(() => assertResultsFile("x")).toThrow("results file is not an object");
  });
});

describe("findResult", () => {
  it("finds a row by clip, condition and model", () => {
    const row = findResult(makeData(), "amt_01", "street_snr5", "prisma-v3.0");
    expect(row?.wer).toBe(0.25);
  });

  it("returns undefined for a condition that was not run", () => {
    expect(
      findResult(makeData(), "amt_01", "street_snr10", "prisma-v3.0"),
    ).toBeUndefined();
  });

  it("returns undefined for another model", () => {
    expect(
      findResult(makeData(), "amt_01", "clean", "prisma-v2.5"),
    ).toBeUndefined();
  });
});

describe("curve", () => {
  it("skips conditions with no aggregate and sorts by ascending SNR", () => {
    expect(curve(makeData(), "prisma-v3.0", "street")).toEqual([
      { snr: 5, entityAccuracy: 0.5, deltaWer: 0.05 },
      { snr: 20, entityAccuracy: 0.95, deltaWer: 0.05 },
    ]);
  });

  it("returns an empty list for a noise or model that was not run", () => {
    expect(curve(makeData(), "prisma-v3.0", "fan")).toEqual([]);
    expect(curve(makeData(), "prisma-v2.5", "street")).toEqual([]);
  });

  it("ignores clean and codec conditions", () => {
    const points = curve(makeData(), "prisma-v3.0", "g711");
    expect(points).toEqual([]);
  });
});

describe("cleanStat", () => {
  it("returns the clean aggregate", () => {
    expect(cleanStat(makeData(), "prisma-v3.0")).toEqual({
      entityAccuracy: 1,
      wer: 0.02,
    });
  });

  it("returns undefined when clean was not run", () => {
    expect(cleanStat(makeData(), "prisma-v2.5")).toBeUndefined();
  });
});

describe("public/data/results.json", () => {
  const raw: unknown = JSON.parse(readFileSync(resultsUrl, "utf8"));

  it("passes assertResultsFile", () => {
    expect(() => assertResultsFile(raw)).not.toThrow();
  });

  it("is internally consistent", () => {
    const data = assertResultsFile(raw);
    const clips = new Set(data.clips.map((c) => c.id));
    const conditions = new Set(data.conditions.map((c) => c.id));
    const models = new Set(data.models);
    const seen = new Set<string>();
    const hasEntity = new Map(data.clips.map((c) => [c.id, c.has_entity]));
    const stats = new Map<string, { n: number; ok: number; en: number; eok: number }>();

    for (const r of data.results) {
      expect(clips.has(r.clip), `unknown clip ${r.clip}`).toBe(true);
      expect(conditions.has(r.condition), `unknown condition ${r.condition}`).toBe(true);
      expect(models.has(r.model), `unknown model ${r.model}`).toBe(true);
      const cell = `${r.model}|${r.condition}|${r.clip}`;
      expect(seen.has(cell), `duplicate cell ${cell}`).toBe(false);
      seen.add(cell);
      const key = `${r.model}|${r.condition}`;
      const s = stats.get(key) ?? { n: 0, ok: 0, en: 0, eok: 0 };
      s.n += 1;
      if (r.entity_ok) s.ok += 1;
      if (hasEntity.get(r.clip)) {
        s.en += 1;
        if (r.entity_ok) s.eok += 1;
      }
      stats.set(key, s);
    }

    // Accuracy counts only clips with a key word, unless a cell has none.
    for (const a of data.aggregates) {
      const s = stats.get(`${a.model}|${a.condition}`);
      expect(s, `aggregate without rows: ${a.model}|${a.condition}`).toBeDefined();
      expect(a.n).toBe(s!.n);
      const want = s!.en > 0 ? s!.eok / s!.en : s!.ok / s!.n;
      expect(a.entity_accuracy).toBeCloseTo(want, 3);
    }
  });
});
