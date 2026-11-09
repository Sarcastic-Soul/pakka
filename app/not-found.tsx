import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5">
      <p className="num text-sm text-ink-soft">404</p>
      <h1 className="mt-2 font-display text-5xl leading-tight">
        <span lang="hi">यह पन्ना नहीं मिला</span>
        <span className="block text-3xl text-ink-soft">This page does not exist</span>
      </h1>
      <Link href="/" className="mt-8 inline-flex min-h-12 items-center underline underline-offset-4">
        <span lang="hi">पक्का पर लौटिए</span>&nbsp;· Back to Pakka
      </Link>
    </main>
  );
}
