// Shared plumbing for Gnani's Vachana APIs (Prisma STT and Timbre TTS). The
// account may allow only one active request, so calls from this process are
// queued one at a time and an upstream 429 is retried a few times.
import { sleep } from "./http";

export class UpstreamError extends Error {
  constructor(
    public kind: "busy" | "credit" | "timeout" | "failed" | "config",
    public status?: number,
  ) {
    super(kind);
  }
}

let queue: Promise<unknown> = Promise.resolve();

function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

const RETRIES = 3;
const RETRY_MS = 700;

export function apiKey(): string {
  const key = process.env.GNANI_API_KEY;
  if (!key) throw new UpstreamError("config");
  return key;
}

/** fetch with timeout, queueing and 429 retry. Throws UpstreamError on failure. */
export async function vachanaFetch(
  label: string,
  url: string,
  init: () => RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return oneAtATime(async () => {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const t0 = Date.now();
      let res: Response;
      try {
        res = await fetch(url, { ...init(), signal: controller.signal });
      } catch (err) {
        const timedOut = err instanceof Error && err.name === "AbortError";
        console.error(`pakka ${label}: ${timedOut ? "timed out" : "request failed"} after ${Date.now() - t0} ms`);
        throw new UpstreamError(timedOut ? "timeout" : "failed");
      } finally {
        clearTimeout(timer);
      }
      console.log(`pakka ${label}: status ${res.status} in ${Date.now() - t0} ms`);
      if (res.status === 429 && attempt < RETRIES) {
        await res.body?.cancel();
        await sleep(RETRY_MS);
        continue;
      }
      if (res.status === 429) throw new UpstreamError("busy", 429);
      if (res.status === 402) throw new UpstreamError("credit", 402);
      if (!res.ok) {
        await res.body?.cancel();
        throw new UpstreamError("failed", res.status);
      }
      return res;
    }
  });
}

export function upstreamMessage(err: unknown): { status: number; error: string } {
  if (err instanceof UpstreamError) {
    switch (err.kind) {
      case "busy":
        return { status: 429, error: "Busy, try again in a few seconds. थोड़ी देर में फिर कोशिश करें।" };
      case "credit":
        return { status: 503, error: "Voice credits are used up for now. Please try later." };
      case "timeout":
        return { status: 504, error: "That took too long. Please try again." };
      case "config":
        return { status: 500, error: "Voice is not set up on this server." };
    }
  }
  return { status: 502, error: "Voice service failed. Please try again." };
}
