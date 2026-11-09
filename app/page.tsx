import Link from "next/link";
import { ArrowRight, Warning } from "@phosphor-icons/react/dist/ssr";
import AuthPanel from "@/components/khata/AuthPanel";

const REPO = "https://github.com/Sarcastic-Soul/pakka";

/** Static picture of the confirm card, built from HTML so it reads like the real app. */
function ExampleCard() {
  return (
    <figure aria-label="उदाहरण · Example confirm card" className="relative">
      <div className="relative border-2 border-accent bg-paper px-5 py-5 shadow-[8px_8px_0_0_var(--paper-deep)]">
        <div aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-accent" />
        <p className="num text-xs uppercase tracking-wide text-ink-soft">
          <span lang="hi">जाँचिए</span> / check before saving
        </p>
        <p className="mt-3 flex gap-2 text-accent">
          <Warning aria-hidden size={22} weight="fill" className="mt-0.5 shrink-0" />
          <span lang="hi" className="font-medium leading-snug">
            दोनों बार अलग रकम सुनाई दी — ध्यान से जाँचिए
          </span>
        </p>

        <div className="mt-4 flex items-baseline justify-between border-b border-rule pb-2">
          <span lang="hi" className="font-display text-3xl">
            रमेश
          </span>
          <span lang="hi" className="border border-ink bg-ink px-2 text-sm text-paper">
            उधार
          </span>
        </div>
        <dl className="divide-y divide-rule">
          <div className="flex justify-between py-2">
            <dt lang="hi">2 Maggi</dt>
            <dd className="num">₹30</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt lang="hi">दूध</dt>
            <dd className="num font-medium text-accent">₹28</dd>
          </div>
        </dl>
        <div className="flex items-baseline justify-between border-t-2 border-ink pt-2">
          <span lang="hi" className="text-lg">
            कुल
          </span>
          <span className="num text-4xl">₹58</span>
        </div>

        <div className="mt-4 grid gap-3 border-t border-rule pt-3 text-base sm:grid-cols-2">
          <p>
            <span className="block text-xs text-ink-soft">
              <span lang="hi">जो सुना</span> · Heard
            </span>
            <span lang="hi">
              रमेश के खाते में <span className="num underline decoration-rule decoration-2 underline-offset-4">2</span>{" "}
              Maggi <span className="num underline decoration-rule decoration-2 underline-offset-4">30</span>, दूध{" "}
              <span className="num font-medium text-accent underline decoration-2 underline-offset-4">38</span>
            </span>
          </p>
          <p>
            <span className="block text-xs text-ink-soft">
              <span lang="hi">साफ़ आवाज़ से</span> · Cleaned
            </span>
            <span lang="hi">
              रमेश के खाते में <span className="num underline decoration-rule decoration-2 underline-offset-4">2</span>{" "}
              Maggi <span className="num underline decoration-rule decoration-2 underline-offset-4">30</span>, दूध{" "}
              <span className="num font-medium text-accent underline decoration-2 underline-offset-4">28</span>
            </span>
          </p>
        </div>
        <p className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-accent px-4 text-lg text-paper">
          <span lang="hi">जाँच लिया, सेव करें</span>
        </p>
      </div>
      <figcaption className="mt-4 text-sm text-ink-soft">
        Example. The noisy recording heard <span className="num">38</span>, the cleaned one heard{" "}
        <span className="num">28</span>. Pakka shows both and waits for the shop owner.
      </figcaption>
    </figure>
  );
}

