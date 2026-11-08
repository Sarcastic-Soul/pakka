import { unstable_rethrow } from "next/navigation";
import { currentShop } from "@/lib/khata/server/auth";
import { fail, MSG } from "@/lib/khata/server/http";
import { listCustomers } from "@/lib/khata/server/ledger";

export async function GET() {
  try {
    const shop = await currentShop();
    if (!shop) return fail(401, MSG.signIn);
    return Response.json({ customers: await listCustomers(shop.id) });
  } catch (err) {
    unstable_rethrow(err);
    console.error("pakka customers: failed");
    return fail(500, MSG.server);
  }
}
