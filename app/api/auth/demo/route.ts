import { clientIp, setSession } from "@/lib/khata/server/auth";
import { takeDaily } from "@/lib/khata/server/db";
import { fail, MSG } from "@/lib/khata/server/http";
import { DAILY, demoLimiter } from "@/lib/khata/server/limits";
import { createDemoShop, deleteOldDemoShops } from "@/lib/khata/server/shops";

export async function POST(req: Request) {
  if (demoLimiter.check(clientIp(req)) !== "ok") {
    return fail(429, "Too many demo shops from here. Please try again in an hour.");
  }
  try {
    if (!(await takeDaily("demo", DAILY.demo))) {
      return fail(429, "The demo has hit its daily limit. Please come back tomorrow.");
    }
    await deleteOldDemoShops();
    const shop = await createDemoShop();
    await setSession(shop.id);
    return Response.json({ shop });
  } catch {
    console.error("pakka demo: failed");
    return fail(500, MSG.server);
  }
}
