"use client";

import Link from "next/link";
import { ArrowRight, Warning } from "@phosphor-icons/react";
import AuthPanel from "@/components/khata/AuthPanel";
import LangToggle from "@/components/LangToggle";
import { useLang } from "@/lib/i18n/useLang";

const REPO = "https://github.com/Sarcastic-Soul/pakka";

const NUMBERS: { value: string; bad?: boolean }[] = [{ value: "97%" }, { value: "72%", bad: true }, { value: "9/10", bad: true }];

const underline = "num underline decoration-rule decoration-2 underline-offset-4";
const underlineBad = "num font-medium text-accent underline decoration-2 underline-offset-4";

/** Static picture of the confirm card, built from HTML so it reads like the real app. */
function ExampleCard() {
  const { lang, t } = useLang();
  return (
    <figure aria-label={t.exampleAria} className="relative">
      <div className="relative border-2 border-accent bg-paper px-5 py-5 shadow-[8px_8px_0_0_var(--paper-deep)]">
        <div aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-accent" />
        <p lang={lang} className={`text-xs text-ink-soft ${lang === "en" ? "num uppercase tracking-wide" : ""}`}>
          {t.exCheck}
        </p>
        <p lang={lang} className="mt-3 flex gap-2 text-accent">
          <Warning aria-hidden size={22} weight="fill" className="mt-0.5 shrink-0" />
          <span className="font-medium leading-snug">{t.flags.numbers_differ}</span>
        </p>

        <div className="mt-4 flex items-baseline justify-between border-b border-rule pb-2">
          <span lang="hi" className="font-display text-3xl">
            रमेश
          </span>
          <span lang={lang} className="border border-ink bg-ink px-2 text-sm text-paper">
            {t.kindUdhaarShort}
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
          <span lang={lang} className="text-lg">
            {t.total}
          </span>
          <span className="num text-4xl">₹58</span>
        </div>

        <div className="mt-4 grid gap-3 border-t border-rule pt-3 text-base sm:grid-cols-2">
          <p>
            <span lang={lang} className="block text-xs text-ink-soft">
              {t.heard}
            </span>
            <span lang="hi">
              रमेश के खाते में <span className={underline}>2</span> Maggi <span className={underline}>30</span>, दूध{" "}
              <span className={underlineBad}>38</span>
            </span>
          </p>
          <p>
            <span lang={lang} className="block text-xs text-ink-soft">
              {t.cleaned}
            </span>
            <span lang="hi">
              रमेश के खाते में <span className={underline}>2</span> Maggi <span className={underline}>30</span>, दूध{" "}
              <span className={underlineBad}>28</span>
            </span>
          </p>
        </div>
        <p
          lang={lang}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-accent px-4 text-lg text-paper"
        >
          {t.saveChecked}
        </p>
      </div>
      <figcaption lang={lang} className="mt-4 text-sm text-ink-soft">
        {t.exCaption}
      </figcaption>
    </figure>
  );
}

export default function Landing() {
  const { lang, t } = useLang();
  return (
    <div lang={lang} className="min-h-screen">
      <main className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-3 pt-6 sm:pt-10">
          <span className={`text-xs text-ink-soft ${lang === "en" ? "num uppercase tracking-wide" : "text-sm"}`}>
            {t.topbarLeft}
          </span>
          <div className="flex items-center gap-4">
            <Link href="/proof" className="text-sm underline underline-offset-4">
              {t.noiseTest}
            </Link>
            <LangToggle />
          </div>
        </div>

        <section className="grid grid-cols-[minmax(0,1fr)] gap-12 pt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pt-16">
          <div className="min-w-0">
            <h1 className="font-display text-6xl font-semibold leading-[0.95] tracking-tight sm:text-8xl">
              Pakka <span className="text-ink-soft">·</span>{" "}
              <span lang="hi" className="block font-semibold sm:inline">
                पक्का
              </span>
            </h1>
            <p className="mt-6 max-w-xl font-display text-2xl leading-snug sm:text-3xl">{t.heroTag}</p>
            <p className="mt-2 text-lg text-ink-soft">{t.heroSub}</p>
            <p className="mt-6 max-w-xl text-lg leading-relaxed">{t.heroBody}</p>
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
            {t.whyTitle}
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">{t.whyIntro}</p>

          <dl className="mt-8 grid border-y border-ink sm:grid-cols-3">
            {NUMBERS.map((n, i) => (
              <div
                key={n.value}
                className={`py-5 sm:px-6 ${i > 0 ? "border-t border-rule sm:border-l sm:border-t-0" : "sm:pl-0"}`}
              >
                <dt className="sr-only">{t.statLabels[i]}</dt>
                <dd>
                  <span className={`num block text-5xl ${n.bad ? "text-accent" : ""}`}>{n.value}</span>
                  <span className="mt-2 block text-base">{t.statLabels[i]}</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <h3 className="text-xl font-medium">{t.catchTitle}</h3>
              <p className="mt-3 text-lg leading-relaxed">{t.catchBody(t.frac(27, 30), t.frac(11, 12))}</p>
            </div>
            <div className="border-l-4 border-accent pl-5">
              <h3 className="text-xl font-medium">{t.cleanTitle}</h3>
              <p className="mt-3 text-lg leading-relaxed">{t.cleanBody}</p>
            </div>
          </div>

          <Link
            href="/proof"
            className="mt-10 inline-flex min-h-12 items-center gap-2 text-lg underline underline-offset-4"
          >
            {t.seeTest}
            <ArrowRight aria-hidden size={20} />
          </Link>
        </section>
      </main>

      <footer className="border-t border-ink">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-ink-soft sm:flex-row sm:justify-between sm:px-8">
          <p>{t.footer}</p>
          <a href={REPO} className="text-ink underline underline-offset-4">
            github.com/Sarcastic-Soul/pakka
          </a>
        </div>
      </footer>
    </div>
  );
}
