export function fail(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

export const MSG = {
  signIn: "Please sign in again. दोबारा लॉगिन करें।",
  badRequest: "Something in the request was wrong. Please try again.",
  busy: "Busy, try again in a few seconds. थोड़ी देर में फिर कोशिश करें।",
  server: "Something went wrong on our side. Please try again.",
  notFound: "Not found. यह नहीं मिला।",
};

/** Reads the body up to maxBytes; returns "too-big" past the limit. */
export async function readBody(req: Request, maxBytes: number): Promise<Uint8Array | "too-big"> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return "too-big";
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return "too-big";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** Parses a small JSON object body; null when missing, too big or not an object. */
export async function readJson(req: Request, maxBytes = 32 * 1024): Promise<Record<string, unknown> | null> {
  const body = await readBody(req, maxBytes);
  if (body === "too-big") return null;
  try {
    const v: unknown = JSON.parse(new TextDecoder().decode(body));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
