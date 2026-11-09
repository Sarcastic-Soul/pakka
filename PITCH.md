# Pakka · पक्का: udhaar you can trust

**Live:** https://pakka-nu-puce.vercel.app (tap "Try the demo", no signup) · **Demo video:** https://youtu.be/zZ2lHacwKYc

## The problem

Most kirana shops run on udhaar, and udhaar is still written in a paper khata. At rush hour the queue waits while the owner writes every item by hand. At month end the paper is the only proof. The customer can't check it, the owner can't prove it, and one wrong number turns a regular into an argument. Apps like Excel or ledger apps exist, but they need typing and training that a busy shop owner doesn't have.

## The solution

Pakka is a voice ledger for the shop.

1. **Speak.** The owner presses one button and says it the way they would say it anyway: "रमेश जी, दो पैकेट मैगी तीस रुपये, एक दूध अट्ठाईस रुपये".
2. **Confirm.** Pakka fills in the card (customer, items, amounts, total) and reads it back in Hindi. One tap saves it.
3. **Both sides see it.** Right after saving, the customer gets a WhatsApp message with the amount just added and the total left to pay. The shop and the customer see the same tab, so nothing can be added quietly.

There's no setup and no training. If you can talk, you can use Pakka. The whole app is in Hindi or English, with one-tap undo, customer history and a payment button.

## Why it can be trusted in a loud shop

Before building, I measured Gnani Prisma in shop noise (40 Hindi clips, about 1,000 calls, all on the `/proof` page). Clean audio was 97% right, but heavy fan noise dropped it to 17%, and the first thing to break is a single digit. So Pakka hears every entry twice, once raw and once cleaned with DeepFilterNet. When the two hearings give different numbers, the card turns red before saving. In heavy fan noise that check caught 27 of 30 wrong entries. The server also checks that every amount was actually spoken and that the items add up to the total.

## Built with

- **Gnani Prisma v3.0** speech-to-text, with the shop's customer names as `keyterms`
- **Gnani Timbre v3.0** text-to-speech (voice Shivani) for the Hindi read-back
- Next.js on Vercel, DeepFilterNet, Gemini 3.5 Flash Lite (turns the transcripts into a card), and Neon Postgres

## What's next

A real WhatsApp Business integration (today it is a share link the owner taps), a "how much is left?" voice query, and testing with real shops and more speakers.

Built solo by Anish Kumar, IIIT Naya Raipur.
