import type { Customer, Entry, EntryKind, Flag, Item, ParseResult, Shop } from "@/lib/khata/types";

/** Error carrying the HTTP status and the server's safe-to-show message. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function fallbackMessage(status: number): string {
  if (status === 401) return "फिर से लॉगिन कीजिए · Please log in again.";
  if (status === 403) return "अभी यह सुविधा बंद है · This is switched off right now.";
  if (status === 429) return "अभी बहुत भीड़ है, थोड़ी देर बाद कोशिश कीजिए · Busy, try again shortly.";
  if (status >= 500) return "सर्वर में गड़बड़ हुई, फिर कोशिश कीजिए · Server error, try again.";
  return "कुछ गड़बड़ हुई · Something went wrong.";
}

async function errorFrom(res: Response): Promise<ApiError> {
  let message = "";
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      message = body.error;
    }
  } catch {
    // not JSON
  }
  return new ApiError(message || fallbackMessage(res.status), res.status);
}

const DEFAULT_TIMEOUT_MS = 20_000;

async function send(path: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", signal: AbortSignal.timeout(timeoutMs), ...init });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError("बहुत देर लग गई, फिर कोशिश कीजिए · That took too long. Please try again.", 0);
    }
    throw new ApiError("इंटरनेट नहीं मिला · No connection. Check the network.", 0);
  }
  if (!res.ok) throw await errorFrom(res);
  return res;
}

async function json<T>(path: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  const res = await send(path, init, timeoutMs);
  return (await res.json()) as T;
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return json<T>(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function startDemo(): Promise<{ shop: Shop }> {
  return postJson("/api/auth/demo");
}

export function register(name: string, pin: string): Promise<{ shop: Shop }> {
  return postJson("/api/auth/register", { name, pin });
}

export function login(code: string, pin: string): Promise<{ shop: Shop }> {
  return postJson("/api/auth/login", { code, pin });
}

export function logout(): Promise<{ ok: true }> {
  return postJson("/api/auth/logout");
}

export function getMe(): Promise<{ shop: Shop }> {
  return json("/api/me", { cache: "no-store" });
}

// The server allows 30 s; leave room for the upload.
const PARSE_TIMEOUT_MS = 45_000;

export function parseEntry(wav: Uint8Array): Promise<ParseResult> {
  return json("/api/entry/parse", {
    method: "POST",
    headers: { "content-type": "audio/wav" },
    body: wav as BlobPart,
  }, PARSE_TIMEOUT_MS);
}

export type NewEntry = {
  customerName: string;
  kind: EntryKind;
  items: Item[];
  total: number;
  transcriptRaw: string;
  transcriptClean: string | null;
  flags: Flag[];
};

export function saveEntry(entry: NewEntry): Promise<{ entry: Entry; customer: Customer }> {
  return postJson("/api/entries", entry);
}

export function listCustomers(): Promise<{ customers: Customer[] }> {
  return json("/api/customers", { cache: "no-store" });
}

export function getCustomer(id: number): Promise<{ customer: Customer; entries: Entry[] }> {
  return json(`/api/customers/${encodeURIComponent(String(id))}`, { cache: "no-store" });
}

/** Timbre mp3 for an entry (with the new balance) or a customer's balance. */
export async function speak(target: { entryId: number } | { customerId: number }): Promise<Blob> {
  const res = await send(
    "/api/speak",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(target),
    },
    30_000,
  );
  return res.blob();
}

/** Removes a wrong entry. Returns the customer with the new balance. */
export function deleteEntry(id: number): Promise<{ customer: Customer }> {
  return json(`/api/entries/${encodeURIComponent(String(id))}`, { method: "DELETE" });
}
