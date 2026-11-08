import { unstable_rethrow } from "next/navigation";
import { currentShop } from "@/lib/khata/server/auth";
import { fail, MSG } from "@/lib/khata/server/http";
import { getCustomer, listEntries } from "@/lib/khata/server/ledger";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const shop = await currentShop();
    if (!shop) return fail(401, MSG.signIn);
    const customerId = /^[0-9]{1,9}$/.test(id) ? Number(id) : null;
    const customer = customerId === null ? null : await getCustomer(shop.id, customerId);
    if (!customer) return fail(404, MSG.notFound);
    return Response.json({ customer, entries: await listEntries(shop.id, customer.id) });
  } catch (err) {
    unstable_rethrow(err);
    console.error("pakka customer: failed");
    return fail(500, MSG.server);
  }
}
