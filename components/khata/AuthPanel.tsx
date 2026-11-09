"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleNotch } from "@phosphor-icons/react";
import type { Shop } from "@/lib/khata/types";
import { ApiError, getMe, login, register, startDemo } from "@/lib/khata/client/api";
import { clearHint, readHint, saveHint } from "@/lib/khata/client/session-hint";
import { localize } from "@/lib/i18n/localize";
import { useLang } from "@/lib/i18n/useLang";

type Mode = "none" | "login" | "register";
type Problem = { kind: "pin" } | { kind: "api"; message: string };

const field =
  "min-h-12 w-full rounded-sm border border-ink/60 bg-paper px-3 text-lg text-ink focus:border-ink";

export default function AuthPanel() {
  const router = useRouter();
  const { lang, t } = useLang();
  const [mode, setMode] = useState<Mode>("none");
  const [busy, setBusy] = useState<"demo" | "form" | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [created, setCreated] = useState<Shop | null>(null);
  // Until we know whether a login is saved, show an empty space instead of the
  // wrong buttons. The page is built ahead of time, so it cannot know.
  const [checked, setChecked] = useState(false);
  const [existing, setExisting] = useState<string | null>(null);

  // A valid cookie lasts 30 days, so a returning owner can skip the login form.
  useEffect(() => {
    let alive = true;
    const hint = readHint();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExisting(hint);
    if (hint === null) setChecked(true);
    getMe()
      .then((r) => {
        if (!alive) return;
        saveHint(r.shop.name);
        setExisting(r.shop.name);
        setChecked(true);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) {
          clearHint();
          setExisting(null);
        }
        setChecked(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const run = async (kind: "demo" | "form", fn: () => Promise<unknown>) => {
    setBusy(kind);
    setProblem(null);
    try {
      await fn();
    } catch (err) {
      setProblem({ kind: "api", message: err instanceof Error ? err.message : t.somethingWrong });
    } finally {
      setBusy(null);
    }
  };

  const onDemo = () =>
    run("demo", async () => {
      await startDemo();
      router.push("/khata");
    });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pin = String(fd.get("pin") ?? "").trim();
    if (!/^\d{4,6}$/.test(pin)) {
      setProblem({ kind: "pin" });
      return;
    }
    if (mode === "login") {
      const code = String(fd.get("code") ?? "").trim();
      void run("form", async () => {
        await login(code, pin);
        router.push("/khata");
      });
    } else {
      const name = String(fd.get("name") ?? "").trim();
      void run("form", async () => {
        const r = await register(name, pin);
        setCreated(r.shop);
      });
    }
  };

  const errorText = !problem
    ? ""
    : problem.kind === "pin"
      ? t.authPinError
      : localize(problem.message, lang);

  const tab = (m: Exclude<Mode, "none">, label: string) => (
    <button
      type="button"
      aria-expanded={mode === m}
      aria-controls="auth-form"
      onClick={() => {
        setMode(mode === m ? "none" : m);
        setProblem(null);
      }}
      className={`min-h-14 flex-1 rounded-sm border px-4 py-1 ${mode === m ? "border-ink bg-ink text-paper" : "border-ink"}`}
    >
      {label}
    </button>
  );

  if (!checked && existing === null && !created) {
    return <div aria-hidden className="min-h-[13rem]" />;
  }

  if (created) {
    return (
      <div lang={lang} className="border-2 border-ink p-5" role="status" aria-live="polite">
        <p className="text-lg font-medium">{t.authCreated(created.name)}</p>
        <p className="mt-3 text-base text-ink-soft">{t.authYourCode}</p>
        <p className="num mt-1 select-all text-5xl tracking-wider">{created.code}</p>
        <p className="mt-3 border-l-4 border-accent pl-3 text-base font-medium">{t.authNoteCode}</p>
        <button
          type="button"
          onClick={() => router.push("/khata")}
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-sm bg-ink px-5 text-lg text-paper"
        >
          {t.authOpen}
          <ArrowRight aria-hidden size={22} />
        </button>
      </div>
    );
  }

  if (existing) {
    return (
      <div lang={lang}>
        <button
          type="button"
          onClick={() => router.push("/khata")}
          className="inline-flex min-h-16 w-full min-w-0 items-center justify-center gap-3 rounded-sm bg-ink px-6 text-xl font-medium text-paper"
        >
          <span lang="hi" className="min-w-0 truncate">
            {t.authContinue(existing)}
          </span>
          <ArrowRight aria-hidden size={22} className="shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => setExisting(null)}
          className="mt-3 min-h-12 underline underline-offset-4"
        >
          {t.authOtherShop}
        </button>
      </div>
    );
  }

  return (
    <div lang={lang}>
      <button
        type="button"
        onClick={onDemo}
        disabled={busy !== null}
        aria-busy={busy === "demo"}
        className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-sm bg-accent px-6 text-xl font-medium text-paper shadow-[0_4px_0_0_var(--ink)] active:translate-y-0.5 active:shadow-[0_2px_0_0_var(--ink)] disabled:opacity-70"
      >
        {busy === "demo" ? <CircleNotch aria-hidden size={24} className="animate-spin" /> : null}
        {t.authDemo}
        <ArrowRight aria-hidden size={22} />
      </button>
      <p className="mt-2 text-sm text-ink-soft">{t.authDemoNote}</p>

      <div className="mt-6 flex gap-2">
        {tab("login", t.authLogin)}
        {tab("register", t.authNewShop)}
      </div>

      {mode !== "none" && (
        <form id="auth-form" onSubmit={onSubmit} className="settle mt-4 space-y-4 border-l-2 border-ink pl-4">
          {mode === "login" ? (
            <div>
              <label htmlFor="auth-code" className="block">
                {t.authShopCode}
              </label>
              <input id="auth-code" name="code" required autoComplete="username" autoCapitalize="characters" className={`${field} num mt-1 uppercase`} />
            </div>
          ) : (
            <div>
              <label htmlFor="auth-name" className="block">
                {t.authShopName}
              </label>
              <input id="auth-name" name="name" lang="hi" required maxLength={60} autoComplete="organization" className={`${field} mt-1`} />
            </div>
          )}
          <div>
            <label htmlFor="auth-pin" className="block">
              {t.authPin} <span className="text-sm text-ink-soft">· {t.authPinHint}</span>
            </label>
            <input
              id="auth-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              minLength={4}
              maxLength={6}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={`${field} num mt-1 max-w-[12rem] tracking-[0.3em]`}
            />
          </div>
          <button
            type="submit"
            disabled={busy !== null}
            aria-busy={busy === "form"}
            className="inline-flex min-h-14 items-center gap-2 rounded-sm bg-ink px-6 text-lg text-paper disabled:opacity-70"
          >
            {busy === "form" && <CircleNotch aria-hidden size={22} className="animate-spin" />}
            {mode === "login" ? t.authLoginSubmit : t.authCreate}
          </button>
        </form>
      )}

      <p role="alert" className="mt-4 font-medium text-accent empty:hidden">
        {errorText}
      </p>
    </div>
  );
}
