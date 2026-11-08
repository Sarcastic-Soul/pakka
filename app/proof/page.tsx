import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Curve from "@/components/Curve";
import Datasheet, { db, pct } from "@/components/Datasheet";
import Meter from "@/components/Meter";
import TryIt from "@/components/TryIt";
import { assertResultsFile, cleanStat } from "@/lib/results";

const data = assertResultsFile(
  JSON.parse(
    readFileSync(path.join(process.cwd(), "public/data/results.json"), "utf-8"),
  ),
);

const REPO = "https://github.com/Sarcastic-Soul/shor-meter";

export const metadata: Metadata = {
  title: "Shor Meter",
  description:
    "How much phone-line noise Gnani Prisma can take before amounts, phone numbers and names come out wrong.",
};

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`s-${n}`} className="border-t border-ink pt-6">
      <h2 id={`s-${n}`} className="mb-8 flex items-baseline gap-4 font-display text-2xl">
        <span className="num text-sm text-ink-soft">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function Home() {
  const model = data.models[0] ?? "";
  const clean = cleanStat(data, model);
  const street0 = data.aggregates.find(
    (a) => a.model === model && a.condition === "street_snr-5",
  );
  const streetBreak = data.breakpoints.find(
    (b) => b.model === model && b.noise === "street",
  );
  const clipCount = new Set(data.results.map((r) => r.clip)).size;
  const generated = data.generated_at.slice(0, 10);

  const stats = [
    { label: "Entity accuracy, clean", value: pct(clean?.entityAccuracy), bad: false },
    {
      label: "Entity accuracy, street noise at -5 dB",
      value: pct(street0?.entity_accuracy),
      bad: street0 !== undefined && street0.entity_accuracy < 0.9,
    },
    {
      label: "Street noise breakpoint (below 90%)",
      value: db(streetBreak?.snr_db),
      bad: streetBreak?.snr_db != null,
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
      <header className="pt-6 pb-14 sm:pt-10">
        <Link
          href="/"
          className="mb-6 inline-flex min-h-12 items-center gap-2 text-ink underline underline-offset-4"
        >
          <ArrowLeft aria-hidden size={18} />
          <span lang="hi">पक्का</span> · Back to Pakka
        </Link>
        <div className="num flex flex-wrap justify-between gap-2 border-b border-ink pb-2 text-xs uppercase tracking-wide text-ink-soft">
          <span>Noise test / Hindi speech-to-text</span>
          <span>
            {model || "\u2014"} / run {generated}
          </span>
        </div>
        <h1 className="mt-10 font-display text-6xl font-semibold tracking-tight sm:text-8xl">
          Shor Meter
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft sm:text-xl">
          How much phone-line noise Gnani Prisma can take before amounts,
          phone numbers and names come out wrong.
        </p>
        <dl className="mt-12 grid border-y border-ink sm:grid-cols-3">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`py-5 sm:px-6 ${i > 0 ? "border-t border-rule sm:border-t-0 sm:border-l" : "sm:pl-0"}`}
            >
              <dt className="text-sm text-ink-soft">{s.label}</dt>
              <dd className={`num mt-2 text-4xl sm:text-5xl ${s.bad ? "text-accent" : ""}`}>
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="space-y-20">
        <Section n="01" title="Listen and compare">
          <p className="mb-8 max-w-2xl text-ink-soft">
            Pick a clip, then turn the noise up. Each stop shows what Prisma
            wrote back for that exact audio. Words it missed or got wrong are
            underlined in red.
          </p>
          <Meter data={data} />
        </Section>

        <Section n="02" title="Where it breaks">
          <p className="mb-8 max-w-2xl text-ink-soft">
            Entity accuracy is the share of clips where the amount, phone
            number or name came out right. The red line marks the noise level
            where it first falls below 90%.
          </p>
          <Curve data={data} model={model} />
          <div className="mt-12">
            <Datasheet data={data} model={model} />
          </div>
        </Section>

        <Section n="03" title="Try your own voice">
          <TryIt />
        </Section>

        <Section n="04" title="Method and limits">
          <div className="grid gap-x-12 gap-y-4 text-ink-soft md:grid-cols-2">
            <ul className="list-disc space-y-3 pl-5 marker:text-rule">
              <li>
                One speaker read {clipCount === 40 ? "40" : `${clipCount} (40 planned)`}{" "}
                short Hindi clips, each with an amount, a phone number or a name.
              </li>
              <li>
                Most noise is mixed in by software: recorded street and fan
                sound added at a set signal-to-noise ratio. A field check
                recorded in real noise backs it up.
              </li>
              <li>
                Model tested: <span className="num text-ink">{data.models.join(", ") || "\u2014"}</span>.
              </li>
            </ul>
            <ul className="list-disc space-y-3 pl-5 marker:text-rule">
              <li>
                The audio on this page is a 32 kbps MP3 so it loads fast.
                Prisma received the original WAV.
              </li>
              <li>
                Absolute WER counts spelling differences too (for example{" "}
                <span lang="hi">शर्मा</span> against <span lang="hi">शरमा</span>), so look at WER vs clean and entity
                accuracy first.
              </li>
              <li>
                Raw data:{" "}
                <a href="/data/results.json" className="text-ink underline underline-offset-4">
                  results.json
                </a>
                . Code:{" "}
                <a href={REPO} className="text-ink underline underline-offset-4">
                  github.com/Sarcastic-Soul/shor-meter
                </a>
                .
              </li>
            </ul>
          </div>
        </Section>
      </div>
    </main>
  );
}
