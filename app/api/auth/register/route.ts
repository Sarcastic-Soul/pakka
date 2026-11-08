import { clientIp, hashPin, isValidPin, setSession } from "@/lib/khata/server/auth";
import { fail, MSG, readJson } from "@/lib/khata/server/http";
import { registerLimiter } from "@/lib/khata/server/limits";
import { cleanName } from "@/lib/khata/server/names";
import { createShop } from "@/lib/khata/server/shops";

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail(400, MSG.badRequest);
  const name = typeof body.name === "string" ? cleanName(body.name) : "";
  if (!name) return fail(400, "Enter a shop name. दुकान का नाम लिखें।");
  if (!isValidPin(body.pin)) return fail(400, "PIN must be 4 to 6 digits. PIN 4 से 6 अंकों का हो।");
  if (registerLimiter.check(clientIp(req)) !== "ok") {
    return fail(429, "Too many new shops from here. Please try again later.");
  }
  try {
    const shop = await createShop(name, await hashPin(body.pin), false);
    await setSession(shop.id);
    return Response.json({ shop });
  } catch {
    console.error("pakka register: failed");
    return fail(500, MSG.server);
  }
}
