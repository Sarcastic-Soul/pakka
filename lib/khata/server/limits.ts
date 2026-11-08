import { createLimiter } from "@/lib/live/limits";

// In-memory, per server instance. Daily global caps live in the usage table.
const HOUR = 60 * 60 * 1000;
const BIG = Number.MAX_SAFE_INTEGER;

export const loginLimiter = createLimiter({ perKey: 5, windowMs: 10 * 60 * 1000, globalMax: BIG });
export const registerLimiter = createLimiter({ perKey: 5, windowMs: HOUR, globalMax: BIG });
export const demoLimiter = createLimiter({ perKey: 5, windowMs: HOUR, globalMax: BIG });
export const parseLimiter = createLimiter({ perKey: 30, windowMs: HOUR, globalMax: BIG });
export const speakLimiter = createLimiter({ perKey: 60, windowMs: HOUR, globalMax: BIG });

export const DAILY = { demo: 200, parse: 300 } as const;
