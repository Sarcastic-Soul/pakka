import { createLimiter } from "@/lib/live/limits";
import { parseWavHeader } from "@/lib/live/wav";

// Node.js is the default runtime; with cacheComponents on, `runtime` and
// `dynamic` exports are not allowed, and POST handlers are always dynamic.

const MAX_BYTES = 1024 * 1024;
const MAX_SEC = 15;
const MIN_SEC = 0.3;
const UPSTREAM = "https://api.vachana.ai/stt/v3";
const TIMEOUT_MS = 20_000;

const perKeyLimiter = createLimiter({
  perKey: 10,
  windowMs: 10 * 60 * 1000,
  globalMax: 300,
  globalWindowMs: 24 * 60 * 60 * 1000,
});

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

function clientKey(req: Request): string {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || "unknown";
}

async function readBody(req: Request): Promise<Uint8Array | "too-big"> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return "too-big";
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return "too-big";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

export async function POST(req: Request) {
  if (process.env.LIVE_ENABLED !== "1") {
    return fail(403, "Live testing is switched off. The stored results below still work.");
  }

  const body = await readBody(req);
  if (body === "too-big") return fail(413, "That clip is too large. Keep it under 1 MB.");

  const info = parseWavHeader(body);
  if (!info || info.bitsPerSample !== 16) {
    return fail(415, "Send a 16-bit PCM WAV file.");
  }
  if (info.durationSec > MAX_SEC) return fail(413, "That clip is too long. Keep it under 15 seconds.");
  if (info.durationSec < MIN_SEC) return fail(400, "That clip is too short to transcribe.");

  const limit = perKeyLimiter.check(clientKey(req));
  if (limit === "key") {
    return fail(429, "You have tried a lot of clips. Please wait a few minutes and try again.");
  }
  if (limit === "global") {
    return fail(429, "Live testing has hit its daily limit. Please come back tomorrow.");
  }

  const apiKey = process.env.GNANI_API_KEY;
  if (!apiKey) return fail(500, "Live testing is not set up on this server.");

  const form = new FormData();
  form.append("audio_file", new Blob([body as BlobPart], { type: "audio/wav" }), "clip.wav");
  form.append("model", "prisma-v3.0");
  form.append("language_code", "hi-IN");
  form.append("format", "transcribe");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "X-API-Key-ID": apiKey },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    console.error(`transcribe: upstream ${timedOut ? "timed out" : "request failed"}`);
    return fail(502, timedOut ? "Transcription took too long. Try again." : "Transcription failed. Try again.");
  } finally {
    clearTimeout(timer);
  }

  if (upstream.status === 429) return fail(429, "Busy, try again in a few seconds");
  if (upstream.status === 402) return fail(503, "Live credits are used up for now");
  if (!upstream.ok) {
    console.error(`transcribe: upstream status ${upstream.status}`);
    return fail(502, "Transcription failed. Try again.");
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    console.error("transcribe: upstream body was not JSON");
    return fail(502, "Transcription failed. Try again.");
  }
  const rec = (data ?? {}) as Record<string, unknown>;
  if (rec.success === false || typeof rec.transcript !== "string") {
    console.error("transcribe: upstream response had no transcript");
    return fail(502, "Transcription failed. Try again.");
  }

  return Response.json({
    transcript: rec.transcript,
    model: typeof rec.model === "string" ? rec.model : "prisma-v3.0",
    latency: typeof rec.end_to_end_latency === "number" ? rec.end_to_end_latency : null,
  });
}
