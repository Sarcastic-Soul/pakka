"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5">
      <h1 className="font-display text-4xl leading-tight">
        <span lang="hi">कुछ गड़बड़ हुई</span>
        <span className="block text-2xl text-ink-soft">Something went wrong</span>
      </h1>
      <button
        type="button"
        onClick={reset}
        className="mt-8 min-h-14 self-start rounded-sm bg-ink px-6 text-lg text-paper"
      >
        <span lang="hi">फिर कोशिश कीजिए</span> · Try again
      </button>
    </main>
  );
}
