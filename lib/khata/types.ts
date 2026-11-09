// Shared contract between the Pakka API routes and the UI.
// All money is whole rupees (integers).

export type EntryKind = "udhaar" | "jama"; // udhaar = customer owes more, jama = customer paid

export type Item = {
  name: string;
  qty: string | null; // free text as spoken, e.g. "2 packet", "1 kg"
  amount: number | null; // rupees for this line, null if not said
};

export type Flag =
  | "numbers_differ" // raw and cleaned transcripts contain different numbers
  | "raw_empty" // Prisma heard nothing in the raw audio
  | "amount_not_heard" // an amount on the card is in neither transcript
  | "sum_mismatch" // item amounts do not add up to the total
  | "new_customer" // name not in this shop's customer list
  | "no_total" // no total could be found
  | "denoise_unavailable" // cleaning step failed, only one transcript
  | "ai_unavailable"; // Gemini failed, the card is a rough guess from the numbers heard

export type ParseResult = {
  transcriptRaw: string;
  transcriptClean: string | null;
  customer: string | null;
  customerId: number | null; // matched existing customer, else null
  kind: EntryKind;
  items: Item[];
  total: number | null;
  flags: Flag[];
  noise: { snrDb: number | null }; // rough estimate from the raw audio, null if unknown
};

export type Customer = {
  id: number;
  name: string;
  balance: number; // udhaar minus jama
  lastEntryAt: string | null; // ISO
};

export type Entry = {
  id: number;
  customerId: number;
  customerName: string;
  kind: EntryKind;
  items: Item[];
  total: number;
  flags: Flag[];
  transcriptRaw: string;
  transcriptClean: string | null;
  createdAt: string; // ISO
};

export type Shop = { id: number; code: string; name: string; isDemo: boolean };

// --- API ---
// All endpoints return JSON. Errors: { error: string } with a 4xx/5xx status,
// the message is plain Hindi/English and safe to show.
//
// POST /api/auth/demo                        -> { shop: Shop }      creates demo shop with sample data, sets cookie
// POST /api/auth/register {name, pin}        -> { shop: Shop }      code is generated, sets cookie
// POST /api/auth/login    {code, pin}        -> { shop: Shop }
// POST /api/auth/logout                      -> { ok: true }
// GET  /api/me                               -> { shop: Shop } | 401
// POST /api/entry/parse   body: audio/wav    -> ParseResult        (16-bit PCM WAV, <= 15 s, <= 1 MB)
// POST /api/entries       {customerName, kind, items, total, transcriptRaw, transcriptClean, flags}
//                                            -> { entry: Entry, customer: Customer }
// GET  /api/customers                        -> { customers: Customer[] }  sorted by balance desc
// GET  /api/customers/:id                    -> { customer: Customer, entries: Entry[] } newest first
// DELETE /api/entries/:id                   -> { customer: Customer }  removes a wrong entry
// POST /api/speak         {entryId} | {customerId}
//                                            -> audio/mpeg (Timbre reads the entry and the new balance)
