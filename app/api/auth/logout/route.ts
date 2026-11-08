import { clearSession } from "@/lib/khata/server/auth";

export async function POST() {
  await clearSession();
  return Response.json({ ok: true });
}
