# Pakka · पक्का

Speak an udhaar entry in Hindi or Hinglish. Pakka writes it into the khata, checks every amount twice, and reads the balance back to the customer.

> "रमेश के खाते में 2 पैकेट Maggi 30 रुपये और एक दूध 28 रुपये"
> → रमेश वर्मा · उधार · Maggi ₹30, दूध ₹28 · कुल ₹58 → confirm → Timbre: "रमेश वर्मा जी, आज 58 रुपये का सामान खाते में लिखा गया। अब कुल बाकी 226 रुपये है।"

Built solo from Raipur for the Gnani AI Great Indian AI Internship Challenge.

## Why check twice

Kirana shops are loud: a ceiling fan, traffic, customers talking. Before building, I measured how Gnani Prisma v3.0 handles that ("Shor Meter", 40 Hindi clips in my voice, about 1,000 API calls, all on the `/proof` page):

| Condition | Key word right (amount, number or name) |
|---|---:|
| Clean | 97% |
| Phone codecs (G.711, AMR-NB) | 100% |
| Street noise 5 dB / 0 dB | 92% / 66% |
| Fan noise 10 dB / 5 dB / 0 dB | 97% / 72% / 17% |

- The first thing to break is a single digit. At street 0 dB, 9 of 10 phone numbers came back with one digit wrong (`482915` → `489915`). That is the worst possible mistake in a ledger.
- Cleaning the audio with DeepFilterNet before Prisma did **not** make it more accurate at 5–10 dB (street 5 dB: 92% → 81%). So Pakka does not claim to "fix" noise.
- What does work: send both the raw and the cleaned audio, and compare the numbers. When they disagree the entry is probably wrong. That check caught 27 of 30 wrong entries at fan 0 dB and 11 of 12 at street 0 dB.

So every entry goes to Prisma twice. If the numbers differ, an amount was never spoken, the items don't add up, or the customer is new, the card turns red and the shop owner has to look before it is saved.

## How it works

1. The browser records up to 15 s and sends a 16 kHz WAV.
2. The server cleans a copy with DeepFilterNet, then sends raw and cleaned audio to **Gnani Prisma v3.0** (`hi-IN`, `transcribe`, the shop's customer names as `keyterms`).
3. **Gemini 3.5 Flash Lite** turns the transcripts into `{customer, udhaar|jama, items, total}`. It is told never to invent an amount, and the server checks every amount against the transcripts anyway.
4. The shop owner edits and confirms. Entries live in Neon Postgres.
5. **Gnani Timbre v3.0** (voice Shivani) reads the entry and the new balance out loud, built only from saved data.

## Gnani tech used

- Prisma v3.0 speech-to-text (REST `/stt/v3`), including `keyterms`
- Timbre v3.0 text-to-speech (REST `/api/v1/tts/inference`)

## Run it

```bash
pnpm install
cp .env.example .env   # GNANI_API_KEY, GEMINI_API_KEY, DATABASE_URL, SESSION_SECRET, LIVE_ENABLED=1
pnpm migrate
pnpm dev
```

`pnpm build` downloads the pinned DeepFilterNet v0.5.6 binary (sha256-checked) into `bin/`.

The benchmark pipeline is in `pipeline/` (Python, uv): `uv run shor run`, `uv run shor denoise-run deepfilter`, `uv run shor score`.

## Limits and honesty

- The benchmark is one speaker (me), software-mixed noise, 40 clips. It shows where Prisma breaks; it is not a full evaluation.
- Gemini's free tier may use prompts for training. Demo shops hold sample data only and are deleted after 24 h.
- Live calls are capped (per shop, per IP and per day) and can be switched off with `LIVE_ENABLED`.
- Street noise: DEMAND dataset (STRAFFIC), CC BY-SA 3.0, Thiemann, Ito & Vincent 2013. Fan noise recorded by me.
