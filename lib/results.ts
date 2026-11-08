import type { ResultRow, ResultsFile } from "./types";

type Obj = Record<string, unknown>;

function fail(path: string, expected: string): never {
  throw new Error(`${path} is not ${expected}`);
}

function obj(x: unknown, path: string): Obj {
  if (typeof x !== "object" || x === null || Array.isArray(x)) {
    fail(path, "an object");
  }
  return x as Obj;
}

function arr(x: unknown, path: string): unknown[] {
  if (!Array.isArray(x)) fail(path, "an array");
  return x as unknown[];
}

function str(o: Obj, field: string, path: string): void {
  if (typeof o[field] !== "string") fail(`${path}.${field}`, "a string");
}

function num(o: Obj, field: string, path: string): void {
  const v = o[field];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    fail(`${path}.${field}`, "a finite number");
  }
}

function bool(o: Obj, field: string, path: string): void {
  if (typeof o[field] !== "boolean") fail(`${path}.${field}`, "a boolean");
}

function each(
  root: Obj,
  field: string,
  check: (item: Obj, path: string) => void,
): void {
  arr(root[field], field).forEach((item, i) => {
    const path = `${field}[${i}]`;
    check(obj(item, path), path);
  });
}

function checkCondition(c: Obj, path: string): void {
  str(c, "id", path);
  if (c.kind === "clean") return;
  if (c.kind === "noise") {
    str(c, "noise", path);
    num(c, "snr_db", path);
  } else if (c.kind === "codec") {
    str(c, "codec", path);
  } else {
    fail(`${path}.kind`, 'one of "clean", "noise", "codec"');
  }
}

function checkClip(c: Obj, path: string): void {
  str(c, "id", path);
  str(c, "category", path);
  str(c, "text", path);
  if (c.audio_base !== null && typeof c.audio_base !== "string") {
    fail(`${path}.audio_base`, "a string or null");
  }
  bool(c, "has_entity", path);
}

function checkRow(r: Obj, path: string): void {
  str(r, "clip", path);
  str(r, "condition", path);
  str(r, "model", path);
  str(r, "transcript", path);
  bool(r, "entity_ok", path);
  num(r, "wer", path);
  num(r, "cer", path);
  num(r, "delta_wer", path);
}

function checkAggregate(a: Obj, path: string): void {
  str(a, "model", path);
  str(a, "condition", path);
  num(a, "entity_accuracy", path);
  num(a, "wer", path);
  num(a, "delta_wer", path);
  num(a, "n", path);
}

function checkBreakpoint(b: Obj, path: string): void {
  str(b, "model", path);
  str(b, "noise", path);
  const v = b.snr_db;
  if (v !== null && (typeof v !== "number" || !Number.isFinite(v))) {
    fail(`${path}.snr_db`, "a finite number or null");
  }
}

export function assertResultsFile(x: unknown): ResultsFile {
  if (typeof x !== "object" || x === null || Array.isArray(x)) {
    throw new Error("results file is not an object");
  }
  const root = x as Obj;
  str(root, "generated_at", "results file");
  const models = arr(root.models, "models");
  models.forEach((m, i) => {
    if (typeof m !== "string") fail(`models[${i}]`, "a string");
  });
  each(root, "conditions", checkCondition);
  each(root, "clips", checkClip);
  each(root, "results", checkRow);
  each(root, "aggregates", checkAggregate);
  each(root, "breakpoints", checkBreakpoint);
  return x as ResultsFile;
}

export function findResult(
  data: ResultsFile,
  clip: string,
  condition: string,
  model: string,
): ResultRow | undefined {
  return data.results.find(
    (r) => r.clip === clip && r.condition === condition && r.model === model,
  );
}

export function curve(
  data: ResultsFile,
  model: string,
  noise: string,
): { snr: number; entityAccuracy: number; deltaWer: number }[] {
  const points: { snr: number; entityAccuracy: number; deltaWer: number }[] = [];
  for (const c of data.conditions) {
    if (c.kind !== "noise" || c.noise !== noise) continue;
    const agg = data.aggregates.find(
      (a) => a.model === model && a.condition === c.id,
    );
    if (!agg) continue;
    points.push({
      snr: c.snr_db,
      entityAccuracy: agg.entity_accuracy,
      deltaWer: agg.delta_wer,
    });
  }
  return points.sort((a, b) => a.snr - b.snr);
}

export function cleanStat(
  data: ResultsFile,
  model: string,
): { entityAccuracy: number; wer: number } | undefined {
  const clean = data.conditions.find((c) => c.kind === "clean");
  if (!clean) return undefined;
  const agg = data.aggregates.find(
    (a) => a.model === model && a.condition === clean.id,
  );
  return agg && { entityAccuracy: agg.entity_accuracy, wer: agg.wer };
}