const NUMBERS: { value: string; hi: string; en: string; bad?: boolean }[] = [
  { value: "97%", hi: "साफ़ आवाज़ में मुख्य शब्द सही", en: "of key words right in clean audio" },
  { value: "72%", hi: "पंखे के शोर में (5 dB)", en: "with fan noise at 5 dB", bad: true },
  {
    value: "9/10",
    hi: "सड़क के शोर में (0 dB) फ़ोन नंबर में एक अंक ग़लत",
    en: "phone numbers came back with a digit wrong in street noise at 0 dB",
    bad: true,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="num flex flex-wrap justify-between gap-2 border-b border-ink pb-2 pt-6 text-xs uppercase tracking-wide text-ink-soft sm:pt-10">
          <span>Voice udhaar ledger / Hindi</span>
          <Link href="/proof" className="underline underline-offset-4">
            Noise test
          </Link>
        </div>

        <section className="grid gap-12 pt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pt-16">
          <div>
            <h1 className="font-display text-6xl font-semibold leading-[0.95] tracking-tight sm:text-8xl">
              Pakka <span className="text-ink-soft">·</span>{" "}
              <span lang="hi" className="block font-semibold sm:inline">
                पक्का
              </span>
            </h1>
            <p lang="hi" className="mt-6 max-w-xl font-display text-2xl leading-snug sm:text-3xl">
              पक्का हिसाब — हर रकम दो बार जाँची जाती है।
            </p>
            <p className="mt-2 text-lg text-ink-soft">Udhaar you can trust.</p>
            <p className="mt-6 max-w-xl text-lg leading-relaxed">
              Tap, say <span lang="hi">“रमेश के खाते में 2 Maggi 30, दूध 28”</span>, check the card, save.
              The customer hears the total read out. No amount is saved without the shop owner seeing it.
            </p>
            <div className="mt-8 max-w-md">
              <AuthPanel />
            </div>
          </div>
          <div className="lg:pt-6">
            <ExampleCard />
          </div>
        </section>

        <section aria-labelledby="why" className="mt-24 border-t border-ink pt-6">
          <h2 id="why" className="font-display text-3xl sm:text-4xl">
            <span lang="hi">क्यों दो बार?</span> <span className="text-ink-soft">· Why check twice</span>
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
            We tested Gnani Prisma on 40 Hindi clips with mixed-in shop and street noise, 520 calls in all.
            In noise it usually gets single digits wrong first, which is the worst place to be wrong in a khata.
          </p>

          <dl className="mt-8 grid border-y border-ink sm:grid-cols-3">
            {NUMBERS.map((n, i) => (
              <div
                key={n.en}
                className={`py-5 sm:px-6 ${i > 0 ? "border-t border-rule sm:border-l sm:border-t-0" : "sm:pl-0"}`}
              >
                <dt className="sr-only">{n.en}</dt>
                <dd>
                  <span className={`num block text-5xl ${n.bad ? "text-accent" : ""}`}>{n.value}</span>
                  <span lang="hi" className="mt-2 block text-base">
                    {n.hi}
                  </span>
                  <span className="block text-sm text-ink-soft">{n.en}</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <h3 className="text-xl font-medium">
                <span lang="hi">दो बार सुनने से पकड़ में आता है</span>
                <span className="block text-base font-normal text-ink-soft">What the second hearing catches</span>
              </h3>
              <p className="mt-3 text-lg leading-relaxed">
                Pakka transcribes the raw audio and a copy cleaned with DeepFilterNet. When the numbers in the
                two disagree, the card turns red. In our test that caught{" "}
                <span className="font-medium">
                  <span className="num">27</span> of <span className="num">30</span>
                </span>{" "}
                wrong entries with fan noise at 0 dB, and{" "}
                <span className="font-medium">
                  <span className="num">11</span> of <span className="num">12</span>
                </span>{" "}
                with street noise at 0 dB.
              </p>
            </div>
            <div className="border-l-4 border-accent pl-5">
              <h3 className="text-xl font-medium">
                <span lang="hi">साफ़ करना अकेले काफ़ी नहीं</span>
                <span className="block text-base font-normal text-ink-soft">Cleaning alone does not fix it</span>
              </h3>
              <p className="mt-3 text-lg leading-relaxed">
                At 5–10 dB, cleaning the audio did not make Prisma more accurate. We use the cleaned copy as a
                second opinion to spot doubt, not as a fix. A red card still needs a human to look.
              </p>
            </div>
          </div>

          <Link
            href="/proof"
            className="mt-10 inline-flex min-h-12 items-center gap-2 text-lg underline underline-offset-4"
          >
            <span lang="hi">पूरा टेस्ट देखिए</span> · See the full noise test
            <ArrowRight aria-hidden size={20} />
          </Link>
        </section>
      </main>

      <footer className="border-t border-ink">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-ink-soft sm:flex-row sm:justify-between sm:px-8">
          <p>
            Pakka · <span lang="hi">पक्का</span>. Built with Gnani Prisma v3.0 + Timbre v3.0, DeepFilterNet,
            Gemini 3.5 Flash Lite.
          </p>
          <a href={REPO} className="text-ink underline underline-offset-4">
            github.com/Sarcastic-Soul/pakka
          </a>
        </div>
      </footer>
    </div>
  );
}
