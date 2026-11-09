import type { ParseResult } from "@/lib/khata/types";
import { currentShop } from "@/lib/khata/server/auth";
import { runChecks } from "@/lib/khata/server/checks";
import { takeDaily } from "@/lib/khata/server/db";
import { denoise } from "@/lib/khata/server/denoise";
import { extractEntry, GeminiBusy } from "@/lib/khata/server/gemini";
import { fail, MSG, readBody } from "@/lib/khata/server/http";
import { customerNames } from "@/lib/khata/server/ledger";
import { DAILY, parseLimiter } from "@/lib/khata/server/limits";
import { transcribe } from "@/lib/khata/server/prisma";
import { estimateSnrDb } from "@/lib/khata/server/snr";
import { upstreamMessage } from "@/lib/khata/server/vachana";
import { parseWavHeader } from "@/lib/live/wav";

// Denoise + two Prisma calls + Gemini can take a while.
export const maxDuration = 30;

const MAX_BYTES = 1024 * 1024;
const MAX_SEC = 15;
const MIN_SEC = 0.3;

export async function POST(req: Request) {
  if (process.env.LIVE_ENABLED !== "1") {
    return fail(403, "Voice entry is switched off right now. आवाज़ से एंट्री अभी बंद है।");
  }
  const t0 = Date.now();
  let shop;
  try {
    shop = await currentShop();
  } catch {
    console.error("pakka parse: session lookup failed");
    return fail(500, MSG.server);
  }
  if (!shop) return fail(401, MSG.signIn);

  const body = await readBody(req, MAX_BYTES);
  if (body === "too-big") return fail(413, "That recording is too large. Keep it under 1 MB.");
  const info = parseWavHeader(body);
  if (!info || info.bitsPerSample !== 16) return fail(415, "Send a 16-bit PCM WAV recording.");
  if (info.durationSec > MAX_SEC) return fail(413, "That recording is too long. Keep it under 15 seconds.");
  if (info.durationSec < MIN_SEC) return fail(400, "That recording is too short. Please speak again.");

  if (parseLimiter.check(String(shop.id)) !== "ok") {
    return fail(429, "Too many recordings this hour. Please wait a little. थोड़ी देर बाद कोशिश करें।");
  }

  try {
    if (!(await takeDaily("parse", DAILY.parse))) {
      return fail(429, "Voice entry has hit its daily limit. Please type the entry or come back tomorrow.");
    }
    const customers = await customerNames(shop.id);
    const names = customers.map((c) => c.name);

    const cleaned = await denoise(body);
    const transcriptRaw = await transcribe(body, "raw", names);
    let transcriptClean: string | null = null;
    if (cleaned) {
      // A failed second call should not lose the first transcript.
      transcriptClean = await transcribe(cleaned, "clean", names).catch(() => null);
    }

    const parsed = await extractEntry(transcriptRaw, transcriptClean, names);
    const checks = runChecks(transcriptRaw, transcriptClean, parsed, customers);
    const flags = transcriptClean === null ? [...checks.flags, "denoise_unavailable" as const] : checks.flags;

    const result: ParseResult = {
      transcriptRaw,
      transcriptClean,
      customer: checks.customer,
      customerId: checks.customerId,
      kind: parsed.kind,
      items: parsed.items,
      total: parsed.total,
      flags,
      noise: { snrDb: estimateSnrDb(body) },
    };
    console.log(`pakka parse: ok in ${Date.now() - t0} ms`);
    return Response.json(result);
  } catch (err) {
    if (err instanceof GeminiBusy) return fail(429, MSG.busy);
    const { status, error } = upstreamMessage(err);
    console.error(`pakka parse: failed with ${status} after ${Date.now() - t0} ms`);
    return fail(status, error);
  }
}
