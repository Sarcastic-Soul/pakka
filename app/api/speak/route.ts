import { currentShop } from "@/lib/khata/server/auth";
import { fail, MSG, readJson } from "@/lib/khata/server/http";
import { getCustomer, getEntry } from "@/lib/khata/server/ledger";
import { DAILY, speakLimiter } from "@/lib/khata/server/limits";
import { takeDaily } from "@/lib/khata/server/db";
import { balanceText, entryText, speak } from "@/lib/khata/server/timbre";
import { upstreamMessage } from "@/lib/khata/server/vachana";

const isId = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && v < 2 ** 31;

export async function POST(req: Request) {
  if (process.env.LIVE_ENABLED !== "1") {
    return fail(403, "Voice is switched off right now. आवाज़ अभी बंद है।");
  }
  let text: string;
  try {
    const shop = await currentShop();
    if (!shop) return fail(401, MSG.signIn);
    const body = await readJson(req);
    if (!body || (!isId(body.entryId) && !isId(body.customerId))) return fail(400, MSG.badRequest);

    // Text is built only from stored rows of this shop, never from client text.
    if (isId(body.entryId)) {
      const entry = await getEntry(shop.id, body.entryId);
      if (!entry) return fail(404, MSG.notFound);
      const customer = await getCustomer(shop.id, entry.customerId);
      if (!customer) return fail(404, MSG.notFound);
      text = entryText(customer.name, entry.kind, entry.total, customer.balance);
    } else {
      const customer = await getCustomer(shop.id, body.customerId as number);
      if (!customer) return fail(404, MSG.notFound);
      text = balanceText(customer.name, customer.balance);
    }
    if (speakLimiter.check(String(shop.id)) !== "ok") {
      return fail(429, "Too many voice replies this hour. Please wait a little.");
    }
    if (!(await takeDaily("speak", DAILY.speak))) {
      return fail(429, "Voice read-back has hit its daily limit. Please come back tomorrow.");
    }
  } catch {
    console.error("pakka speak: lookup failed");
    return fail(500, MSG.server);
  }

  try {
    const audio = await speak(text);
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    const { status, error } = upstreamMessage(err);
    console.error(`pakka speak: failed with ${status}`);
    return fail(status, error);
  }
}
