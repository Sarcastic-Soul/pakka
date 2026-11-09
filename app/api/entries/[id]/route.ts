import { unstable_rethrow } from "next/navigation";
import { currentShop } from "@/lib/khata/server/auth";
import { fail, MSG } from "@/lib/khata/server/http";
import { deleteEntry, getCustomer } from "@/lib/khata/server/ledger";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const shop = await currentShop();
    if (!shop) return fail(401, MSG.signIn);
    const entryId = /^[0-9]{1,9}$/.test(id) ? Number(id) : null;
    // Scoped to this shop, so another shop's entry ids are simply not found.
    const customerId = entryId === null ? null : await deleteEntry(shop.id, entryId);
    if (customerId === null) return fail(404, MSG.notFound);
    return Response.json({ customer: await getCustomer(shop.id, customerId) });
  } catch (err) {
    unstable_rethrow(err);
    console.error("pakka delete entry: failed");
    return fail(500, MSG.server);
  }
}
