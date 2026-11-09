import { clientIp, isValidPin, normalizeCode, setSession, toShop, verifyPin } from "@/lib/khata/server/auth";
import { clearDaily, peekDaily, takeDaily } from "@/lib/khata/server/db";
import { fail, MSG, readJson } from "@/lib/khata/server/http";
import { LOGIN_FAILS_PER_DAY, loginLimiter } from "@/lib/khata/server/limits";
import { findShopByCode } from "@/lib/khata/server/shops";

const WRONG = "Shop code or PIN is wrong. कोड या PIN गलत है।";
const LOCKED = "Too many wrong PINs for this shop today. Try again tomorrow. आज बहुत बार गलत PIN डला, कल कोशिश करें।";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail(400, MSG.badRequest);
  if (loginLimiter.check(clientIp(req)) !== "ok") {
    return fail(429, "Too many tries. Please wait 10 minutes. 10 मिनट बाद कोशिश करें।");
  }
  const code = typeof body.code === "string" ? normalizeCode(body.code) : "";
  if (!code || code.length > 12 || !isValidPin(body.pin)) return fail(401, WRONG);
  try {
    const failKey = `login-fail:${code}`;
    if ((await peekDaily(failKey)) >= LOGIN_FAILS_PER_DAY) return fail(429, LOCKED);
    const row = await findShopByCode(code);
    // Demo shops have no PIN, so verifyPin is false for them.
    const ok = row && !row.is_demo && (await verifyPin(body.pin, row.pin_hash));
    if (!row || !ok) {
      await takeDaily(failKey, LOGIN_FAILS_PER_DAY);
      return fail(401, WRONG);
    }
    await clearDaily(failKey);
    await setSession(row.id);
    return Response.json({ shop: toShop(row) });
  } catch {
    console.error("pakka login: failed");
    return fail(500, MSG.server);
  }
}
