export type LimitResult = "ok" | "key" | "global";

export interface LimiterOptions {
  perKey: number;
  windowMs: number;
  globalMax: number;
  /** Window for the global cap. Defaults to windowMs. */
  globalWindowMs?: number;
  now?: () => number;
}

interface Window {
  start: number;
  count: number;
}

export function createLimiter(opts: LimiterOptions) {
  const now = opts.now ?? Date.now;
  const globalWindowMs = opts.globalWindowMs ?? opts.windowMs;
  const keys = new Map<string, Window>();
  const global: Window = { start: now(), count: 0 };
  let lastPrune = now();

  function prune(t: number) {
    if (t - lastPrune < opts.windowMs) return;
    lastPrune = t;
    for (const [k, w] of keys) {
      if (t - w.start >= opts.windowMs) keys.delete(k);
    }
  }

  return {
    check(key: string): LimitResult {
      const t = now();
      prune(t);
      if (t - global.start >= globalWindowMs) {
        global.start = t;
        global.count = 0;
      }
      let w = keys.get(key);
      if (!w || t - w.start >= opts.windowMs) {
        w = { start: t, count: 0 };
        keys.set(key, w);
      }
      if (w.count >= opts.perKey) return "key";
      if (global.count >= opts.globalMax) return "global";
      w.count++;
      global.count++;
      return "ok";
    },
    /** Number of tracked keys, for tests. */
    size(): number {
      return keys.size;
    },
  };
}
