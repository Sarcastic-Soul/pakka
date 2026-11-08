import { apiKey, UpstreamError, vachanaFetch } from "./vachana";

const URL_STT = "https://api.vachana.ai/stt/v3";
const TIMEOUT_MS = 20_000;
const MAX_KEYTERMS = 50;

/** Transcribes a WAV with Prisma v3.0. Customer names go in as keyterms. */
export async function transcribe(wav: Uint8Array, label: string, keyterms: string[] = []): Promise<string> {
  const key = apiKey();
  const terms = [...new Set(keyterms.map((t) => t.trim()).filter(Boolean))].slice(0, MAX_KEYTERMS);
  const res = await vachanaFetch(
    `prisma ${label}`,
    URL_STT,
    () => {
      const form = new FormData();
      form.append("audio_file", new Blob([wav as BlobPart], { type: "audio/wav" }), "clip.wav");
      form.append("model", "prisma-v3.0");
      form.append("language_code", "hi-IN");
      form.append("format", "transcribe");
      if (terms.length) form.append("keyterms", JSON.stringify(terms));
      return { method: "POST", headers: { "X-API-Key-ID": key }, body: form };
    },
    TIMEOUT_MS,
  );
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new UpstreamError("failed", res.status);
  }
  const rec = (data ?? {}) as Record<string, unknown>;
  if (rec.success === false || typeof rec.transcript !== "string") throw new UpstreamError("failed", res.status);
  return rec.transcript.trim();
}
